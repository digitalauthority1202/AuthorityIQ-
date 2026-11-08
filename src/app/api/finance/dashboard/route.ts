import { NextResponse } from 'next/server';
import { requireUser, requireWorkspaceMember } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const DEFAULTS = {
  engagement_fee_ex_gst: 100000,
  monthly_retainer_ex_gst: 30000,
  new_clients_target: 3,
  monthly_churn_rate: 0.05,
  cac_target: 10000,
  delivery_cost_rate: 0.15,
  fixed_overhead_monthly: 15000,
  founder_draw_target: 40000,
  gst_rate: 0.18,
  payu_fee_rate: 0.02,
  development_investment: 80000,
};

const sum = (rows: Array<Record<string, unknown>>, key: string) =>
  rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);

const isInRange = (value: string | null, start: string, end: string) =>
  Boolean(value && value >= start && value < end);

const monthStart = (value: string) => {
  if (!/^\d{4}-\d{2}-01$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const addMonths = (date: Date, amount: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
const endOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
const activeOn = (retainer: Record<string, unknown>, day: string) => {
  const start = String(retainer.start_date ?? '');
  const end = retainer.end_date ? String(retainer.end_date) : null;
  return start <= day && (!end || end >= day) && retainer.status !== 'paused';
};

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get('workspaceId');
    const requestedMonth = url.searchParams.get('month') ?? `${new Date().toISOString().slice(0, 7)}-01`;
    const selectedMonth = monthStart(requestedMonth);

    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    if (!selectedMonth) return NextResponse.json({ error: 'month must be YYYY-MM-01' }, { status: 400 });

    const membership = await requireWorkspaceMember(user.id, workspaceId);
    if (!['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'FINANCE_ADMIN_ONLY' }, { status: 403 });
    }

    const admin = createSupabaseAdminClient();
    const start = isoDate(selectedMonth);
    const nextMonth = isoDate(addMonths(selectedMonth, 1));
    const monthEnd = isoDate(endOfMonth(selectedMonth));

    const [settingsResult, leadsResult, dealsResult, invoicesResult, paymentsResult, retainersResult, costsResult, drawsResult] = await Promise.all([
      admin.from('dal_finance_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(),
      admin.from('dal_finance_leads').select('created_at,is_excluded').eq('workspace_id', workspaceId).gte('created_at', start).lt('created_at', nextMonth),
      admin.from('dal_finance_deals').select('deal_type,deal_stage,amount_ex_gst,close_date,is_new_client').eq('workspace_id', workspaceId).gte('close_date', start).lt('close_date', nextMonth),
      admin.from('dal_finance_invoices').select('invoice_date,amount_ex_gst,gst_amount,gross_amount,invoice_status').eq('workspace_id', workspaceId).gte('invoice_date', start).lt('invoice_date', nextMonth),
      admin.from('dal_finance_payments').select('paid_at,amount_ex_gst,gst_amount,gross_amount,payu_fee_ex_gst,payu_fee_gst,payment_status,refund_amount').eq('workspace_id', workspaceId).gte('paid_at', start).lt('paid_at', nextMonth),
      admin.from('dal_finance_retainers').select('start_date,end_date,monthly_fee_ex_gst,status').eq('workspace_id', workspaceId),
      admin.from('dal_finance_costs').select('cost_date,category,amount_ex_gst,input_gst,eligible_for_itc').eq('workspace_id', workspaceId).gte('cost_date', start).lt('cost_date', nextMonth),
      admin.from('dal_founder_draws').select('paid_at,amount').eq('workspace_id', workspaceId).gte('paid_at', start).lt('paid_at', nextMonth),
    ]);

    const results = [settingsResult, leadsResult, dealsResult, invoicesResult, paymentsResult, retainersResult, costsResult, drawsResult];
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;

    const settings = { ...DEFAULTS, ...(settingsResult.data ?? {}) };
    const leads = leadsResult.data ?? [];
    const deals = dealsResult.data ?? [];
    const invoices = invoicesResult.data ?? [];
    const payments = paymentsResult.data ?? [];
    const retainers = retainersResult.data ?? [];
    const costs = costsResult.data ?? [];
    const draws = drawsResult.data ?? [];

    const signedDeals = deals.filter((deal) => deal.deal_stage === 'closedwon' && deal.deal_type === 'initial_engagement' && deal.is_new_client);
    const validInvoices = invoices.filter((invoice) => !['void', 'draft', 'cancelled'].includes(String(invoice.invoice_status).toLowerCase()));
    const settledPayments = payments.filter((payment) => ['settled', 'paid', 'succeeded'].includes(String(payment.payment_status).toLowerCase()));
    const monthRetainers = retainers.filter((retainer) => activeOn(retainer, monthEnd));
    const openingRetainers = retainers.filter((retainer) => activeOn(retainer, start));
    const churnedRetainers = retainers.filter((retainer) =>
      retainer.status === 'churned' && retainer.end_date && isInRange(String(retainer.end_date), start, nextMonth)
    );
    const cacSpend = costs.filter((cost) => cost.category === 'cac').reduce((n, cost) => n + Number(cost.amount_ex_gst ?? 0), 0);
    const deliveryCost = costs.filter((cost) => cost.category === 'delivery').reduce((n, cost) => n + Number(cost.amount_ex_gst ?? 0), 0);
    const overhead = costs.filter((cost) => cost.category === 'overhead').reduce((n, cost) => n + Number(cost.amount_ex_gst ?? 0), 0);
    const outputGst = sum(validInvoices, 'gst_amount');
    const eligibleInputGst = costs.filter((cost) => cost.eligible_for_itc).reduce((n, cost) => n + Number(cost.input_gst ?? 0), 0)
      + sum(settledPayments, 'payu_fee_gst');
    const founderWithdrawals = sum(draws, 'amount');
    const invoiceRevenue = sum(validInvoices, 'amount_ex_gst');
    const collectedExGst = sum(settledPayments, 'amount_ex_gst');
    const grossCollected = sum(settledPayments, 'gross_amount');
    const payuFees = sum(settledPayments, 'payu_fee_ex_gst');
    const actualMrr = sum(monthRetainers, 'monthly_fee_ex_gst');
    const churnRate = openingRetainers.length ? churnedRetainers.length / openingRetainers.length : 0;
    const actual = {
      leads: leads.filter((lead) => !lead.is_excluded).length,
      signedClients: signedDeals.length,
      engagementBookingsExGst: sum(signedDeals, 'amount_ex_gst'),
      invoiceRevenueExGst: invoiceRevenue,
      collectionsExGst: collectedExGst,
      grossCashCollected: grossCollected,
      activeRetainerCount: monthRetainers.length,
      activeRetainerMrr: actualMrr,
      churnedRetainers: churnedRetainers.length,
      churnRate,
      cacSpend,
      cacPerClient: signedDeals.length ? cacSpend / signedDeals.length : 0,
      deliveryCost,
      grossMargin: invoiceRevenue ? (invoiceRevenue - deliveryCost) / invoiceRevenue : 0,
      payuFeesExGst: payuFees,
      outputGst,
      eligibleInputGst,
      gstReserveEstimate: Math.max(0, outputGst - eligibleInputGst),
      founderWithdrawals,
      overhead,
      cashAfterFounderProxy: collectedExGst - deliveryCost - cacSpend - overhead - payuFees - founderWithdrawals,
    };

    let projectedActive = openingRetainers.length;
    const forecast = Array.from({ length: 12 }, (_, index) => {
      const month = addMonths(selectedMonth, index);
      const monthLabel = isoDate(month);
      const newClients = Number(settings.new_clients_target);
      const engagementRevenue = newClients * Number(settings.engagement_fee_ex_gst);
      const retainerRevenue = projectedActive * Number(settings.monthly_retainer_ex_gst);
      const revenue = engagementRevenue + retainerRevenue;
      const delivery = revenue * Number(settings.delivery_cost_rate);
      const cac = newClients * Number(settings.cac_target);
      const payu = revenue * (1 + Number(settings.gst_rate)) * Number(settings.payu_fee_rate);
      const cashAfterFounder = revenue - delivery - cac - payu - Number(settings.fixed_overhead_monthly) - Number(settings.founder_draw_target);
      const point = {
        month: monthLabel,
        newClients,
        activeRetainersAtStart: projectedActive,
        engagementRevenueExGst: engagementRevenue,
        retainerRevenueExGst: retainerRevenue,
        revenueExGst: revenue,
        deliveryCost: delivery,
        cacSpend: cac,
        payuFeeExGst: payu,
        fixedOverhead: Number(settings.fixed_overhead_monthly),
        founderDrawTarget: Number(settings.founder_draw_target),
        cashAfterFounder,
        retainerMrrAtEnd: (projectedActive * (1 - Number(settings.monthly_churn_rate)) + newClients) * Number(settings.monthly_retainer_ex_gst),
      };
      projectedActive = projectedActive * (1 - Number(settings.monthly_churn_rate)) + newClients;
      return point;
    });

    const selectedForecast = forecast[0];
    const variance = {
      signedClients: actual.signedClients - selectedForecast.newClients,
      revenueExGst: actual.invoiceRevenueExGst - selectedForecast.revenueExGst,
      cacSpend: selectedForecast.cacSpend - actual.cacSpend,
      deliveryCost: selectedForecast.deliveryCost - actual.deliveryCost,
      retainerMrr: actual.activeRetainerMrr - selectedForecast.retainerRevenueExGst,
      founderWithdrawals: selectedForecast.founderDrawTarget - actual.founderWithdrawals,
    };

    return NextResponse.json({
      month: start,
      actual,
      forecast: selectedForecast,
      forecastTrend: forecast,
      settings,
      variance,
      syncStatus: { source: 'DAL finance ledger', refreshedAt: new Date().toISOString(), mode: 'database-backed' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FINANCE_DASHBOARD_FAILED';
    const status = message === 'AUTH_REQUIRED' || message === 'AUTH_INVALID' ? 401
      : message === 'WORKSPACE_FORBIDDEN' || message === 'FINANCE_ADMIN_ONLY' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
