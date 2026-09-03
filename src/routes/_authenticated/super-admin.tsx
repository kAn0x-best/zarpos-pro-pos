import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Plus, ShieldPlus, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { dateTR, money, PLAN_LABELS } from "@/lib/format";
import {
  createCompanyWithAdmin,
  createSuperAdminAccount,
  getGlobalMetrics,
  setCompanyState,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({
    meta: [
      { title: "Süper Admin — ZarSoft" },
      {
        name: "description",
        content: "Platform geneli şirket yönetimi, abonelik planları ve kullanım metrikleri.",
      },
      { property: "og:title", content: "Süper Admin — ZarSoft" },
      { property: "og:description", content: "Çok kiracılı platform yönetim konsolu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperAdminPage,
});

type CompanyRow = {
  id: string;
  name: string;
  tax_number: string | null;
  phone: string | null;
  subscription_plan: string;
  is_active: boolean;
  created_at: string;
};

const emptyCompany = {
  companyName: "",
  taxNumber: "",
  phone: "",
  plan: "trial" as "trial" | "standard" | "pro",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};

function SuperAdminPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const metricsFn = useServerFn(getGlobalMetrics);
  const createCompany = useServerFn(createCompanyWithAdmin);
  const createAdmin = useServerFn(createSuperAdminAccount);
  const setState = useServerFn(setCompanyState);

  const [companyOpen, setCompanyOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [form, setForm] = useState(emptyCompany);
  const [adminForm, setAdminForm] = useState({ fullName: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const { data: metrics } = useQuery({
    queryKey: ["global-metrics"],
    enabled: auth.isSuperAdmin,
    queryFn: () => metricsFn({ data: undefined }),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["all-companies"],
    enabled: auth.isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, tax_number, phone, subscription_plan, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as CompanyRow[];
    },
  });

  if (!auth.isSuperAdmin) {
    return (
      <AppShell title="Süper Admin">
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Bu sayfaya erişim yetkiniz yok.
        </div>
      </AppShell>
    );
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["all-companies"] });
    queryClient.invalidateQueries({ queryKey: ["global-metrics"] });
  }

  async function submitCompany() {
    setBusy(true);
    try {
      await createCompany({ data: form });
      toast.success("Şirket ve yöneticisi oluşturuldu.");
      setCompanyOpen(false);
      setForm(emptyCompany);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Şirket oluşturulamadı.");
    }
    setBusy(false);
  }

  async function submitAdmin() {
    setBusy(true);
    try {
      await createAdmin({ data: adminForm });
      toast.success("Süper admin hesabı oluşturuldu.");
      setAdminOpen(false);
      setAdminForm({ fullName: "", email: "", password: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hesap oluşturulamadı.");
    }
    setBusy(false);
  }

  async function updateCompany(companyId: string, patch: { isActive?: boolean; plan?: "trial" | "standard" | "pro" }) {
    try {
      await setState({ data: { companyId, ...patch } });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Güncellenemedi.");
    }
  }

  const cards = [
    { label: "Şirket", value: String(metrics?.companyCount ?? 0), icon: Building2 },
    { label: "Aktif Şirket", value: String(metrics?.activeCompanies ?? 0), icon: Building2 },
    { label: "Kullanıcı", value: String(metrics?.userCount ?? 0), icon: Users },
    { label: "Toplam Satış Hacmi", value: money(metrics?.salesVolume ?? 0), icon: Wallet },
  ];

  return (
    <AppShell
      title="Süper Admin"
      subtitle="Platform yönetim konsolu"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAdminOpen(true)}>
            <ShieldPlus className="size-4" /> Süper Admin
          </Button>
          <Button size="sm" onClick={() => setCompanyOpen(true)}>
            <Plus className="size-4" /> Yeni Şirket
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <c.icon className="size-4" /> {c.label}
            </div>
            <p className="mt-1 font-display text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Şirket</th>
              <th className="px-4 py-2.5">Vergi No</th>
              <th className="px-4 py-2.5">Kayıt</th>
              <th className="px-4 py-2.5">Plan</th>
              <th className="px-4 py-2.5 text-right">Aktif</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2.5 font-medium">{c.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.tax_number ?? "-"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{dateTR(c.created_at)}</td>
                <td className="px-4 py-2.5">
                  <Select
                    value={c.subscription_plan}
                    onValueChange={(v) =>
                      updateCompany(c.id, { plan: v as "trial" | "standard" | "pro" })
                    }
                  >
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLAN_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) => updateCompany(c.id, { isActive: v })}
                  />
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Henüz şirket kaydı yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={companyOpen} onOpenChange={setCompanyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Şirket ve Yöneticisi</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Şirket Ünvanı</Label>
              <Input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </div>
            <div>
              <Label>Vergi No</Label>
              <Input
                value={form.taxNumber}
                onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Abonelik Planı</Label>
              <Select
                value={form.plan}
                onValueChange={(v) => setForm({ ...form, plan: v as typeof form.plan })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLAN_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Yönetici Adı</Label>
              <Input
                value={form.adminName}
                onChange={(e) => setForm({ ...form, adminName: e.target.value })}
              />
            </div>
            <div>
              <Label>Yönetici E-posta</Label>
              <Input
                type="email"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              />
            </div>
            <div>
              <Label>Şifre (min 8)</Label>
              <Input
                value={form.adminPassword}
                onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={submitCompany} disabled={busy}>
              {busy ? "Oluşturuluyor…" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Süper Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ad Soyad</Label>
              <Input
                value={adminForm.fullName}
                onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>E-posta</Label>
              <Input
                type="email"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Şifre (min 8)</Label>
              <Input
                value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={submitAdmin} disabled={busy}>
              {busy ? "Oluşturuluyor…" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
