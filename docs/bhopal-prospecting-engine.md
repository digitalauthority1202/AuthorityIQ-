# Bhopal Local Authority Prospecting Engine

## Scope
AuthorityIQ V15 adds a city prospecting surface at `/prospecting/bhopal` and tenant-scoped persistence for prospect records, evidence sources, buying signals and audit runs.

## Current starter dataset
The page contains a small, manually curated research sample. It is not a live scrape and it does not claim that AI platforms have already recommended or cited any listed business. Scores are initial fit-prioritisation heuristics only.

## ICP segments
- Emerging D2C / consumer brands: own website, differentiated products, multi-channel distribution, category expansion.
- Food, restaurants and cafes: distinctive menu or experience, active reviews, local search demand, one or more locations.
- Wellness / healthcare: evidence-backed expertise, compliant claims, product/service clarity, high trust requirement.
- Hospitality: bookable inventory, premium experiences, events or destination intent.
- Fashion / lifestyle: identifiable design point of view, founder story, online catalogue or expansion intent.

## Qualification score (0-100)
- ICP / vertical fit: 20
- Digital footprint maturity: 15
- Local demand and reputation signals: 15
- Differentiation and content potential: 15
- Expansion / buying signals: 15
- AI answer opportunity: 10
- Evidence confidence: 10

The UI starter currently uses manually assigned provisional scores. Replace with computed values when enrichment sources and evidence are connected.

## Data model
- `prospects`: tenant-scoped company and qualification record.
- `prospect_sources`: source URLs, excerpts, observation and verification timestamps.
- `prospect_signals`: expansion, hiring, launch, outlet, press and other buying signals.
- `prospect_audits`: provider/prompt run status and persisted benchmark output.

All four tables enable RLS and use the existing `can_write_workspace(workspace_id)` tenant authorization helper.

## Build sequence
1. Apply migration `0003_local_prospecting.sql` to the intended Supabase project.
2. Replace starter array with authenticated workspace-scoped Supabase queries.
3. Add source discovery/import jobs (Startup MP, public websites, local listings, directories).
4. Add deterministic deduplication and evidence freshness checks.
5. Connect AI prompt benchmarking to the existing provider runner; store per-provider mentions, rank, citations and confidence.
6. Add HubSpot company/contact/deal upsert after user mapping and consent checks.
7. Add scheduled refresh, CSV export and audit PDF generation.

## Data governance
Do not scrape private/personal contact details or infer founder identities. Store public business contact channels and cite source URLs. Treat directory ratings and review counts as dated snapshots. Verify trading status before outreach and respect platform terms, rate limits and opt-out requests.
