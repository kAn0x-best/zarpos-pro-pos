import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Clock,
  Database,
  Download,
  HardDriveDownload,
  Plus,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { dateTimeTR, downloadJson, ROLE_LABELS } from "@/lib/format";
import { createBackup, backupRowCount, parseBackup, restoreBackup } from "@/lib/backup";
import { createCompanyUser, deleteCompanyUser } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/_authenticated/ayarlar")({
  head: () => ({
    meta: [
      { title: "Ayarlar — ZarSoft" },
      {
        name: "description",
        content:
          "Şirket bilgileri, personel yönetimi ve JSON tabanlı manuel/otomatik yedekleme ayarları.",
      },
      { property: "og:title", content: "Ayarlar — ZarSoft" },
      { property: "og:description", content: "Şirket profili, kullanıcılar ve yedekleme." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AyarlarPage,
});

type Settings = {
  company_id: string;
  auto_backup_enabled: boolean;
  backup_on_zreport: boolean;
  backup_interval_hours: number;
  last_backup_at: string | null;
};

type Staff = { id: string; full_name: string | null; email: string | null; roles: string[] };

const emptyStaff = { fullName: "", email: "", password: "", role: "cashier" as const };

function AyarlarPage() {
  const auth = useAuth();
  const companyId = auth.me?.companyId ?? null;
  const queryClient = useQueryClient();

  return (
    <AppShell title="Ayarlar" subtitle="Şirket, personel ve yedekleme yönetimi">
      {!companyId ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Bu hesap bir şirkete bağlı değil. Süper Admin panelinden şirket seçin.
        </div>
      ) : (
        <Tabs defaultValue="company">
          <TabsList>
            <TabsTrigger value="company">Şirket</TabsTrigger>
            <TabsTrigger value="staff">Personel</TabsTrigger>
            <TabsTrigger value="backup">Yedekleme</TabsTrigger>
          </TabsList>
          <TabsContent value="company" className="mt-4">
            <CompanyTab />
          </TabsContent>
          <TabsContent value="staff" className="mt-4">
            <StaffTab companyId={companyId} queryClient={queryClient} />
          </TabsContent>
          <TabsContent value="backup" className="mt-4">
            <BackupTab companyId={companyId} companyName={auth.me?.company?.name ?? "Şirket"} />
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

function CompanyTab() {
  const auth = useAuth();
  const c = auth.me?.company;
  const [form, setForm] = useState({
    name: "",
    tax_office: "",
    tax_number: "",
    phone: "",
    email: "",
    address: "",
    iban: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!c) return;
    setForm({
      name: c.name ?? "",
      tax_office: c.tax_office ?? "",
      tax_number: c.tax_number ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      iban: c.iban ?? "",
    });
  }, [c?.id]);

  async function save() {
    if (!c) return;
    setSaving(true);
    const { error } = await supabase
      .from("companies")
      .update({
        name: form.name,
        tax_office: form.tax_office || null,
        tax_number: form.tax_number || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        iban: form.iban || null,
      })
      .eq("id", c.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Şirket bilgileri güncellendi.");
    auth.refresh();
  }

  return (
    <div className="max-w-2xl rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="size-5 text-primary" />
        <p className="font-display font-semibold">Şirket Bilgileri</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Ünvan</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label>Vergi Dairesi</Label>
          <Input
            value={form.tax_office}
            onChange={(e) => setForm({ ...form, tax_office: e.target.value })}
          />
        </div>
        <div>
          <Label>Vergi / TC No</Label>
          <Input
            value={form.tax_number}
            onChange={(e) => setForm({ ...form, tax_number: e.target.value })}
          />
        </div>
        <div>
          <Label>Telefon</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label>E-posta</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label>Adres</Label>
          <Input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>IBAN</Label>
          <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
        </div>
      </div>
      <Button className="mt-4" onClick={save} disabled={saving || !auth.canSettings}>
        {saving ? "Kaydediliyor…" : "Kaydet"}
      </Button>
    </div>
  );
}

function StaffTab({
  companyId,
  queryClient,
}: {
  companyId: string;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const auth = useAuth();
  const addUser = useServerFn(createCompanyUser);
  const removeUser = useServerFn(deleteCompanyUser);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    fullName: string;
    email: string;
    password: string;
    role: "firm_admin" | "manager" | "accountant" | "cashier";
  }>(emptyStaff);
  const [busy, setBusy] = useState(false);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff", companyId],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").eq("company_id", companyId),
        supabase.from("user_roles").select("user_id, role").eq("company_id", companyId),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      })) as Staff[];
    },
  });

  async function submit() {
    setBusy(true);
    try {
      await addUser({ data: form });
      toast.success("Personel eklendi.");
      setOpen(false);
      setForm(emptyStaff);
      queryClient.invalidateQueries({ queryKey: ["staff", companyId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Personel eklenemedi.");
    }
    setBusy(false);
  }

  async function remove(id: string) {
    try {
      await removeUser({ data: { userId: id } });
      toast.success("Personel silindi.");
      queryClient.invalidateQueries({ queryKey: ["staff", companyId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Silinemedi.");
    }
  }

  return (
    <div className="max-w-3xl rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <p className="font-display font-semibold">Personel</p>
        <Button size="sm" onClick={() => setOpen(true)} disabled={!auth.canManageStaff}>
          <UserPlus className="size-4" /> Personel Ekle
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-5 py-2.5">Ad Soyad</th>
            <th className="px-5 py-2.5">E-posta</th>
            <th className="px-5 py-2.5">Rol</th>
            <th className="px-5 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-5 py-2.5">{s.full_name ?? "-"}</td>
              <td className="px-5 py-2.5 text-muted-foreground">{s.email ?? "-"}</td>
              <td className="px-5 py-2.5">
                {s.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ") || "-"}
              </td>
              <td className="px-5 py-2.5 text-right">
                {auth.canManageStaff && s.id !== auth.me?.userId && (
                  <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {staff.length === 0 && (
            <tr>
              <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                Personel bulunmuyor.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Personel Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ad Soyad</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label>E-posta</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Şifre (en az 8 karakter)</Label>
              <Input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <Label>Rol</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as typeof form.role })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Kasiyer</SelectItem>
                  <SelectItem value="accountant">Muhasebeci</SelectItem>
                  <SelectItem value="manager">Müdür</SelectItem>
                  <SelectItem value="firm_admin">Şirket Yöneticisi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Ekleniyor…" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BackupTab({ companyId, companyName }: { companyId: string; companyName: string }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"none" | "backup" | "restore">("none");
  const [report, setReport] = useState<{ table: string; inserted: number; error?: string }[]>([]);

  const { data: settings } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) return data as Settings;
      const { data: created } = await supabase
        .from("company_settings")
        .insert({ company_id: companyId })
        .select()
        .single();
      return created as Settings;
    },
  });

  async function patch(values: Partial<Settings>) {
    const { error } = await supabase
      .from("company_settings")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("company_id", companyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
  }

  async function runBackup(auto = false) {
    setBusy("backup");
    try {
      const file = await createBackup(companyId, companyName);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      downloadJson(`zarsoft-yedek-${stamp}.json`, file);
      await patch({ last_backup_at: new Date().toISOString() });
      toast.success(
        `${auto ? "Otomatik yedek" : "Yedek"} indirildi — ${backupRowCount(file)} kayıt.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yedek alınamadı.");
    }
    setBusy("none");
  }

  async function onRestoreFile(file: File) {
    setBusy("restore");
    try {
      const parsed = parseBackup(await file.text());
      const result = await restoreBackup(parsed, companyId);
      setReport(result);
      const failed = result.filter((r) => r.error);
      if (failed.length) toast.warning(`${failed.length} tablo geri yüklenemedi.`);
      else toast.success("Yedek başarıyla geri yüklendi.");
      queryClient.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Geri yükleme başarısız.");
    }
    setBusy("none");
    if (fileRef.current) fileRef.current.value = "";
  }

  // Otomatik yedekleme: sayfa açıkken interval dolduğunda tetiklenir.
  useEffect(() => {
    if (!settings?.auto_backup_enabled) return;
    const hours = Math.max(1, settings.backup_interval_hours || 24);
    const last = settings.last_backup_at ? new Date(settings.last_backup_at).getTime() : 0;
    const check = () => {
      if (Date.now() - last >= hours * 3600_000) void runBackup(true);
    };
    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [settings?.auto_backup_enabled, settings?.backup_interval_hours, settings?.last_backup_at]);

  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Database className="size-5 text-primary" />
          <p className="font-display font-semibold">Manuel Yedekleme</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Cari, stok, satış, fatura ve gider verilerinizin tamamı tek bir JSON dosyasına aktarılır.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Son yedek: {settings?.last_backup_at ? dateTimeTR(settings.last_backup_at) : "Hiç"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => runBackup(false)} disabled={busy !== "none"}>
            <Download className="size-4" />
            {busy === "backup" ? "Hazırlanıyor…" : "Yedeği İndir"}
          </Button>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== "none"}
          >
            <Upload className="size-4" />
            {busy === "restore" ? "Yükleniyor…" : "JSON Geri Yükle"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onRestoreFile(f);
            }}
          />
        </div>
        {report.length > 0 && (
          <div className="mt-4 rounded-md border bg-muted/40 p-3 text-xs">
            <p className="mb-2 font-medium">Geri Yükleme Raporu</p>
            {report.map((r) => (
              <div key={r.table} className="flex justify-between py-0.5">
                <span>{r.table}</span>
                <span className={r.error ? "text-destructive" : "text-muted-foreground"}>
                  {r.error ? r.error : `${r.inserted} kayıt`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <HardDriveDownload className="size-5 text-primary" />
          <p className="font-display font-semibold">Otomatik Yedekleme</p>
        </div>

        <div className="flex items-center justify-between border-b py-3">
          <div>
            <p className="text-sm font-medium">Otomatik yedeklemeyi etkinleştir</p>
            <p className="text-xs text-muted-foreground">Belirlenen saat aralığında yedek alınır.</p>
          </div>
          <Switch
            checked={!!settings?.auto_backup_enabled}
            onCheckedChange={(v) => patch({ auto_backup_enabled: v })}
          />
        </div>

        <div className="flex items-center justify-between border-b py-3">
          <div>
            <p className="text-sm font-medium">Gün sonu Z-Raporunda yedekle</p>
            <p className="text-xs text-muted-foreground">
              Kasa kapatıldığında otomatik yedek indirilir.
            </p>
          </div>
          <Switch
            checked={!!settings?.backup_on_zreport}
            onCheckedChange={(v) => patch({ backup_on_zreport: v })}
          />
        </div>

        <div className="py-3">
          <Label className="flex items-center gap-2">
            <Clock className="size-4" /> Yedek aralığı (saat)
          </Label>
          <Input
            type="number"
            min={1}
            max={168}
            className="mt-1 w-32"
            value={settings?.backup_interval_hours ?? 24}
            onChange={(e) => patch({ backup_interval_hours: Number(e.target.value) || 24 })}
          />
        </div>

        <Button variant="secondary" onClick={() => runBackup(true)} disabled={busy !== "none"}>
          <Plus className="size-4" /> Otomatik yedeği şimdi test et
        </Button>
      </div>
    </div>
  );
}
