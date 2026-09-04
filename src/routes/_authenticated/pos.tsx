import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CreditCard,
  Landmark,
  LockKeyhole,
  Minus,
  Plus,
  Printer,
  ScanBarcode,
  Split,
  Trash2,
  UnlockKeyhole,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { dateTimeTR, downloadJson, money, num } from "@/lib/format";
import { buildReceiptText, printReceiptText, type ReceiptData } from "@/lib/receipt";
import {
  ensureAccounts,
  postSalePayments,
  postShiftClosing,
  pickAccount,
  type Account,
} from "@/lib/accounts";
import { createBackup, verifyBackup } from "@/lib/backup";
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


export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "POS Kasa — ZarSoft" },
      { name: "description", content: "Barkod okuyucu ile hızlı satış, ödeme ve termal fiş yazdırma." },
      { property: "og:title", content: "POS Kasa — ZarSoft" },
      { property: "og:description", content: "Barkodlu hızlı satış ekranı." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PosPage,
});

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  sale_price: number;
  vat_rate: number;
  stock: number;
  unit: string;
};

type CartLine = {
  productId: string | null;
  name: string;
  barcode: string | null;
  qty: number;
  unitPrice: number;
  vatRate: number;
  discount: number;
};

type PayMode = "cash" | "card" | "split" | "credit";

function PosPage() {
  const { me } = useAuth();
  const companyId = me?.companyId ?? null;
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [mode, setMode] = useState<PayMode>("cash");
  const [cashInput, setCashInput] = useState("");
  const [cardInput, setCardInput] = useState("");
  const [contactId, setContactId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, barcode, sale_price, vat_rate, stock, unit")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["pos-contacts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, type, balance")
        .order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = term.trim().toLocaleLowerCase("tr");
    if (!q) return products.slice(0, 24);
    return products
      .filter((p) => p.name.toLocaleLowerCase("tr").includes(q) || (p.barcode ?? "").includes(q))
      .slice(0, 24);
  }, [products, term]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let vatTotal = 0;
    let discount = 0;
    for (const l of cart) {
      const gross = l.qty * l.unitPrice - l.discount;
      const net = gross / (1 + num(l.vatRate) / 100);
      subtotal += net;
      vatTotal += gross - net;
      discount += l.discount;
    }
    const total = subtotal + vatTotal;
    return { subtotal, vatTotal, discount, total };
  }, [cart]);

  function addProduct(p: Product) {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i]!, qty: next[i]!.qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          barcode: p.barcode,
          qty: 1,
          unitPrice: num(p.sale_price),
          vatRate: num(p.vat_rate),
          discount: 0,
        },
      ];
    });
  }

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    const code = term.trim();
    if (!code) return;
    const hit =
      products.find((p) => p.barcode === code) ??
      products.find((p) => p.name.toLocaleLowerCase("tr") === code.toLocaleLowerCase("tr"));
    if (hit) {
      addProduct(hit);
      setTerm("");
    } else if (filtered.length === 1) {
      addProduct(filtered[0]!);
      setTerm("");
    } else {
      toast.error("Barkod bulunamadı: " + code);
    }
  }

  function setQty(idx: number, qty: number) {
    setCart((prev) =>
      prev.flatMap((l, i) => (i === idx ? (qty <= 0 ? [] : [{ ...l, qty }]) : [l])),
    );
  }

  function openPay() {
    if (!cart.length) { toast.error("Sepet boş."); return; }
    setMode("cash");
    setCashInput(totals.total.toFixed(2));
    setCardInput("");
    setContactId("");
    setPayOpen(true);
  }

  const paidCash =
    mode === "cash" ? Math.min(num(cashInput), totals.total) : mode === "split" ? num(cashInput) : 0;
  const paidCard = mode === "card" ? totals.total : mode === "split" ? num(cardInput) : 0;
  const paidCredit = mode === "credit" ? totals.total : 0;
  const tendered = mode === "cash" ? num(cashInput) : 0;
  const covered = paidCash + paidCard + paidCredit;
  const change = mode === "cash" ? Math.max(0, tendered - totals.total) : 0;
  const remaining = Math.max(0, Math.round((totals.total - covered) * 100) / 100);

  async function completeSale() {
    if (!companyId) return;
    if (mode === "credit" && !contactId) { toast.error("Veresiye için cari seçin."); return; }
    if (mode === "split" && remaining > 0.009) { toast.error("Ödeme tutarı eksik."); return; }
    setSaving(true);
    try {
      const receiptNo = `F${Date.now().toString().slice(-8)}`;
      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          company_id: companyId,
          cashier_id: me?.userId ?? null,
          contact_id: contactId || null,
          receipt_no: receiptNo,
          subtotal: Number(totals.subtotal.toFixed(2)),
          discount: Number(totals.discount.toFixed(2)),
          vat_total: Number(totals.vatTotal.toFixed(2)),
          total: Number(totals.total.toFixed(2)),
          payment_method: mode,
          paid_cash: Number(paidCash.toFixed(2)),
          paid_card: Number(paidCard.toFixed(2)),
          paid_credit: Number(paidCredit.toFixed(2)),
        })
        .select("id")
        .single();
      if (error) throw error;

      const items = cart.map((l) => ({
        company_id: companyId,
        sale_id: sale!.id,
        product_id: l.productId,
        name: l.name,
        barcode: l.barcode,
        qty: l.qty,
        unit_price: l.unitPrice,
        discount: l.discount,
        vat_rate: l.vatRate,
        total: Number((l.qty * l.unitPrice - l.discount).toFixed(2)),
      }));
      const { error: itemErr } = await supabase.from("sale_items").insert(items);
      if (itemErr) throw itemErr;

      // Stok düşümü
      for (const l of cart) {
        if (!l.productId) continue;
        const p = products.find((x) => x.id === l.productId);
        if (!p) continue;
        await supabase
          .from("products")
          .update({ stock: num(p.stock) - l.qty })
          .eq("id", l.productId);
      }

      // Veresiye → cari borç hareketi
      if (paidCredit > 0 && contactId) {
        const c = contacts.find((x) => x.id === contactId);
        await supabase.from("transactions").insert({
          company_id: companyId,
          contact_id: contactId,
          type: "debit",
          amount: Number(paidCredit.toFixed(2)),
          description: "Veresiye satış",
          reference: receiptNo,
        });
        await supabase
          .from("contacts")
          .update({ balance: num(c?.balance) + paidCredit })
          .eq("id", contactId);
      }

      const data: ReceiptData = {
        companyName: me?.company?.name ?? "ZarSoft",
        taxOffice: me?.company?.tax_office ?? null,
        taxNumber: me?.company?.tax_number ?? null,
        address: me?.company?.address ?? null,
        phone: me?.company?.phone ?? null,
        receiptNo,
        cashier: me?.fullName ?? "",
        createdAt: new Date(),
        lines: cart.map((l) => ({
          name: l.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
          total: l.qty * l.unitPrice - l.discount,
          vatRate: l.vatRate,
        })),
        subtotal: totals.subtotal,
        discount: totals.discount,
        vatTotal: totals.vatTotal,
        total: totals.total,
        paidCash,
        paidCard,
        paidCredit,
        change,
        customerName: contacts.find((c) => c.id === contactId)?.name ?? null,
      };
      setReceipt(buildReceiptText(data));
      setCart([]);
      setPayOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      toast.success("Satış tamamlandı: " + receiptNo);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const modes: { id: PayMode; label: string; icon: typeof Banknote }[] = [
    { id: "cash", label: "Nakit", icon: Banknote },
    { id: "card", label: "Kredi Kartı", icon: CreditCard },
    { id: "split", label: "Parçalı", icon: Split },
    { id: "credit", label: "Veresiye", icon: UserPlus },
  ];

  return (
    <AppShell title="POS Kasa" subtitle="Barkod okutun veya ürün seçin">
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <form onSubmit={onScan} className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Barkod okut veya ürün ara…"
                className="h-12 pl-9 text-base"
                autoComplete="off"
              />
            </div>
            <Button type="submit" className="h-12 px-6">
              Ekle
            </Button>
          </form>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary"
              >
                <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{p.barcode ?? "barkodsuz"}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-semibold text-primary">{money(p.sale_price)}</span>
                  <span
                    className={
                      num(p.stock) <= 0 ? "text-xs text-destructive" : "text-xs text-muted-foreground"
                    }
                  >
                    {num(p.stock)} {p.unit}
                  </span>
                </div>
              </button>
            ))}
            {!filtered.length && (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                Ürün bulunamadı.
              </p>
            )}
          </div>
        </div>

        <div className="flex h-fit flex-col rounded-lg border bg-card lg:sticky lg:top-20">
          <div className="border-b px-4 py-3 font-semibold">Sepet ({cart.length})</div>
          <div className="max-h-[45vh] divide-y overflow-y-auto">
            {cart.map((l, i) => (
              <div key={i} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{l.name}</p>
                  <button onClick={() => setQty(i, 0)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="size-7" onClick={() => setQty(i, l.qty - 1)}>
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{l.qty}</span>
                    <Button size="icon" variant="outline" className="size-7" onClick={() => setQty(i, l.qty + 1)}>
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <span className="text-sm font-semibold">{money(l.qty * l.unitPrice - l.discount)}</span>
                </div>
              </div>
            ))}
            {!cart.length && <p className="p-6 text-center text-sm text-muted-foreground">Sepet boş</p>}
          </div>
          <div className="space-y-1 border-t p-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Ara Toplam</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>KDV</span>
              <span>{money(totals.vatTotal)}</span>
            </div>
            <div className="flex justify-between pt-1 text-lg font-bold">
              <span>Toplam</span>
              <span>{money(totals.total)}</span>
            </div>
            <Button className="mt-3 h-12 w-full text-base" onClick={openPay}>
              Ödeme Al
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ödeme — {money(totals.total)}</DialogTitle>
            <DialogDescription>Ödeme yöntemini seçin ve satışı tamamlayın.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-2">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex flex-col items-center gap-1 rounded-md border p-3 text-xs ${
                  mode === m.id ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"
                }`}
              >
                <m.icon className="size-4" />
                {m.label}
              </button>
            ))}
          </div>

          {mode === "cash" && (
            <div className="space-y-2">
              <Label>Alınan Nakit</Label>
              <Input value={cashInput} onChange={(e) => setCashInput(e.target.value)} inputMode="decimal" />
              <div className="flex gap-2">
                {[50, 100, 200, 500].map((v) => (
                  <Button key={v} size="sm" variant="outline" onClick={() => setCashInput(String(v))}>
                    {v} ₺
                  </Button>
                ))}
              </div>
              <p className="text-sm">
                Para üstü: <strong>{money(change)}</strong>
              </p>
            </div>
          )}

          {mode === "split" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nakit</Label>
                <Input value={cashInput} onChange={(e) => setCashInput(e.target.value)} inputMode="decimal" />
              </div>
              <div className="space-y-1">
                <Label>Kart</Label>
                <Input value={cardInput} onChange={(e) => setCardInput(e.target.value)} inputMode="decimal" />
              </div>
              <p className="col-span-2 text-sm text-muted-foreground">
                Kalan: <strong>{money(remaining)}</strong>
              </p>
            </div>
          )}

          {(mode === "credit" || mode === "split") && (
            <div className="space-y-1">
              <Label>Cari {mode === "credit" ? "(zorunlu)" : "(opsiyonel)"}</Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Seçiniz…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({money(c.balance)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={completeSale} disabled={saving}>
              {saving ? "Kaydediliyor…" : "Satışı Tamamla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fiş Önizleme</DialogTitle>
            <DialogDescription>ESC/POS uyumlu 80mm termal fiş.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[50vh] overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] whitespace-pre">
            {receipt}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceipt(null)}>
              Kapat
            </Button>
            <Button onClick={() => receipt && printReceiptText(receipt)}>
              <Printer className="mr-2 size-4" /> Yazdır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
