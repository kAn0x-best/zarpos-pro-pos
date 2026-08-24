import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { seedSuperAdmin } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Giriş Yap — ZarSoft" },
      { name: "description", content: "ZarSoft ön muhasebe ve POS sistemine güvenli giriş yapın." },
      { property: "og:title", content: "Giriş Yap — ZarSoft" },
      { property: "og:description", content: "ZarSoft hesabınıza giriş yapın." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    seedSuperAdmin().catch(() => undefined);
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast.error("Giriş başarısız", { description: "E-posta veya şifre hatalı." });
      return;
    }
    toast.success("Hoş geldiniz!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-nav p-10 text-nav-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary font-display text-xl font-bold text-primary-foreground">
            Z
          </div>
          <div>
            <p className="font-display text-2xl font-bold">ZarSoft</p>
            <p className="text-xs text-nav-muted">Ön Muhasebe & Barkodlu POS</p>
          </div>
        </div>
        <div className="max-w-md">
          <h2 className="font-display text-3xl leading-tight font-bold">
            İşletmenizin muhasebesi ve kasası tek panelde.
          </h2>
          <ul className="mt-6 space-y-2 text-sm text-nav-muted">
            <li>• Barkodlu hızlı kasa satışı ve termal fiş</li>
            <li>• Cari, stok, fatura ve gider takibi</li>
            <li>• Z-Raporu, vardiya ve otomatik yedekleme</li>
          </ul>
        </div>
        <p className="text-xs text-nav-muted">© {new Date().getFullYear()} ZarSoft</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="zar-card w-full max-w-sm p-7">
          <h1 className="font-display text-2xl font-bold">Giriş Yap</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hesabınız yöneticiniz tarafından oluşturulur.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-posta</Label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  required
                  className="pl-9"
                  placeholder="ornek@firma.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Şifre</Label>
              <div className="relative">
                <LockKeyhole className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  required
                  className="pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Giriş Yap
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
