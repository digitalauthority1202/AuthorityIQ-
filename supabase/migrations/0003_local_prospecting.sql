-- AuthorityIQ V15: city-level prospecting and qualification.
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_name text not null,
  normalized_name text not null,
  city text not null default 'Bhopal',
  state text not null default 'Madhya Pradesh',
  country text not null default 'India',
  category text,
  subcategory text,
  website_url text,
  business_status text not null default 'unverified'
    check (business_status in ('unverified','active','inactive','closed')),
  prospect_stage text not null default 'discovered'
    check (prospect_stage in ('discovered','researching','qualified','contacted','meeting','proposal','won','lost','nurture')),
  icp_segment text,
  estimated_company_stage text,
  decision_maker_name text,
  decision_maker_role text,
  decision_maker_profile_url text,
  authority_fit_score numeric(5,2) not null default 0 check (authority_fit_score between 0 and 100),
  buying_signal_score numeric(5,2) not null default 0 check (buying_signal_score between 0 and 100),
  data_confidence numeric(5,2) not null default 0 check (data_confidence between 0 and 100),
  ai_visibility_status text not null default 'not_tested'
    check (ai_visibility_status in ('not_tested','queued','tested','error')),
  ai_visibility_score numeric(5,2) check (ai_visibility_score between 0 and 100),
  hubspot_company_id text,
  hubspot_deal_id text,
  owner_user_id uuid,
  notes text,
  discovered_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, normalized_name, city)
);

create table if not exists public.prospect_sources (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  source_type text not null,
  source_name text,
  source_url text,
  source_excerpt text,
  observed_at timestamptz not null default now(),
  verified_at timestamptz,
  confidence numeric(5,2) not null default 50 check (confidence between 0 and 100)
);

create table if not exists public.prospect_signals (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  signal_type text not null,
  signal_value text,
  signal_url text,
  signal_date date,
  confidence numeric(5,2) not null default 50 check (confidence between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.prospect_audits (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  audit_type text not null default 'ai_visibility',
  status text not null default 'queued'
    check (status in ('queued','running','completed','failed')),
  prompt_count integer not null default 0,
  providers jsonb not null default '[]'::jsonb,
  results jsonb not null default '{}'::jsonb,
  score numeric(5,2),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_prospects_workspace_score
  on public.prospects(workspace_id, authority_fit_score desc);
create index if not exists idx_prospects_city_stage
  on public.prospects(city, prospect_stage);
create index if not exists idx_prospect_sources_prospect
  on public.prospect_sources(prospect_id, observed_at desc);
create index if not exists idx_prospect_signals_prospect
  on public.prospect_signals(prospect_id, created_at desc);
create index if not exists idx_prospect_audits_prospect
  on public.prospect_audits(prospect_id, created_at desc);

alter table public.prospects enable row level security;
alter table public.prospect_sources enable row level security;
alter table public.prospect_signals enable row level security;
alter table public.prospect_audits enable row level security;

drop policy if exists prospects_member_access on public.prospects;
create policy prospects_member_access on public.prospects
  for all using (public.can_write_workspace(workspace_id))
  with check (public.can_write_workspace(workspace_id));

drop policy if exists prospect_sources_member_access on public.prospect_sources;
create policy prospect_sources_member_access on public.prospect_sources
  for all using (exists (
    select 1 from public.prospects p
    where p.id = prospect_id and public.can_write_workspace(p.workspace_id)
  ))
  with check (exists (
    select 1 from public.prospects p
    where p.id = prospect_id and public.can_write_workspace(p.workspace_id)
  ));

drop policy if exists prospect_signals_member_access on public.prospect_signals;
create policy prospect_signals_member_access on public.prospect_signals
  for all using (exists (
    select 1 from public.prospects p
    where p.id = prospect_id and public.can_write_workspace(p.workspace_id)
  ))
  with check (exists (
    select 1 from public.prospects p
    where p.id = prospect_id and public.can_write_workspace(p.workspace_id)
  ));

drop policy if exists prospect_audits_member_access on public.prospect_audits;
create policy prospect_audits_member_access on public.prospect_audits
  for all using (exists (
    select 1 from public.prospects p
    where p.id = prospect_id and public.can_write_workspace(p.workspace_id)
  ))
  with check (exists (
    select 1 from public.prospects p
    where p.id = prospect_id and public.can_write_workspace(p.workspace_id)
  ));
