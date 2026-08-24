import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ScanBarcode,
  Package,
  Users,
  FileText,
  Receipt,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; show: boolean };

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items: NavItem[] = [
    {
      to: "/dashboard",
      label: "Gösterge Paneli",
      icon: LayoutDashboard,
      show: !auth.isCashierOnly,
    },
    { to: "/pos", label: "POS Kasa", icon: ScanBarcode, show: auth.canPos },
    { to: "/stok", label: "Stok & Barkod", icon: Package, show: true },
    { to: "/cariler", label: "Cariler", icon: Users, show: auth.canAccounting },
    { to: "/faturalar", label: "Faturalar", icon: FileText, show: auth.canAccounting },
    { to: "/giderler", label: "Giderler", icon: Receipt, show: auth.canAccounting },
    { to: "/ayarlar", label: "Ayarlar", icon: Settings, show: auth.canSettings },
    { to: "/super-admin", label: "Süper Admin", icon: ShieldCheck, show: auth.isSuperAdmin },
  ];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <nav className="flex h-full flex-col bg-nav text-nav-foreground">
      <div className="flex items-center gap-2 border-b border-nav-border px-5 py-4">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary font-display text-lg font-bold text-primary-foreground">
          Z
        </div>
        <div>
          <p className="font-display text-lg leading-none font-bold">ZarSoft</p>
          <p className="text-[11px] text-nav-muted">Ön Muhasebe & POS</p>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {items
          .filter((i) => i.show)
          .map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-nav-muted hover:bg-nav-hover hover:text-nav-foreground",
                )}
              >
                <item.icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
      </div>

      <div className="border-t border-nav-border p-3">
        {auth.me?.company && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-nav-hover px-3 py-2">
            <Building2 className="size-4 text-nav-muted" />
            <span className="truncate text-xs text-nav-foreground">{auth.me.company.name}</span>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-nav-muted transition-colors hover:bg-nav-hover hover:text-nav-foreground"
        >
          <LogOut className="size-[18px]" />
          Çıkış Yap
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 w-64">{nav}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{nav}</div>
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 rounded-md bg-nav p-2 text-nav-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 bg-nav px-4 py-3 text-nav-foreground lg:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="size-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-base font-semibold sm:text-lg">{title}</h1>
            {subtitle && <p className="truncate text-xs text-nav-muted">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium">{auth.me?.fullName}</p>
              <p className="text-[11px] text-nav-muted">
                {auth.roles.map((r) => ROLE_LABELS[r]).join(", ")}
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
