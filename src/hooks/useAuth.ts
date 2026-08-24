import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "firm_admin" | "manager" | "accountant" | "cashier";

export type Company = {
  id: string;
  name: string;
  tax_office: string | null;
  tax_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  iban: string | null;
  logo_url: string | null;
  subscription_plan: string;
  is_active: boolean;
};

export type Me = {
  userId: string;
  email: string;
  fullName: string;
  companyId: string | null;
  company: Company | null;
  roles: AppRole[];
};

export const authQueryKey = ["auth-me"] as const;

async function fetchMe(): Promise<Me | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("company_id, full_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  let company: Company | null = null;
  if (profile?.company_id) {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("id", profile.company_id)
      .maybeSingle();
    company = (data as Company) ?? null;
  }

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name ?? (user.user_metadata?.["full_name"] as string) ?? "Kullanıcı",
    companyId: profile?.company_id ?? null,
    company,
    roles: ((roleRows ?? []).map((r) => r.role) as AppRole[]) ?? [],
  };
}

export function useAuth() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: authQueryKey, queryFn: fetchMe, staleTime: 30_000 });
  const me = query.data ?? null;
  const roles = me?.roles ?? [];

  const has = (...r: AppRole[]) => r.some((x) => roles.includes(x));

  return {
    me,
    roles,
    isLoading: query.isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: authQueryKey }),
    has,
    isSuperAdmin: has("super_admin"),
    isCashierOnly: roles.length > 0 && roles.every((r) => r === "cashier"),
    canManageStaff: has("firm_admin", "manager"),
    canAccounting: has("firm_admin", "manager", "accountant"),
    canPos: has("firm_admin", "manager", "cashier", "accountant"),
    canSettings: has("firm_admin", "manager"),
  };
}
