import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Barcode, Pencil, Plus, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { money, num } from "@/lib/format";
import { barcodeSvg, generateEan13 } from "@/lib/barcode";
import { printHtml } from "@/lib/receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/stok")({
  head: () => ({
    meta: [
      { title: "Stok & Barkod — ZarSoft" },
      { name: "description", content: "Ürün kartları, kritik stok uyarıları ve barkod etiket basımı." },
      { property: "og:title", content: "Stok & Barkod — ZarSoft" },
      { property: "og:description", content: "Stok yönetimi ve barkod etiketleme." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StokPage,
});

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  category: string | null;
  purchase_price: number;
  sale_price: number;
  vat_rate: number;
  stock: number;
  min_stock: number;
  unit: string;
};

const emptyForm = {
  name: "",
  barcode: "",
  sku: "",
  category: "",
  purchase_price: "0",
  sale_price: "0",
  vat_rate: "20",
  stock: "0",
  min_stock: "0",
  unit: "Adet",
};

function StokPage() {
  const { me } = useAuth();
  const companyId = me?.companyId ?? null;
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [open, setOpen] = useState(false);
  const [labelFor, setLabelFor] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const critical = useMemo(
    () => products.filter((p) => num(p.stock) <= num(p.min_stock)),
    [products],
  );
  const noBarcode = useMemo(() => products.filter((p) => !p.barcode), [products]);

  const list = useMemo(() => {
    const q = term.trim().toLocaleLowerCase("tr");
    let arr = onlyCritical ? critical : products;
    if (q)
      arr = arr.filter(
        (p) =>
          p.name.toLocaleLowerCase("tr").includes(q) ||
          (p.barcode ?? "").includes(q) ||
          (p.sku ?? "").toLocaleLowerCase("tr").includes(q),
      );
    return arr;
  }, [products, critical, term, onlyCritical]);

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      barcode: p.barcode ?? "",
      sku: p.sku ?? "",
      category: p.category ?? "",
      purchase_price: String(num(p.purchase_price)),
      sale_price: String(num(p.sale_price)),
      vat_rate: String(num(p.vat_rate)),
      stock: String(num(p.stock)),
      min_stock: String(num(p.min_stock)),
      unit: p.unit,
    });
    setOpen(true);
  }

  async function save() {
    if (!companyId) return;
    if (!form.name.trim()) return toast.error("Ürün adı gerekli.");
    const payload = {
      company_id: companyId,
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      sku: form.sku.trim() || null,
      category: form.category.trim() || null,
      purchase_price: num(form.purchase_price),
      sale_price: num(form.sale_price),
      vat_rate: num(form.vat_rate),
      stock: num(form.stock),
      min_stock: num(form.min_stock),
      unit: form.unit || "Adet",
    };
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Ürün güncellendi." : "Ürün eklendi.");
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  async function assignBarcode(p: Product) {
    const code = generateEan13(p.id.replace(/\D/g, ""));
    const { error } = await supabase.from("products").update({ barcode: code }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Barkod üretildi: " + code);
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  async function generateAllMissing() {
    if (!noBarcode.length) return toast.info("Tüm ürünlerin barkodu var.");
    for (const p of noBarcode) {
      await supabase
        .from("products")
        .update({ barcode: generateEan13(p.id.replace(/\D/g, "")) })
        .eq("id", p.id);
    }
    toast.success(`${noBarcode.length} ürün için barkod üretildi.`);
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  function printLabels(items: Product[], copies = 1) {
    const withCode = items.filter((p) => p.barcode);
    if (!withCode.length) return toast.error("Yazdırılacak barkodlu ürün yok.");
    const cells = withCode
      .flatMap((p) => Array.from({ length: copies }, () => p))
      .map(
        (p) => `<div style="width:48mm;border:1px dashed #ccc;padding:6px;text-align:center;page-break-inside:avoid">
          <div style="font-size:11px;font-weight:600">${p.name}</div>
          <div style="font-size:13px;font-weight:700">${money(p.sale_price)}</div>
          ${barcodeSvg(p.barcode!, { height: 40, width: 1.6 })}
        </div>`,
      )
      .join("");
    printHtml(
      `<h1>Barkod Etiketleri</h1><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">${cells}</div>`,
      "Barkod Etiket",
    );
  }

  return (
    <AppShell
      title="Stok & Barkod"
      subtitle={`${products.length} ürün · ${critical.length} kritik`}
      actions={
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 size-4" /> Ürün
        </Button>
      }
    >
      <div className="space-y-4">
        {critical.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <AlertTriangle className="size-5 text-destructive" />
            <p className="flex-1 text-sm">
              <strong>{critical.length} üründe</strong> kritik stok seviyesi (min. stok altında).
            </p>
            <Button size="sm" variant="outline" onClick={() => setOnlyCritical((v) => !v)}>
              {onlyCritical ? "Tümünü göster" : "Kritikleri göster"}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Ürün adı, barkod veya stok kodu ara…"
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={generateAllMissing}>
            <Barcode className="mr-1 size-4" /> Eksik barkodları üret ({noBarcode.length})
          </Button>
          <Button variant="outline" onClick={() => printLabels(list)}>
            <Printer className="mr-1 size-4" /> Etiketleri bas
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th className="p-3">Ürün</th>
                <th className="p-3">Barkod</th>
                <th className="p-3 text-right">Alış</th>
                <th className="p-3 text-right">Satış</th>
                <th className="p-3 text-right">Stok</th>
                <th className="p-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((p) => {
                const isCritical = num(p.stock) <= num(p.min_stock);
                return (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="p-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.category ?? "Kategorisiz"}</p>
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {p.barcode ?? (
                        <Button size="sm" variant="outline" onClick={() => assignBarcode(p)}>
                          Barkod üret
                        </Button>
                      )}
                    </td>
                    <td className="p-3 text-right">{money(p.purchase_price)}</td>
                    <td className="p-3 text-right font-medium">{money(p.sale_price)}</td>
                    <td className="p-3 text-right">
                      <span className={isCritical ? "font-semibold text-destructive" : ""}>
                        {num(p.stock)} {p.unit}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setLabelFor(p)} disabled={!p.barcode}>
                          <Barcode className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!list.length && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {isLoading ? "Yükleniyor…" : "Kayıt yok."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Ürün Kartı" : "Yeni Ürün"}</DialogTitle>
            <DialogDescription>Ürün bilgilerini girin.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Ürün Adı</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Barkod</Label>
              <div className="flex gap-2">
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                <Button variant="outline" onClick={() => setForm({ ...form, barcode: generateEan13() })}>
                  Üret
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Stok Kodu</Label>
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Kategori</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Birim</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Alış Fiyatı</Label>
              <Input
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Satış Fiyatı</Label>
              <Input value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>KDV %</Label>
              <Input value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Stok</Label>
              <Input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Kritik Stok</Label>
              <Input value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={save}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!labelFor} onOpenChange={(o) => !o && setLabelFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Barkod Etiketi</DialogTitle>
            <DialogDescription>{labelFor?.name}</DialogDescription>
          </DialogHeader>
          {labelFor?.barcode && (
            <div
              className="flex justify-center rounded-md bg-white p-4"
              dangerouslySetInnerHTML={{ __html: barcodeSvg(labelFor.barcode) }}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelFor(null)}>
              Kapat
            </Button>
            <Button onClick={() => labelFor && printLabels([labelFor], 6)}>
              <Printer className="mr-2 size-4" /> 6 Etiket Bas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
