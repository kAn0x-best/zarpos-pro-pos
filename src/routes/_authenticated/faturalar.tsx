import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { dateTR, money, num, downloadJson } from "@/lib/format";
import { printHtml } from "@/lib/receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/faturalar")({
  head: () => ({
    meta: [
      { title: "Faturalar — ZarSoft" },
      {
        name: "description",
        content: "Satış ve alış faturaları oluşturun; KDV, tevkifat hesabı, durum takibi ve yazdırma.",
      },
      { property: "og:title", content: "Faturalar — ZarSoft" },
      { property: "og:description", content: "Fatura oluşturma, KDV/tevkifat ve yazdırma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FaturalarPage,
});

type Contact = { id: string; name: string; type: string; tax_office: string | null; tax_number: string | null; address: string | null };
type Product = { id: string; name: string; sale_price: number; vat_rate: number };
type Invoice = {
  id: string;
  invoice_no: string;
  direction: string;
  issue_date: string;
  due_date: string | null;
  status: string;
  subtotal: number;
  vat_total: number;
  withholding: number;
  total: number;
  notes: string | null;
  contact_id: string | null;
};
type Item = { name: string; qty: string; unit_price: string; vat_rate: string; product_id: string | null };

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Taslak", cls: "bg-muted text-muted-foreground" },
  sent: { label: "Gönderildi", cls: "bg-primary/10 text-primary" },
  paid: { label: "Ödendi", cls: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "Gecikmiş", cls: "bg-destructive/10 text-destructive" },
  cancelled: { label: "İptal", cls: "bg-muted text-muted-foreground line-through" },
};

const WITHHOLDING_RATES = [
  { value: "0", label: "Yok" },
  { value: "0.2", label: "2/10" },
  { value: "0.3", label: "3/10" },
  { value: "0.5", label: "5/10" },
  { value: "0.7", label: "7/10" },
  { value: "0.9", label: "9/10" },
];

const emptyItem: Item = { name: "", qty: "1", unit_price: "0", vat_rate: "20", product_id: null };

function FaturalarPage() {
  const { me } = useAuth();
  const companyId = me?.companyId ?? null;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState("sales");
  const [contactId, setContactId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("draft");
  const [withholdingRate, setWithholdingRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ ...emptyItem }]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sale_price, vat_rate")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const calc = useMemo(() => {
    let subtotal = 0;
    let vatTotal = 0;
    const lines = items.map((it) => {
      const line = num(it.qty) * num(it.unit_price);
      const vat = (line * num(it.vat_rate)) / 100;
      subtotal += line;
      vatTotal += vat;
      return { ...it, line, vat };
    });
    const withholding = vatTotal * num(withholdingRate);
    return {
      lines,
      subtotal,
      vatTotal,
      withholding,
      total: subtotal + vatTotal - withholding,
    };
  }, [items, withholdingRate]);

  function resetForm() {
    setDirection("sales");
    setContactId("");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setStatus("draft");
    setWithholdingRate("0");
    setNotes("");
    setItems([{ ...emptyItem }]);
  }

  function pickProduct(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              product_id: p.id,
              name: p.name,
              unit_price: String(num(p.sale_price)),
              vat_rate: String(num(p.vat_rate)),
            }
          : it,
      ),
    );
  }

  async function saveInvoice() {
    if (!companyId) return;
    const valid = items.filter((i) => i.name.trim() && num(i.qty) > 0);
    if (!valid.length) {
      toast.error("En az bir kalem girin.");
      return;
    }
    setSaving(true);
    try {
      const invoiceNo = `${direction === "sales" ? "SF" : "AF"}${Date.now().toString().slice(-8)}`;
      const { data: inv, error } = await supabase
        .from("invoices")
        .insert({
          company_id: companyId,
          contact_id: contactId || null,
          invoice_no: invoiceNo,
          direction,
          issue_date: issueDate,
          due_date: dueDate || null,
          status,
          subtotal: Number(calc.subtotal.toFixed(2)),
          vat_total: Number(calc.vatTotal.toFixed(2)),
          withholding: Number(calc.withholding.toFixed(2)),
          total: Number(calc.total.toFixed(2)),
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const rows = valid.map((it) => ({
        company_id: companyId,
        invoice_id: inv.id,
        product_id: it.product_id,
        name: it.name.trim(),
        qty: num(it.qty),
        unit_price: num(it.unit_price),
        vat_rate: num(it.vat_rate),
        total: Number((num(it.qty) * num(it.unit_price)).toFixed(2)),
      }));
      const { error: itemErr } = await supabase.from("invoice_items").insert(rows);
      if (itemErr) throw itemErr;

      if (contactId && direction === "sales") {
        await supabase.from("transactions").insert({
          company_id: companyId,
          contact_id: contactId,
          type: "debit",
          amount: Number(calc.total.toFixed(2)),
          description: `Fatura ${invoiceNo}`,
          reference: invoiceNo,
        });
      }

      toast.success(`Fatura oluşturuldu: ${invoiceNo}`);
      setOpen(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fatura kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(inv: Invoice, next: string) {
    const { error } = await supabase.from("invoices").update({ status: next }).eq("id", inv.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
  }

  async function loadItems(invoiceId: string) {
    const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId);
    return data ?? [];
  }

  async function printInvoice(inv: Invoice) {
    const rows = await loadItems(inv.id);
    const contact = contacts.find((c) => c.id === inv.contact_id);
    const body = rows
      .map(
        (r) => `<tr><td>${r.name}</td><td class="right">${num(r.qty)}</td><td class="right">${money(
          r.unit_price,
        )}</td><td class="right">%${num(r.vat_rate)}</td><td class="right">${money(r.total)}</td></tr>`,
      )
      .join("");
    printHtml(
      `<h1>${inv.direction === "sales" ? "Satış" : "Alış"} Faturası — ${inv.invoice_no}</h1>
       <p class="muted">${me?.company?.name ?? ""} · Tarih: ${dateTR(inv.issue_date)} ${
         inv.due_date ? "· Vade: " + dateTR(inv.due_date) : ""
       }</p>
       <p><span class="label">${STATUS[inv.status]?.label ?? inv.status}</span></p>
       <p class="muted">Cari: ${contact?.name ?? "-"} · ${contact?.tax_office ?? "-"} / ${
         contact?.tax_number ?? "-"
       }</p>
       <table><thead><tr><th>Açıklama</th><th class="right">Miktar</th><th class="right">Birim Fiyat</th><th class="right">KDV</th><th class="right">Tutar</th></tr></thead><tbody>${body}</tbody></table>
       <table class="totals"><tbody>
        <tr><td>Ara Toplam</td><td class="right">${money(inv.subtotal)}</td></tr>
        <tr><td>KDV</td><td class="right">${money(inv.vat_total)}</td></tr>
        <tr><td>Tevkifat</td><td class="right">-${money(inv.withholding)}</td></tr>
        <tr><td><strong>Genel Toplam</strong></td><td class="right"><strong>${money(
          inv.total,
        )}</strong></td></tr>
       </tbody></table>
       ${inv.notes ? `<p class="muted">Not: ${inv.notes}</p>` : ""}`,
      inv.invoice_no,
    );
  }

  async function downloadInvoice(inv: Invoice) {
    const rows = await loadItems(inv.id);
    downloadJson(`${inv.invoice_no}.json`, { invoice: inv, items: rows });
    toast.success("Fatura indirildi.");
  }

  return (
    <AppShell
      title="Faturalar"
      subtitle={`${invoices.length} fatura`}
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1 size-4" /> Fatura
        </Button>
      }
    >
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="p-3">Fatura No</th>
              <th className="p-3">Cari</th>
              <th className="p-3">Tarih</th>
              <th className="p-3">Durum</th>
              <th className="p-3 text-right">Tevkifat</th>
              <th className="p-3 text-right">Toplam</th>
              <th className="p-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-muted/40">
                <td className="p-3 font-medium">
                  {inv.invoice_no}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {inv.direction === "sales" ? "Satış" : "Alış"}
                  </span>
                </td>
                <td className="p-3">
                  {contacts.find((c) => c.id === inv.contact_id)?.name ?? "-"}
                </td>
                <td className="p-3 whitespace-nowrap">{dateTR(inv.issue_date)}</td>
                <td className="p-3">
                  <Select value={inv.status} onValueChange={(v) => changeStatus(inv, v)}>
                    <SelectTrigger className="h-8 w-[140px]">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          STATUS[inv.status]?.cls ?? ""
                        }`}
                      >
                        {STATUS[inv.status]?.label ?? inv.status}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3 text-right">{money(inv.withholding)}</td>
                <td className="p-3 text-right font-semibold">{money(inv.total)}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => printInvoice(inv)}>
                      <Printer className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => downloadInvoice(inv)}>
                      <Download className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!invoices.length && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  {isLoading ? "Yükleniyor…" : "Fatura yok."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Yeni Fatura</DialogTitle>
            <DialogDescription>Cari, kalemler ve KDV/tevkifat bilgilerini girin.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Tür</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Satış Faturası</SelectItem>
                  <SelectItem value="purchase">Alış Faturası</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Cari</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Cari seçin" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Düzenleme Tarihi</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Vade</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Durum</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Kalemler</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setItems((p) => [...p, { ...emptyItem }])}
              >
                <Plus className="mr-1 size-4" /> Kalem
              </Button>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <Select value={it.product_id ?? ""} onValueChange={(v) => pickProduct(idx, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Üründen seç" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  className="sm:col-span-3"
                  placeholder="Açıklama"
                  value={it.name}
                  onChange={(e) =>
                    setItems((p) => p.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                  }
                />
                <Input
                  className="sm:col-span-1"
                  placeholder="Adet"
                  value={it.qty}
                  onChange={(e) =>
                    setItems((p) => p.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))
                  }
                />
                <Input
                  className="sm:col-span-2"
                  placeholder="Fiyat"
                  value={it.unit_price}
                  onChange={(e) =>
                    setItems((p) =>
                      p.map((x, i) => (i === idx ? { ...x, unit_price: e.target.value } : x)),
                    )
                  }
                />
                <Input
                  className="sm:col-span-1"
                  placeholder="KDV"
                  value={it.vat_rate}
                  onChange={(e) =>
                    setItems((p) =>
                      p.map((x, i) => (i === idx ? { ...x, vat_rate: e.target.value } : x)),
                    )
                  }
                />
                <div className="flex justify-end sm:col-span-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>KDV Tevkifatı</Label>
              <Select value={withholdingRate} onValueChange={setWithholdingRate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WITHHOLDING_RATES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                className="mt-2"
                placeholder="Notlar"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="space-y-1 rounded-lg border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ara Toplam</span>
                <span>{money(calc.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">KDV</span>
                <span>{money(calc.vatTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tevkifat</span>
                <span>-{money(calc.withholding)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Genel Toplam</span>
                <span>{money(calc.total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={saveInvoice} disabled={saving}>
              {saving ? "Kaydediliyor…" : "Faturayı Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
