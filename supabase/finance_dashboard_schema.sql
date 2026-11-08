-- DAL Finance Dashboard schema proposal.
-- Apply only after reviewing in the Supabase project and converting to a CLI-generated migration.
-- All money amounts are stored ex-GST and in INR unless explicitly named gross/GST.
-- No authenticated/anon Data API grants: access is through the authenticated server API only.

create table if not exists public.dal_finance_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  engagement_fee_ex_gst numeric(14,2) not null default 100000 check (engagement_fee_ex_gst >= 0),
  monthly_retainer_ex_gst numeric(14,2) not null default 30000 check (monthly_retainer_ex_gst >= 0),
  new_clients_target integer not null default 3 check (new_clients_target >= 0),
  monthly_churn_rate numeric(6,5) not null default 0.05 check (monthly_churn_rate between 0 and 1),
  cac_target numeric(14,2) not null default 10000 check (cac_target >= 0),
  delivery_cost_rate numeric(6,5) not null default 0.15 check (delivery_cost_rate between 0 and 1),
  fixed_overhead_monthly numeric(14,2) not null default 15000 check (fixed_overhead_monthly >= 0),
  founder_draw_target numeric(14,2) not null default 40000 check (founder_draw_target >= 0),
  gst_rate numeric(6,5) not null default 0.18 check (gst_rate between 0 and 1),
  payu_fee_rate numeric(6,5) not null default 0.02 check (payu_fee_rate between 0 and 1),
  development_investment numeric(14,2) not null default 80000 check (development_investment >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id)
);

create table if not exists public.dal_finance_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hubspot_contact_id text not null,
  created_at timestamptz not null,
  lead_source text,
  lead_status text,
  lifecycle_stage text,
  is_excluded boolean not null default false,
  raw_metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique(organization_id, hubspot_contact_id)
);

create table if not exists public.dal_finance_deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hubspot_deal_id text not null,
  hubspot_company_id text,
  deal_name text,
  deal_stage text not null,
  deal_type text not null check (deal_type in ('initial_engagement','retainer','implementation','other')),
  amount_ex_gst numeric(14,2) not null default 0 check (amount_ex_gst >= 0),
  close_date date,
  is_new_client boolean not null default false,
  monthly_retainer_ex_gst numeric(14,2) not null default 0 check (monthly_retainer_ex_gst >= 0),
  payment_status text,
  raw_metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique(organization_id, hubspot_deal_id)
);

create table if not exists public.dal_finance_retainers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  hubspot_deal_id text,
  hubspot_company_id text,
  client_name text,
  start_date date not null,
  end_date date,
  monthly_fee_ex_gst numeric(14,2) not null check (monthly_fee_ex_gst >= 0),
  status text not null check (status in ('active','churned','paused')),
  churn_reason text,
  synced_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table if not exists public.dal_finance_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_invoice_id text not null,
  hubspot_deal_id text,
  client_name text,
  invoice_date date not null,
  due_date date,
  service_type text not null check (service_type in ('initial_engagement','retainer','implementation','other')),
  amount_ex_gst numeric(14,2) not null check (amount_ex_gst >= 0),
  gst_amount numeric(14,2) not null default 0 check (gst_amount >= 0),
  gross_amount numeric(14,2) not null check (gross_amount >= 0),
  invoice_status text not null default 'issued',
  synced_at timestamptz not null default now(),
  unique(organization_id, external_invoice_id)
);

create table if not exists public.dal_finance_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_payment_id text not null,
  external_invoice_id text,
  hubspot_deal_id text,
  paid_at timestamptz not null,
  amount_ex_gst numeric(14,2) not null default 0 check (amount_ex_gst >= 0),
  gst_amount numeric(14,2) not null default 0 check (gst_amount >= 0),
  gross_amount numeric(14,2) not null default 0 check (gross_amount >= 0),
  payu_fee_ex_gst numeric(14,2) not null default 0 check (payu_fee_ex_gst >= 0),
  payu_fee_gst numeric(14,2) not null default 0 check (payu_fee_gst >= 0),
  payment_source text,
  payment_status text not null default 'settled',
  refund_amount numeric(14,2) not null default 0 check (refund_amount >= 0),
  synced_at timestamptz not null default now(),
  unique(organization_id, external_payment_id)
);

create table if not exists public.dal_finance_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_cost_id text,
  cost_date date not null,
  vendor text,
  category text not null check (category in ('cac','delivery','overhead','other')),
  amount_ex_gst numeric(14,2) not null default 0 check (amount_ex_gst >= 0),
  input_gst numeric(14,2) not null default 0 check (input_gst >= 0),
  eligible_for_itc boolean not null default false,
  client_reference text,
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists dal_finance_cost_external_unique
  on public.dal_finance_costs(organization_id, external_cost_id)
  where external_cost_id is not null;

create table if not exists public.dal_founder_draws (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_reference text,
  paid_at date not null,
  amount numeric(14,2) not null check (amount >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists dal_finance_leads_month_idx on public.dal_finance_leads(workspace_id, created_at);
create index if not exists dal_finance_deals_close_idx on public.dal_finance_deals(workspace_id, close_date, deal_stage);
create index if not exists dal_finance_retainers_dates_idx on public.dal_finance_retainers(workspace_id, start_date, end_date, status);
create index if not exists dal_finance_invoices_date_idx on public.dal_finance_invoices(workspace_id, invoice_date);
create index if not exists dal_finance_payments_date_idx on public.dal_finance_payments(workspace_id, paid_at);
create index if not exists dal_finance_costs_date_idx on public.dal_finance_costs(workspace_id, cost_date);
create index if not exists dal_founder_draws_date_idx on public.dal_founder_draws(workspace_id, paid_at);

-- Private by default. The application uses a server-only service-role client after
-- validating Supabase Auth + organization owner/admin membership on every request.
do $$
declare t text;
begin
  foreach t in array array[
    'dal_finance_settings','dal_finance_leads','dal_finance_deals',
    'dal_finance_retainers','dal_finance_invoices','dal_finance_payments',
    'dal_finance_costs','dal_founder_draws'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id))',
      t || '_owner_admin_only', t
    );
  end loop;
end $$;
