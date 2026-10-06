-- AuthorityIQ V1: RLS hardening and tenant-integrity helpers.
-- This migration intentionally separates read access from write access and
-- closes the observation-table policy gaps in the initial schema.

create or replace function public.has_org_role(org_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_role(org_id, array['owner','admin']);
$$;

create or replace function public.can_write_workspace(workspace_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_member(public.workspace_org_id(workspace_uuid));
$$;

-- Replace broad initial policies with explicit tenant-safe policies.
drop policy if exists workspace_member_all on workspaces;
drop policy if exists brand_member_all on brands;
drop policy if exists competitor_member_all on competitors;
drop policy if exists prompt_set_member_all on prompt_sets;
drop policy if exists prompt_member_all on prompts;
drop policy if exists provider_member_all on ai_providers;
drop policy if exists run_member_all on prompt_runs;
drop policy if exists response_member_all on ai_responses;
drop policy if exists opportunity_member_all on opportunities;
drop policy if exists score_member_all on authority_scores;
drop policy if exists report_member_all on reports;
drop policy if exists entity_member_all on entities;
drop policy if exists audit_member_all on audit_events;

-- Organization membership is visible to members. Membership changes are admin-only.
drop policy if exists org_member_select on organization_members;
create policy organization_members_select
  on organization_members for select
  using (user_id = auth.uid() or is_org_member(organization_id));

create policy organization_members_admin_write
  on organization_members for all
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- Workspaces: members can read; owners/admins can create, update, or delete.
create policy workspaces_member_select
  on workspaces for select
  using (is_org_member(organization_id));

create policy workspaces_admin_write
  on workspaces for all
  using (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- Workspace-owned resources: members can read and write resources in their tenant.
-- Cross-tenant writes are blocked by the workspace_org_id() check.
create policy brands_member_access
  on brands for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create policy competitors_member_access
  on competitors for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create policy prompt_sets_member_access
  on prompt_sets for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create policy prompts_member_access
  on prompts for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create policy ai_providers_member_access
  on ai_providers for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create policy prompt_runs_member_access
  on prompt_runs for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create policy ai_responses_member_access
  on ai_responses for select
  using (
    exists (
      select 1
      from prompt_runs r
      where r.id = prompt_run_id
        and can_write_workspace(r.workspace_id)
    )
  );

create policy ai_responses_member_insert
  on ai_responses for insert
  with check (
    exists (
      select 1
      from prompt_runs r
      where r.id = prompt_run_id
        and can_write_workspace(r.workspace_id)
    )
  );

create policy ai_responses_member_update
  on ai_responses for update
  using (
    exists (
      select 1
      from prompt_runs r
      where r.id = prompt_run_id
        and can_write_workspace(r.workspace_id)
    )
  )
  with check (
    exists (
      select 1
      from prompt_runs r
      where r.id = prompt_run_id
        and can_write_workspace(r.workspace_id)
    )
  );

create policy ai_responses_member_delete
  on ai_responses for delete
  using (
    exists (
      select 1
      from prompt_runs r
      where r.id = prompt_run_id
        and can_write_workspace(r.workspace_id)
    )
  );

create policy mentions_member_access
  on mentions for all
  using (
    exists (
      select 1 from prompt_runs r
      where r.id = prompt_run_id and can_write_workspace(r.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from prompt_runs r
      where r.id = prompt_run_id and can_write_workspace(r.workspace_id)
    )
  );

create policy recommendations_member_access
  on recommendations for all
  using (
    exists (
      select 1 from prompt_runs r
      where r.id = prompt_run_id and can_write_workspace(r.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from prompt_runs r
      where r.id = prompt_run_id and can_write_workspace(r.workspace_id)
    )
  );

create policy citations_member_access
  on citations for all
  using (
    exists (
      select 1 from prompt_runs r
      where r.id = prompt_run_id and can_write_workspace(r.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from prompt_runs r
      where r.id = prompt_run_id and can_write_workspace(r.workspace_id)
    )
  );

create policy entities_member_access
  on entities for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create policy opportunities_member_access
  on opportunities for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create policy authority_scores_member_access
  on authority_scores for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create policy reports_member_access
  on reports for all
  using (can_write_workspace(workspace_id))
  with check (can_write_workspace(workspace_id));

create policy audit_events_member_select
  on audit_events for select
  using (is_org_member(organization_id));

create policy audit_events_member_insert
  on audit_events for insert
  with check (is_org_member(organization_id) and (user_id is null or user_id = auth.uid()));

-- Defense-in-depth: indexes for the policy subqueries and common dashboard access paths.
create index if not exists idx_org_members_user_org
  on organization_members(user_id, organization_id);

create index if not exists idx_prompt_runs_prompt
  on prompt_runs(prompt_id, created_at desc);

create index if not exists idx_ai_responses_run
  on ai_responses(prompt_run_id, observed_at desc);

create index if not exists idx_mentions_run
  on mentions(prompt_run_id, created_at desc);

create index if not exists idx_recommendations_run
  on recommendations(prompt_run_id, rank asc);

create index if not exists idx_citations_run
  on citations(prompt_run_id, created_at desc);
