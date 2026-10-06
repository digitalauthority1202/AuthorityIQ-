create extension if not exists pgcrypto;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  domain text,
  description text,
  created_at timestamptz not null default now()
);

create table competitors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  domain text,
  created_at timestamptz not null default now()
);

create table prompt_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table prompts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  prompt_set_id uuid references prompt_sets(id) on delete set null,
  text text not null,
  intent text,
  commercial_intent numeric(5,4) not null default 0.5 check (commercial_intent between 0 and 1),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table ai_providers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null,
  model text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workspace_id, provider, model)
);

create table prompt_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  prompt_id uuid not null references prompts(id) on delete cascade,
  provider_id uuid references ai_providers(id) on delete set null,
  status text not null check (status in ('queued','running','succeeded','failed')),
  idempotency_key text not null unique,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create table ai_responses (
  id uuid primary key default gen_random_uuid(),
  prompt_run_id uuid not null references prompt_runs(id) on delete cascade,
  provider text not null,
  model text not null,
  response_text text not null,
  normalized_json jsonb,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric(12,6),
  observed_at timestamptz not null default now()
);

create table mentions (
  id uuid primary key default gen_random_uuid(),
  prompt_run_id uuid not null references prompt_runs(id) on delete cascade,
  entity_name text not null,
  entity_type text not null default 'brand',
  sentiment text,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  prompt_run_id uuid not null references prompt_runs(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  competitor_id uuid references competitors(id) on delete cascade,
  rank integer,
  recommended boolean not null default false,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table citations (
  id uuid primary key default gen_random_uuid(),
  prompt_run_id uuid not null references prompt_runs(id) on delete cascade,
  cited_name text,
  url text,
  domain text,
  source_type text,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  entity_type text,
  canonical_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  prompt_id uuid references prompts(id) on delete set null,
  title text not null,
  description text,
  impact numeric(8,4) not null default 0,
  commercial_intent numeric(8,4) not null default 0,
  competitive_gap numeric(8,4) not null default 0,
  confidence numeric(8,4) not null default 0,
  effort numeric(8,4) not null default 1,
  score numeric(12,4) not null default 0,
  status text not null default 'open' check (status in ('open','planned','in_progress','done','dismissed')),
  created_at timestamptz not null default now()
);

create table authority_scores (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  score_type text not null,
  score numeric(8,4) not null,
  formula_version text not null,
  observation_count integer not null default 0,
  confidence numeric(5,4) not null default 0,
  calculated_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  report_type text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_workspaces_org on workspaces(organization_id);
create index idx_brands_workspace on brands(workspace_id);
create index idx_prompts_workspace on prompts(workspace_id);
create index idx_runs_workspace_created on prompt_runs(workspace_id, created_at desc);
create index idx_scores_brand_time on authority_scores(brand_id, calculated_at desc);
create index idx_opportunities_workspace_score on opportunities(workspace_id, score desc);

alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table workspaces enable row level security;
alter table brands enable row level security;
alter table competitors enable row level security;
alter table prompt_sets enable row level security;
alter table prompts enable row level security;
alter table ai_providers enable row level security;
alter table prompt_runs enable row level security;
alter table ai_responses enable row level security;
alter table mentions enable row level security;
alter table recommendations enable row level security;
alter table citations enable row level security;
alter table entities enable row level security;
alter table opportunities enable row level security;
alter table authority_scores enable row level security;
alter table reports enable row level security;
alter table audit_events enable row level security;

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from organization_members m where m.organization_id = org_id and m.user_id = auth.uid()); $$;

create or replace function public.workspace_org_id(workspace_uuid uuid)
returns uuid language sql stable security definer set search_path = public
as $$ select organization_id from workspaces where id = workspace_uuid; $$;

create policy org_member_select on organizations for select using (is_org_member(id));
create policy org_member_select on organization_members for select using (user_id = auth.uid() or is_org_member(organization_id));

create policy workspace_member_all on workspaces for all using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy brand_member_all on brands for all using (is_org_member(workspace_org_id(workspace_id))) with check (is_org_member(workspace_org_id(workspace_id)));
create policy competitor_member_all on competitors for all using (is_org_member(workspace_org_id(workspace_id))) with check (is_org_member(workspace_org_id(workspace_id)));
create policy prompt_set_member_all on prompt_sets for all using (is_org_member(workspace_org_id(workspace_id))) with check (is_org_member(workspace_org_id(workspace_id)));
create policy prompt_member_all on prompts for all using (is_org_member(workspace_org_id(workspace_id))) with check (is_org_member(workspace_org_id(workspace_id)));
create policy provider_member_all on ai_providers for all using (is_org_member(workspace_org_id(workspace_id))) with check (is_org_member(workspace_org_id(workspace_id)));
create policy run_member_all on prompt_runs for all using (is_org_member(workspace_org_id(workspace_id))) with check (is_org_member(workspace_org_id(workspace_id)));
create policy response_member_all on ai_responses for all using (is_org_member(workspace_org_id((select workspace_id from prompt_runs r where r.id = prompt_run_id)))) with check (is_org_member(workspace_org_id((select workspace_id from prompt_runs r where r.id = prompt_run_id))));
create policy opportunity_member_all on opportunities for all using (is_org_member(workspace_org_id(workspace_id))) with check (is_org_member(workspace_org_id(workspace_id)));
create policy score_member_all on authority_scores for all using (is_org_member(workspace_org_id(workspace_id))) with check (is_org_member(workspace_org_id(workspace_id)));
create policy report_member_all on reports for all using (is_org_member(workspace_org_id(workspace_id))) with check (is_org_member(workspace_org_id(workspace_id)));
create policy entity_member_all on entities for all using (is_org_member(workspace_org_id(workspace_id))) with check (is_org_member(workspace_org_id(workspace_id)));
create policy audit_member_all on audit_events for select using (is_org_member(organization_id));
