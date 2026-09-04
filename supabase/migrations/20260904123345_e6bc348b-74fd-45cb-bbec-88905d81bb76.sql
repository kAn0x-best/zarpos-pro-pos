CREATE TABLE public.accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type text not null default 'cash',
  balance numeric not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_tenant_all ON public.accounts FOR ALL TO authenticated
USING (is_super_admin() OR company_id = current_company_id())
WITH CHECK (is_super_admin() OR company_id = current_company_id());

CREATE TABLE public.account_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  direction text not null default 'in',
  amount numeric not null default 0,
  description text,
  reference text,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_movements TO authenticated;
GRANT ALL ON public.account_movements TO service_role;
ALTER TABLE public.account_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_movements_tenant_all ON public.account_movements FOR ALL TO authenticated
USING (is_super_admin() OR company_id = current_company_id())
WITH CHECK (is_super_admin() OR company_id = current_company_id());

CREATE INDEX account_movements_company_created_idx ON public.account_movements (company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.accounts (company_id, name, type, is_default)
SELECT c.id, 'Kasa', 'cash', true FROM public.companies c;
INSERT INTO public.accounts (company_id, name, type, is_default)
SELECT c.id, 'Banka', 'bank', true FROM public.companies c;