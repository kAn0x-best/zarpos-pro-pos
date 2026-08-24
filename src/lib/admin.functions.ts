import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SEED_EMAIL = "superadmin@zarpos.com";
const SEED_PASSWORD = "superadmin2207*zarpos";

/** Creates the very first super admin account if the system has none. Idempotent. */
export const seedSuperAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin");

  if ((count ?? 0) > 0) return { created: false };

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Süper Admin" },
  });

  if (error || !created.user) {
    // Account may already exist without a role row — attach the role instead.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users.find((u) => u.email === SEED_EMAIL);
    if (!existing) throw new Error(error?.message ?? "Süper admin oluşturulamadı");
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: existing.id, email: SEED_EMAIL, full_name: "Süper Admin" });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: existing.id, role: "super_admin" }, { onConflict: "user_id,role" });
    return { created: true };
  }

  await supabaseAdmin
    .from("profiles")
    .upsert({ id: created.user.id, email: SEED_EMAIL, full_name: "Süper Admin" });
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: created.user.id, role: "super_admin" }, { onConflict: "user_id,role" });

  return { created: true };
});

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Bu işlem için süper admin yetkisi gerekiyor.");
}

async function getCallerCompany(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roleList: string[] = (roles ?? []).map((r: { role: string }) => r.role);
  return { companyId: profile?.company_id as string | null, roles: roleList };
}

export const createCompanyWithAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        companyName: z.string().min(2),
        taxNumber: z.string().optional(),
        phone: z.string().optional(),
        plan: z.enum(["trial", "standard", "pro"]).default("trial"),
        adminName: z.string().min(2),
        adminEmail: z.string().email(),
        adminPassword: z.string().min(8),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: data.companyName,
        tax_number: data.taxNumber ?? null,
        phone: data.phone ?? null,
        subscription_plan: data.plan,
      })
      .select()
      .single();
    if (companyError) throw new Error(companyError.message);

    const { data: created, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: data.adminEmail,
      password: data.adminPassword,
      email_confirm: true,
      user_metadata: { full_name: data.adminName },
    });
    if (userError || !created.user) {
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      throw new Error(userError?.message ?? "Yönetici hesabı oluşturulamadı");
    }

    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      company_id: company.id,
      full_name: data.adminName,
      email: data.adminEmail,
    });
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: created.user.id, role: "firm_admin", company_id: company.id },
        { onConflict: "user_id,role" },
      );
    await supabaseAdmin.from("company_settings").upsert({ company_id: company.id });

    return { companyId: company.id };
  });

export const createSuperAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Hesap oluşturulamadı");

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, full_name: data.fullName, email: data.email });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "super_admin" }, { onConflict: "user_id,role" });

    return { ok: true };
  });

export const setCompanyState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        isActive: z.boolean().optional(),
        plan: z.enum(["trial", "standard", "pro"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { is_active?: boolean; subscription_plan?: string } = {};
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (data.plan) patch.subscription_plan = data.plan;
    const { error } = await supabaseAdmin.from("companies").update(patch).eq("id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGlobalMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [companies, users, sales] = await Promise.all([
      supabaseAdmin.from("companies").select("id, is_active, subscription_plan"),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("sales").select("total"),
    ]);

    const volume = (sales.data ?? []).reduce((sum, s) => sum + Number(s.total ?? 0), 0);
    const list = companies.data ?? [];

    return {
      companyCount: list.length,
      activeCompanies: list.filter((c) => c.is_active).length,
      userCount: users.count ?? 0,
      salesVolume: volume,
      salesCount: (sales.data ?? []).length,
    };
  });

export const createCompanyUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(["manager", "accountant", "cashier", "firm_admin"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { companyId, roles } = await getCallerCompany(context.supabase, context.userId);
    const allowed = roles.includes("firm_admin") || roles.includes("manager");
    if (!allowed || !companyId) throw new Error("Personel eklemek için yetkiniz yok.");
    if (data.role === "firm_admin" && !roles.includes("firm_admin")) {
      throw new Error("Yalnızca şirket yöneticisi başka bir yönetici atayabilir.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Kullanıcı oluşturulamadı");

    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      company_id: companyId,
      full_name: data.fullName,
      email: data.email,
    });
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: created.user.id, role: data.role, company_id: companyId },
        { onConflict: "user_id,role" },
      );

    return { ok: true };
  });

export const deleteCompanyUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { companyId, roles } = await getCallerCompany(context.supabase, context.userId);
    if (!(roles.includes("firm_admin") || roles.includes("manager")) || !companyId) {
      throw new Error("Yetkiniz yok.");
    }
    if (data.userId === context.userId) throw new Error("Kendi hesabınızı silemezsiniz.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!target || target.company_id !== companyId) throw new Error("Kullanıcı bulunamadı.");

    await supabaseAdmin.auth.admin.deleteUser(data.userId);
    return { ok: true };
  });
