import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZarSoft — Ön Muhasebe ve Barkodlu POS Satış Sistemi" },
      {
        name: "description",
        content:
          "ZarSoft: çok kiracılı ön muhasebe, cari takibi, stok ve barkodlu POS kasa satış sistemi.",
      },
      { property: "og:title", content: "ZarSoft — Ön Muhasebe ve Barkodlu POS" },
      {
        property: "og:description",
        content: "Cari, stok, fatura, gider ve barkodlu kasa satışı tek panelde.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-nav">
      <div className="text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-primary font-display text-2xl font-bold text-primary-foreground">
          Z
        </div>
        <p className="mt-4 font-display text-xl font-bold text-nav-foreground">ZarSoft</p>
        <p className="mt-1 text-sm text-nav-muted">Yükleniyor…</p>
      </div>
    </div>
  );
}
