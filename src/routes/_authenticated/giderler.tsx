import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Receipt, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { dateTR, money, num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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

export const Route = createFileRoute("/_authenticated/giderler")({
  head: () => ({
    meta: [
      { title: "Giderler — ZarSoft" },
      {
        name: "description",
        content: "Şirket giderlerini kategori bazında kaydedin, filtreleyin ve aylık toplamları izleyin.",
      },
      { property: "og:title", content: "Giderler — ZarSoft" },
      { property: "og:description", content: "Gider kayıtları ve kategori bazlı gider analizi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GiderlerPage,
});

type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
};

const CATEGORIES = [
  "Kira",
  "Personel",
  "Elektrik/Su/Doğalgaz",
  "İnternet/Telefon",
  "Nakliye",
  "Vergi/SGK",
  "Bakım/Onarım",
  "Diğer",
];

const emptyForm = {
  category: "Diğer",
  description: "",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
};

function GiderlerPage() {
  const { me } = useAuth();
  const companyId = me?.companyId ?? null;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, category, description, amount, expense_date")
        .order("expense_date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Expense[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return expenses.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (!q) return true;
      return (
        e.category.toLocaleLowerCase("tr").includes(q) ||
        (e.description ?? "").toLocaleLowerCase("tr").includes(q)
      );
    });
  }, [expenses, search, category]);

  const total = filtered.reduce((s, e) => s + num(e.amount), 0);
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthTotal = expenses
    .filter((e) => e.expense_date.startsWith(monthKey))
    .reduce((s, e) => s + num(e.amount), 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) map.set(e.category, (map.get(e.category) ?? 0) + num(e.amount));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  async function save() {
    if (!companyId) return;
    const amount = Number(form.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Geçerli bir tutar girin.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      company_id: companyId,
      category: form.category,
      description: form.description || null,
      amount,
      expense_date: form.expense_date,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Gider kaydedildi.");
    setOpen(false);
    setForm(emptyForm);
    queryClient.invalidateQueries({ queryKey: ["expenses", companyId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Gider silindi.");
    queryClient.invalidateQueries({ queryKey: ["expenses", companyId] });
  }

  return (
    <AppShell
      title="Giderler"
      subtitle="Kategori bazlı gider takibi"
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Yeni Gider
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Bu Ay</p>
          <p className="font-display text-2xl font-bold">{money(monthTotal)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Filtre Toplamı</p>
          <p className="font-display text-2xl font-bold">{money(total)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Kayıt Sayısı</p>
          <p className="font-display text-2xl font-bold">{filtered.length}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Açıklama veya kategori ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Kategoriler</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Tarih</th>
                <th className="px-4 py-2.5">Kategori</th>
                <th className="px-4 py-2.5">Açıklama</th>
                <th className="px-4 py-2.5 text-right">Tutar</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Yükleniyor…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <Receipt className="mx-auto mb-2 size-8 opacity-40" />
                    Kayıtlı gider bulunamadı.
                  </td>
                </tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-2.5 whitespace-nowrap">{dateTR(e.expense_date)}</td>
                  <td className="px-4 py-2.5">{e.category}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.description ?? "-"}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{money(e.amount)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(e.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 font-display font-semibold">Kategori Dağılımı</p>
          {byCategory.length === 0 && <p className="text-sm text-muted-foreground">Veri yok.</p>}
          <div className="space-y-3">
            {byCategory.map(([name, value]) => (
              <div key={name}>
                <div className="flex justify-between text-xs">
                  <span>{name}</span>
                  <span className="font-medium">{money(value)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${total ? (value / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Gider</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Tutar (₺)</Label>
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Tarih</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Açıklama</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Gider açıklaması"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
