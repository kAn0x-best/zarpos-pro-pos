import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Clock,
  FileText,
  Plus,
  ScanBarcode,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { money, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Gösterge Paneli — ZarSoft" },
      { name: "description", content: "Kasa bakiyesi, aylık gelir-gider ve nakit akışı özeti." },
      { property: "og:title", content: "Gösterge Paneli — ZarSoft" },
      { property: "og:description", content: "İşletmenizin finansal özeti." },
    ],
  }),
  component: DashboardPage,
});

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function DashboardPage() {
  const { me } = useAuth();
  const companyId = me?.companyId ?? null;

  const { data } = useQuery({
    queryKey: ["dashboard", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 5, 1);
      const sinceIso = since.toISOString().slice(0, 10);

      const [sales, expenses, invoices, contacts] = await Promise.all([
        supabase.from("sales").select("total, paid_cash, paid_card, created_at"),
        supabase.from("expenses").select("amount, expense_date").gte("expense_date", sinceIso),
        supabase.from("invoices").select("total, status, due_date"),
        supabase.from("contacts").select("balance, type"),
      ]);

      return {
        sales: sales.data ?? [],
        expenses: expenses.data ?? [],
        invoices: invoices.data ?? [],
        contacts: contacts.data ?? [],
      };
    },
  });

  const now = new Date();
  const thisMonth = monthKey(now);

  const monthlyIncome = (data?.sales ?? [])
    .filter((s) => monthKey(new Date(s.created_at)) === thisMonth)
    .reduce((a, s) => a + num(s.total), 0);

  const monthlyExpense = (data?.expenses ?? [])
    .filter((e) => (e.expense_date ?? "").startsWith(thisMonth))
    .reduce((a, e) => a + num(e.amount), 0);

  const cashBalance = (data?.sales ?? []).reduce(
    (a, s) => a + num(s.paid_cash) + num(s.paid_card),
    0,
  );

  const overdue = (data?.invoices ?? [])
    .filter(
      (i) =>
        i.status !== "paid" && i.due_date && new Date(i.due_date) < now && i.status !== "cancelled",
    )
    .reduce((a, i) => a + num(i.total), 0);

  const chart = Array.from({ length: 6 }).map((_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    const key = monthKey(d);
    return {
      ay: d.toLocaleDateString("tr-TR", { month: "short" }),
      Gelir: (data?.sales ?? [])
        .filter((s) => monthKey(new Date(s.created_at)) === key)
        .reduce((a, s) => a + num(s.total), 0),
      Gider: (data?.expenses ?? [])
        .filter((e) => (e.expense_date ?? "").startsWith(key))
        .reduce((a, e) => a + num(e.amount), 0),
    };
  });

  const kpis = [
    {
      label: "Toplam Kasa / Banka",
      value: money(cashBalance),
      icon: Banknote,
      tone: "text-primary",
    },
    { label: "Aylık Gelir", value: money(monthlyIncome), icon: ArrowUpRight, tone: "text-success" },
    {
      label: "Aylık Gider",
      value: money(monthlyExpense),
      icon: ArrowDownRight,
      tone: "text-destructive",
    },
    { label: "Gecikmiş Tahsilat", value: money(overdue), icon: Clock, tone: "text-warning" },
  ];

  return (
    <AppShell title="Gösterge Paneli" subtitle={me?.company?.name ?? "ZarSoft"}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="zar-card p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">{k.label}</p>
              <k.icon className={`size-5 ${k.tone}`} />
            </div>
            <p className="mt-3 font-display text-2xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="zar-card p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Nakit Akışı</h2>
          <p className="text-sm text-muted-foreground">Son 6 ay gelir / gider karşılaştırması</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="gGelir" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGider" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-4)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-chart-4)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="ay" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={70} />
                <Tooltip
                  formatter={(v: number | string) => money(Number(v))}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Gelir"
                  stroke="var(--color-chart-2)"
                  fill="url(#gGelir)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Gider"
                  stroke="var(--color-chart-4)"
                  fill="url(#gGider)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="zar-card p-5">
          <h2 className="font-display text-lg font-semibold">Hızlı İşlemler</h2>
          <div className="mt-4 grid gap-3">
            <QuickAction to="/pos" icon={ScanBarcode} label="POS Satış Ekranı" primary />
            <QuickAction to="/faturalar" icon={FileText} label="Yeni Fatura Kes" />
            <QuickAction to="/cariler" icon={Plus} label="Tahsilat Ekle" />
            <QuickAction to="/cariler" icon={Users} label="Cari Ekle" />
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">Toplam Cari Bakiye</p>
            <p className="mt-1 font-display text-xl font-bold">
              {money((data?.contacts ?? []).reduce((a, c) => a + num(c.balance), 0))}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  primary,
}: {
  to: string;
  icon: typeof Plus;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={
        primary
          ? "flex items-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          : "flex items-center gap-3 rounded-md border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
      }
    >
      <Icon className="size-[18px]" />
      {label}
    </Link>
  );
}
