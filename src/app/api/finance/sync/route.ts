import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.coerce.number().finite().nonnegative();
const leadSchema = z.object({
  hubspot_contact_id: z.string().min(1), created_at: z.string().datetime({ offset: true }),
  lead_source: z.string().nullable().optional(), lead_status: z.string().nullable().optional(),
  lifecycle_stage: z.string().nullable().optional(), is_excluded: z.boolean().optional(), raw_metadata: z.record(z.string(), z.unknown()).optional(),
});
const dealSchema = z.object({
  hubspot_deal_id: z.string().min(1), hubspot_company_id: z.string().nullable().optional(), deal_name: z.string().nullable().optional(),
  deal_stage: z.string().min(1), deal_type: z.enum(['initial_engagement','retainer','implementation','other']),
  amount_ex_gst: money, close_date: date.nullable().optional(), is_new_client: z.boolean().optional(),
  monthly_retainer_ex_gst: money.optional(), payment_status: z.string().nullable().optional(), raw_metadata: z.record(z.string(), z.unknown()).optional(),
});
const retainerSchema = z.object({
  external_retainer_id: z.string().min(1), hubspot_deal_id: z.string().nullable().optional(), hubspot_company_id: z.string().nullable().optional(),
  client_name: z.string().nullable().optional(), start_date: date, end_date: date.nullable().optional(),
  monthly_fee_ex_gst: money, status: z.enum(['active','churned','paused']), churn_reason: z.string().nullable().optional(),
});
const invoiceSchema = z.object({
  external_invoice_id: z.string().min(1), hubspot_deal_id: z.string().nullable().optional(), client_name: z.string().nullable().optional(),
  invoice_date: date, due_date: date.nullable().optional(), service_type: z.enum(['initial_engagement','retainer','implementation','other']),
  amount_ex_gst: money, gst_amount: money, gross_amount: money, invoice_status: z.string().default('issued'),
});
const paymentSchema = z.object({
  external_payment_id: z.string().min(1), external_invoice_id: z.string().nullable().optional(), hubspot_deal_id: z.string().nullable().optional(),
  paid_at: z.string().datetime({ offset: true }), amount_ex_gst: money, gst_amount: money, gross_amount: money,
  payu_fee_ex_gst: money.optional(), payu_fee_gst: money.optional(), payu_fee_itc_eligible: z.boolean().optional(), payment_source: z.string().nullable().optional(),
  payment_status: z.string().default('settled'), refund_amount: money.optional(),
});
const costSchema = z.object({
  external_cost_id: z.string().min(1), cost_date: date, vendor: z.string().nullable().optional(),
  category: z.enum(['cac','delivery','overhead','other']), amount_ex_gst: money, input_gst: money.optional(),
  eligible_for_itc: z.boolean().optional(), client_reference: z.string().nullable().optional(), notes: z.string().nullable().optional(),
});
const drawSchema = z.object({
  external_reference: z.string().min(1), paid_at: date, amount: money, notes: z.string().nullable().optional(),
});
const payloadSchema = z.object({
  workspaceId: z.string().uuid(),
  leads: z.array(leadSchema).default([]),
  deals: z.array(dealSchema).default([]),
  retainers: z.array(retainerSchema).default([]),
  invoices: z.array(invoiceSchema).default([]),
  payments: z.array(paymentSchema).default([]),
  costs: z.array(costSchema).default([]),
  founderDraws: z.array(drawSchema).default([]),
}).strict();

function validSecret(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expectedSecret = process.env.DAL_FINANCE_SYNC_SECRET;
  if (!expectedSecret) return NextResponse.json({ error: 'FINANCE_SYNC_NOT_CONFIGURED' }, { status: 503 });
  if (!validSecret(request.headers.get('x-dal-finance-sync-secret'), expectedSecret)) {
    return NextResponse.json({ error: 'SYNC_UNAUTHORIZED' }, { status: 401 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_SYNC_PAYLOAD', details: parsed.error.flatten() }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { workspaceId, ...payload } = parsed.data;
  const { data: workspace, error: workspaceError } = await admin.from('workspaces')
    .select('id,organization_id').eq('id', workspaceId).maybeSingle();
  if (workspaceError || !workspace) return NextResponse.json({ error: 'WORKSPACE_NOT_FOUND' }, { status: 404 });

  const stamp = new Date().toISOString();
  const common = { organization_id: workspace.organization_id, workspace_id: workspaceId, synced_at: stamp };
  const batches = [
    ['dal_finance_leads', payload.leads.map((row) => ({ ...common, ...row })), 'organization_id,hubspot_contact_id'],
    ['dal_finance_deals', payload.deals.map((row) => ({ ...common, ...row })), 'organization_id,hubspot_deal_id'],
    ['dal_finance_retainers', payload.retainers.map((row) => ({ ...common, ...row })), 'organization_id,external_retainer_id'],
    ['dal_finance_invoices', payload.invoices.map((row) => ({ ...common, ...row })), 'organization_id,external_invoice_id'],
    ['dal_finance_payments', payload.payments.map((row) => ({ ...common, ...row })), 'organization_id,external_payment_id'],
    ['dal_finance_costs', payload.costs.map((row) => ({ ...common, ...row })), 'organization_id,external_cost_id'],
    ['dal_founder_draws', payload.founderDraws.map((row) => ({ ...common, ...row })), 'organization_id,external_reference'],
  ] as const;
  const counts: Record<string, number> = {};

  try {
    for (const [table, rows, conflict] of batches) {
      counts[table] = rows.length;
      if (!rows.length) continue;
      const { error } = await admin.from(table).upsert(rows, { onConflict: conflict });
      if (error) throw new Error(`${table}: ${error.message}`);
    }

    const { error: logError } = await admin.from('dal_finance_sync_runs').insert({
      ...common, source: 'n8n/hubspot-finance-sync', status: 'succeeded',
      started_at: stamp, completed_at: new Date().toISOString(), row_counts: counts,
    });
    if (logError) throw logError;

    return NextResponse.json({ ok: true, workspaceId, counts, syncedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FINANCE_SYNC_FAILED';
    await admin.from('dal_finance_sync_runs').insert({
      ...common, source: 'n8n/hubspot-finance-sync', status: 'failed',
      started_at: stamp, completed_at: new Date().toISOString(), row_counts: counts, error_summary: message.slice(0, 500),
    });
    return NextResponse.json({ error: 'FINANCE_SYNC_FAILED', detail: message }, { status: 500 });
  }
}
