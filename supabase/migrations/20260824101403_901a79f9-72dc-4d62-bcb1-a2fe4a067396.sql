
CREATE TYPE public.app_role AS ENUM ('super_admin','firm_admin','manager','accountant','cashier');

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tax_office text,
  tax_number text,
  address text,
  phone text,
  email text,
  iban text,
  logo_url text,
  subscription_plan text NOT NULL DEFAULT 'trial',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = public.current_company_id());
CREATE POLICY "companies_update" ON public.companies FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (id = public.current_company_id() AND (public.has_role(auth.uid(),'firm_admin') OR public.has_role(auth.uid(),'manager'))))
  WITH CHECK (public.is_super_admin() OR id = public.current_company_id());

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = auth.uid() OR company_id = public.current_company_id());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin()) WITH CHECK (id = auth.uid() OR public.is_super_admin());

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_super_admin() OR user_id = auth.uid() OR company_id = public.current_company_id());

-- Generic tenant tables
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'customer',
  name text NOT NULL,
  tax_office text,
  tax_number text,
  phone text,
  email text,
  address text,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  barcode text,
  sku text,
  name text NOT NULL,
  category text,
  purchase_price numeric(14,2) NOT NULL DEFAULT 0,
  sale_price numeric(14,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 20,
  stock numeric(14,3) NOT NULL DEFAULT 0,
  min_stock numeric(14,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'Adet',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cash_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_cash numeric(14,2) NOT NULL DEFAULT 0,
  counted_cash numeric(14,2),
  expected_cash numeric(14,2),
  difference numeric(14,2),
  status text NOT NULL DEFAULT 'open'
);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.cash_shifts(id) ON DELETE SET NULL,
  cashier_id uuid,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  receipt_no text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  vat_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  paid_cash numeric(14,2) NOT NULL DEFAULT 0,
  paid_card numeric(14,2) NOT NULL DEFAULT 0,
  paid_credit numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  barcode text,
  qty numeric(14,3) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 20,
  total numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  invoice_no text NOT NULL,
  direction text NOT NULL DEFAULT 'sales',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  vat_total numeric(14,2) NOT NULL DEFAULT 0,
  withholding numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  qty numeric(14,3) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 20,
  total numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'Diğer',
  description text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'debit',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  description text,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.company_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  auto_backup_enabled boolean NOT NULL DEFAULT false,
  backup_on_zreport boolean NOT NULL DEFAULT true,
  backup_interval_hours integer NOT NULL DEFAULT 24,
  last_backup_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contacts','products','cash_shifts','sales','sale_items','invoices','invoice_items','expenses','transactions','company_settings']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "%s_tenant_all" ON public.%I FOR ALL TO authenticated USING (public.is_super_admin() OR company_id = public.current_company_id()) WITH CHECK (public.is_super_admin() OR company_id = public.current_company_id());', t, t);
  END LOOP;
END $$;

CREATE INDEX idx_products_company ON public.products(company_id);
CREATE INDEX idx_products_barcode ON public.products(company_id, barcode);
CREATE INDEX idx_contacts_company ON public.contacts(company_id);
CREATE INDEX idx_sales_company ON public.sales(company_id, created_at DESC);
CREATE INDEX idx_invoices_company ON public.invoices(company_id, issue_date DESC);
CREATE INDEX idx_expenses_company ON public.expenses(company_id, expense_date DESC);
CREATE INDEX idx_tx_contact ON public.transactions(contact_id, created_at DESC);
