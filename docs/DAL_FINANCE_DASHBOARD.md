# AuthorityIQ — DAL Private Finance Dashboard

## Product decision
Build this as a private owner/admin-only module inside the existing AuthorityIQ Next.js application, not as a client workspace feature and not as a second application.

## Existing foundation inspected
- Repository: digitalauthority1202/AuthorityIQ-
- Stack: Next.js, React, TypeScript, Supabase Auth/Postgres.
- Existing auth helpers: `requireUser`, `requireWorkspaceMember`.
- Existing tenant model: organizations, organization_members, workspaces.
- Existing workspace membership roles: owner, admin, member, viewer.
- Existing server-only Supabase service-role client.
- Existing RLS hardening migration defines `public.is_org_admin(uuid)`.

## Private access contract
- Route: `/finance?workspaceId=<uuid>`.
- API: `GET /api/finance/dashboard?workspaceId=<uuid>&month=YYYY-MM-01`.
- Require a valid Supabase user token and workspace membership.
- Require role owner or admin; member/viewer receive 403.
- Use the service-role client only after the explicit user + role check.
- Finance tables have RLS enabled, no grants to anon/authenticated, and service_role-only table grants. Do not put the service-role key in browser code.
- Do not expose financial metrics through the existing client-facing `/api/dashboard` route.

## Data sources
| Metric | Source of truth |
|---|---|
| Leads, source, lifecycle | HubSpot contacts |
| Signed clients, bookings | HubSpot deals, closed-won + deal type |
| Collections, PayU fee | PayU settlement / accounting receipts |
| Retainer MRR and churn | HubSpot retainer records or deal properties |
| Delivery/CAC/overhead costs | Accounting/expense ledger |
| GST output/input reserve | Invoices + eligible input-tax records |
| Founder withdrawals | Bank/accounting ledger, not HubSpot |

A closed-won deal is not a collection. Keep invoice revenue, cash receipts and pipeline bookings separate. Store all service values ex-GST, store GST and gross invoice/receipt values separately, and never treat output GST as revenue.

## Base forecast defaults
- Engagement: ₹100,000 ex-GST.
- Retainer: ₹30,000/month ex-GST; begins the month after the initial engagement.
- New clients: 3/month.
- Retainer churn: 5%/month.
- CAC: ₹10,000/new client.
- Delivery provision: 15% of revenue.
- Fixed overhead: ₹15,000/month.
- Founder draw target: ₹40,000/month.
- GST assumption: 18%, CA to confirm classification/SAC and registration.
- PayU fee assumption: 2% + GST on the fee; actual merchant/UPI pricing must be imported from settlement.
- Development investment: ₹80,000.

## Required monthly KPIs
Leads, signed new clients, engagement bookings, invoice revenue ex-GST, cash collected ex-GST and gross, active retainer count, retainer MRR, churned clients, logo churn, CAC spend, CAC/client, delivery cost, gross margin, PayU fee, output GST, eligible input GST, estimated GST reserve, founder withdrawals, operating cash after founder, actual-vs-forecast variance.

Definitions:
- CAC = acquisition spend attributed to the period / new paying clients signed in the period.
- Logo churn = retainer clients ending in period / active retainer clients at period start.
- Gross margin = (recognized service revenue ex-GST - direct delivery cost ex-GST) / recognized service revenue ex-GST.
- GST reserve estimate = output GST on invoices less eligible input tax credit; final tax payable must reconcile to books and returns.
- Cash after founder = collections ex-GST less direct delivery, CAC, overhead, payment fees ex-GST and founder withdrawals. Show GST cash separately.

## Integration
- HubSpot is CRM source of truth.
- Use n8n scheduled sync to fetch contacts, deals, custom retainer fields and upsert by stable HubSpot object IDs.
- Use PayU settlement exports/API and accounting data for payments, refunds, fee and GST.
- Use manual or accounting import for costs and founder draws until a bank/accounting connector is approved.
- Keep a sync log, last successful sync time, row counts, error counts and duplicate/idempotency controls.
- Never store HubSpot private app token or PayU secrets in browser/local storage or Git. Keep them in n8n credentials or server-only environment variables.

## Database proposal
The companion file `supabase/finance_dashboard_schema.sql` defines the finance settings, leads, deals, retainers, invoices, payments, costs and founder draw tables. It is a staging SQL file, not yet a CLI-generated migration and not yet applied to the Supabase database.

## Current blockers to live activation
1. The linked Supabase project `utjcxvoggfzjsaoiumyf` was returned as INACTIVE. Do not apply schema or claim live data access until the project is restored and verified.
2. HubSpot connection is not yet confirmed. A ChatGPT HubSpot connection is not itself the same as an AuthorityIQ/n8n server integration.
3. No PayU settlement or accounting data feed is configured.
4. Runtime environment variables and deployment target must be verified before claiming the page is live.

## Acceptance tests
- Unauthenticated user gets 401.
- Workspace non-member gets 403.
- Workspace member/viewer gets 403 for finance endpoint and page data.
- Owner/admin sees only selected workspace's financial records.
- Two workspaces in different organizations cannot cross-read.
- Closed-won deal count excludes open/lost deals and non-initial engagement deal types.
- Payment collection uses paid/settled date, not deal close date.
- Retainer MRR excludes paused/churned contracts and respects start/end dates.
- Churn denominator is active retainers at start of month.
- GST output/input credits reconcile independently of ex-GST revenue.
- Duplicate HubSpot sync records upsert by external IDs.
- Missing/failed syncs show stale-data status, never silently show zero.
