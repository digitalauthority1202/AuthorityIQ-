# AuthorityIQ V1 Engineering Specification

## 1. Product contract

AuthorityIQ is an AI Authority Intelligence & Action Platform. The V1 system converts commercially relevant prompts into repeatable observations and actionable authority insights.

Operating loop:

**Observe → Diagnose → Prioritize → Act → Measure**

### North-star metric

**Qualified AI Recommendation Share (QARS)** = percentage of commercially relevant high-intent prompt observations where the target brand is favorably recommended or referenced relative to relevant competitors.

Never represent estimated or inferred data as directly observed. Every metric must carry provenance, timestamp, provider/model metadata, extraction confidence, and scoring version.

## 2. Architecture

- Frontend: Next.js + React + TypeScript
- Data/auth: Supabase PostgreSQL + Supabase Auth
- Authorization: PostgreSQL RLS
- AI providers: provider abstraction supporting OpenAI, Anthropic, and Google/Gemini
- Execution: server-side prompt runner
- Extraction: deterministic + model-assisted extraction with confidence
- Scoring: versioned deterministic functions
- Reporting: persisted report snapshots

## 3. Core data model

Tenancy:
- organizations
- organization_members
- workspaces

Entities:
- brands
- competitors
- prompts
- prompt_sets

Observations:
- prompt_runs
- ai_responses
- mentions
- recommendations
- citations
- entities

Action layer:
- opportunities
- recommendation_actions
- authority_scores
- reports
- audit_events

## 4. Prompt execution pipeline

1. Validate workspace and prompt.
2. Resolve provider/model configuration server-side.
3. Generate an idempotency key.
4. Execute provider with timeout and retry policy.
5. Persist raw response and usage metadata.
6. Normalize response into a provider-neutral representation.
7. Extract brand mentions, competitors, recommendations, citations and entities.
8. Persist extraction results with confidence and extraction version.
9. Calculate scores.
10. Generate opportunities.
11. Emit dashboard/reporting events.

Failures are explicit and persisted; partial results must never be presented as successful observations.

## 5. Provider contract

Every provider implements:

- `runPrompt()`
- `normalizeResponse()`
- `extractUsage()`
- `estimateCost()`
- `getProviderMetadata()`

The provider layer must isolate vendor-specific SDKs from product/domain logic.

## 6. Scoring

Required V1 metrics:

- AI Visibility Score
- Recommendation Share
- Citation Share
- Competitive Score
- Authority Score
- Authority Lift

Each score stores:
- score value
- formula/version
- source observation count
- timestamp
- confidence

## 7. Opportunity engine

`Opportunity Score = Impact × Commercial Intent × Competitive Gap × Confidence ÷ Effort`

The UI must expose the component inputs so the score is explainable.

## 8. Security

- Supabase Auth for identity.
- RLS on every tenant-owned table.
- Server-only provider secrets.
- No API keys in browser bundles.
- Organization/workspace authorization enforced at database and service layers.
- Audit events for security-sensitive changes.
- Input validation and provider rate limits.

## 9. Definition of done for V1 foundation

A real user can create an organization/workspace, define a brand and competitors, create prompts, execute a real provider call, persist the response, extract observations, calculate metrics, create opportunities, and retrieve historical observations without demo data or cross-tenant leakage.
