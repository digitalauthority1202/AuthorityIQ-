# AuthorityIQ

**AI Authority Intelligence & Action Platform**

AuthorityIQ measures, diagnoses, prioritizes, and improves how brands are discovered, cited, and recommended by generative AI systems.

## Operating loop

**Observe → Diagnose → Prioritize → Act → Measure**

## V1 architecture

- Next.js + React + TypeScript
- Supabase PostgreSQL + Auth
- Tenant isolation with PostgreSQL RLS
- Provider-neutral OpenAI / Anthropic / Google adapters
- Idempotent server-side prompt execution with timeout/retry
- Deterministic observation + citation extraction with evidence/confidence
- Versioned AI visibility, recommendation, citation, competitive, and authority scoring
- Opportunity scoring and live dashboard data API
- Audit events and provenance metadata

## Repository structure

```text
supabase/migrations/        Database schema + RLS
src/lib/ai/                 Provider abstraction + prompt runner
src/lib/extraction/         Observation + citation extraction
src/lib/scoring/            Versioned authority metrics
src/app/api/prompt-runs/    Authenticated real prompt execution
src/app/api/dashboard/      Live dashboard data
src/app/dashboard/          First live dashboard surface
.github/workflows/          CI: typecheck, tests, build
```

## Local configuration

1. Copy `.env.example` to `.env.local`.
2. Create a Supabase project and apply migrations in `supabase/migrations/`.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
4. Add the API key for at least one provider: OpenAI, Anthropic, or Google.
5. Create an authenticated Supabase user, organization membership, workspace, brand, prompt, and enabled `ai_providers` row.
6. Run:

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Then open `/dashboard?workspaceId=<workspace-uuid>` after signing in.

## Real prompt execution

`POST /api/prompt-runs` requires a Supabase access token in the `Authorization: Bearer <token>` header and accepts:

```json
{
  "workspaceId": "<uuid>",
  "promptId": "<uuid>",
  "providerId": "<uuid>"
}
```

The server verifies tenant membership, resolves the configured provider/model, creates an idempotent run, calls the provider, persists the raw/normalized response, extracts brand/competitor observations and citations, calculates versioned authority metrics, and persists the resulting score observations.

## Data integrity rules

AuthorityIQ distinguishes observed data from derived metrics. Provider responses and extracted observations retain provider/model/timestamp/confidence context; scores carry a formula version and observation count. The dashboard reads persisted database observations rather than demo data.

## Security

- Never commit `.env.local` or provider credentials.
- Provider secrets are server-only.
- Supabase RLS is enabled on tenant-owned tables.
- API routes verify the authenticated user and workspace membership before trusted server-side writes.
- Service-role access is never exposed to browser code.

## Status

**V1 implementation foundation is now wired end-to-end in code.** Runtime verification still requires a real Supabase project and provider credentials; no production connection is claimed by this repository update.
