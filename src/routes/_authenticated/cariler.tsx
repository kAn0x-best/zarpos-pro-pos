import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Plus, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { dateTimeTR, money, num } from "@/lib/format";
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

export const Route = createFileRoute("/_authenticated/cariler")({
  head: () => ({
    meta: [
      { title: "Cariler — ZarSoft" },
      {
        name: "description",
        content: "Müşteri ve tedarikçi kartları, borç-alacak bakiyeleri ve detaylı cari ekstre.",
      },
      { property: "og:title", content: "Cariler — ZarSoft" },
      { property: "og:description", content: "Cari hesap yönetimi ve ekstre görünümü." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CarilerPage,
});

type Contact = {
  id: string;
  type: string;
  name: string;
  tax_office: string | null;
  tax_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  balance: number;
};

type Tx = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  reference: string | null;
  created_at: string;
};

const emptyForm = {
  type: "customer",
  name: "",
  tax_office: "",
  tax_number: "",
  phone: "",
  email: "",
  address: "",
};

function CarilerPage() {
  const { me } = useAuth();
  const companyId = me?.companyId ?? null;
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "customer" | "supplier">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState({ type: "debit", amount: "0", description: "" });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("contact_id", selectedId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });

  const list = useMemo(() => {
    const q = term.trim().toLocaleLowerCase("tr");
    let arr = filter === "all" ? contacts : contacts.filter((c) => c.type === filter);
    if (q)
      arr = arr.filter(
        (c) =>
          c.name.toLocaleLowerCase("tr").includes(q) ||
          (c.phone ?? "").includes(q) ||
          (c.tax_number ?? "").includes(q),
      );
    return arr;
  }, [contacts, filter, term]);

  const statement = useMemo(() => {
    let running = 0;
    return txs.map((t) => {
      const amt = num(t.amount);
      running += t.type === "debit" ? amt : -amt;
      return { ...t, running };
    });
  }, [txs]);

  const totals = useMemo(() => {
    const debit = txs.filter((t) => t.type === "debit").reduce((a, t) => a + num(t.amount), 0);
    const credit = txs.filter((t) => t.type !== "debit").reduce((a, t) => a + num(t.amount), 0);
    return { debit, credit, balance: debit - credit };
  }, [txs]);

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      type: c.type,
      name: c.name,
      tax_office: c.tax_office ?? "",
      tax_number: c.tax_number ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!companyId) return;
    if (!form.name.trim()) {
      toast.error("Cari adı gerekli.");
      return;
    }
    const payload = {
      company_id: companyId,
      type: form.type,
      name: form.name.trim(),
      tax_office: form.tax_office.trim() || null,
      tax_number: form.tax_number.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("contacts").update(payload).eq("id", editing.id)
      : await supabase.from("contacts").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Cari güncellendi." : "Cari eklendi.");
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["contacts"] });
  }

  async function saveTx() {
    if (!companyId || !selected) return;
    const amount = num(txForm.amount);
    if (amount <= 0) {
      toast.error("Tutar sıfırdan büyük olmalı.");
      return;
    }
    const { error } = await supabase.from("transactions").insert({
      company_id: companyId,
      contact_id: selected.id,
      type: txForm.type,
      amount,
      description: txForm.description.trim() || null,
      reference: "manual",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const newBalance =
      num(selected.balance) + (txForm.type === "debit" ? amount : -amount);
    await supabase.from("contacts").update({ balance: newBalance }).eq("id", selected.id);
    toast.success("Hareket kaydedildi.");
    setTxOpen(false);
    setTxForm({ type: "debit", amount: "0", description: "" });
    void queryClient.invalidateQueries({ queryKey: ["transactions", selected.id] });
    void queryClient.invalidateQueries({ queryKey: ["contacts"] });
  }

  function printStatement() {
    if (!selected) return;
    const rows = statement
      .map(
        (t) => `<tr>
          <td>${dateTimeTR(t.created_at)}</td>
          <td>${t.description ?? "-"}</td>
          <td class="right">${t.type === "debit" ? money(t.amount) : "-"}</td>
          <td class="right">${t.type !== "debit" ? money(t.amount) : "-"}</td>
          <td class="right">${money(t.running)}</td>
        </tr>`,
      )
      .join("");
    printHtml(
      `<h1>Cari Ekstre — ${selected.name}</h1>
       <p class="muted">${me?.company?.name ?? ""} · ${dateTimeTR(new Date())}</p>
       <table><thead><tr><th>Tarih</th><th>Açıklama</th><th class="right">Borç</th><th class="right">Alacak</th><th class="right">Bakiye</th></tr></thead>
       <tbody>${rows || `<tr><td colspan="5">Hareket yok.</td></tr>`}</tbody></table>
       <table class="totals"><tbody>
         <tr><td>Toplam Borç</td><td class="right">${money(totals.debit)}</td></tr>
         <tr><td>Toplam Alacak</td><td class="right">${money(totals.credit)}</td></tr>
         <tr><td><strong>Bakiye</strong></td><td class="right"><strong>${money(totals.balance)}</strong></td></tr>
       </tbody></table>`,
      "Cari Ekstre",
    );
  }

  return (
    <AppShell
      title="Cariler"
      subtitle={`${contacts.length} cari kaydı`}
      actions={
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1 size-4" /> Cari
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Cari ara…"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "customer", "supplier"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "Tümü" : f === "customer" ? "Müşteri" : "Tedarikçi"}
              </Button>
            ))}
          </div>
          <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 ${
                  selectedId === c.id ? "bg-muted" : ""
                }`}
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.type === "customer" ? "Müşteri" : "Tedarikçi"} · {c.phone ?? "-"}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    num(c.balance) > 0 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {money(c.balance)}
                </span>
              </button>
            ))}
            {!list.length && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {isLoading ? "Yükleniyor…" : "Kayıt yok."}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          {!selected ? (
            <p className="p-10 text-center text-muted-foreground">
              Ekstre görmek için soldan bir cari seçin.
            </p>
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selected.tax_office ?? "-"} / {selected.tax_number ?? "-"} ·{" "}
                    {selected.email ?? "-"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(selected)}>
                    Düzenle
                  </Button>
                  <Button size="sm" variant="outline" onClick={printStatement}>
                    <Printer className="mr-1 size-4" /> Ekstre
                  </Button>
                  <Button size="sm" onClick={() => setTxOpen(true)}>
                    <Plus className="mr-1 size-4" /> Hareket
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowUpRight className="size-3" /> Toplam Borç
                  </p>
                  <p className="text-lg font-semibold">{money(totals.debit)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowDownLeft className="size-3" /> Toplam Alacak
                  </p>
                  <p className="text-lg font-semibold">{money(totals.credit)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Bakiye</p>
                  <p
                    className={`text-lg font-bold ${
                      totals.balance > 0 ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {money(totals.balance)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      <th className="p-3">Tarih</th>
                      <th className="p-3">Açıklama</th>
                      <th className="p-3 text-right">Borç</th>
                      <th className="p-3 text-right">Alacak</th>
                      <th className="p-3 text-right">Bakiye</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {statement.map((t) => (
                      <tr key={t.id}>
                        <td className="p-3 whitespace-nowrap">{dateTimeTR(t.created_at)}</td>
                        <td className="p-3">{t.description ?? "-"}</td>
                        <td className="p-3 text-right">
                          {t.type === "debit" ? money(t.amount) : "-"}
                        </td>
                        <td className="p-3 text-right">
                          {t.type !== "debit" ? money(t.amount) : "-"}
                        </td>
                        <td className="p-3 text-right font-medium">{money(t.running)}</td>
                      </tr>
                    ))}
                    {!statement.length && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          Hareket yok.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Cari Kartı" : "Yeni Cari"}</DialogTitle>
            <DialogDescription>Müşteri veya tedarikçi bilgilerini girin.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Tip</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Müşteri</SelectItem>
                  <SelectItem value="supplier">Tedarikçi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Ünvan / Ad</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Vergi Dairesi</Label>
              <Input
                value={form.tax_office}
                onChange={(e) => setForm({ ...form, tax_office: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Vergi / TC No</Label>
              <Input
                value={form.tax_number}
                onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>E-posta</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Adres</Label>
              <Textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
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

      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cari Hareketi</DialogTitle>
            <DialogDescription>{selected?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Tip</Label>
              <Select value={txForm.type} onValueChange={(v) => setTxForm({ ...txForm, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Borç (Satış / Fatura)</SelectItem>
                  <SelectItem value="credit">Alacak (Tahsilat / Ödeme)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tutar</Label>
              <Input
                value={txForm.amount}
                onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Açıklama</Label>
              <Input
                value={txForm.description}
                onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={saveTx}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
