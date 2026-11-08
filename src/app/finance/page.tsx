'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type FinancePayload = {
  month: string;
  settings: { monthly_churn_rate: number };
  actual: {
    leads: number; signedClients: number; engagementBookingsExGst: number; invoiceRevenueExGst: number;
    collectionsExGst: number; grossCashCollected: number; activeRetainerCount: number; activeRetainerMrr: number;
    churnedRetainers: number; churnRate: number; cacSpend: number; cacPerClient: number; deliveryCost: number;
    grossMargin: number; payuFeesExGst: number; outputGst: number; eligibleInputGst: number; gstReserveEstimate: number;
    founderWithdrawals: number; overhead: number; cashAfterFounderProxy: number;
  };
  forecast: { newClients: number; revenueExGst: number; cacSpend: number; deliveryCost: number; retainerRevenueExGst: number; founderDrawTarget: number; cashAfterFounder: number };
  forecastTrend: Array<{ month: string; revenueExGst: number; retainerRevenueExGst: number; cashAfterFounder: number; retainerMrrAtEnd: number }>;
  variance: { signedClients: number; revenueExGst: number; cacSpend: number; deliveryCost: number; retainerMrr: number; founderWithdrawals: number };
  syncStatus: { source: string; refreshedAt: string; mode: string };
};

const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
const monthValue = (value: string) => new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

function Metric({ label, value, note, tone = 'normal' }: { label: string; value: string; note?: string; tone?: 'normal' | 'good' | 'warn' }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-950';
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="text-sm text-slate-500">{label}</div>
    <div className={`mt-2 text-2xl font-semibold tracking-tight ${color}`}>{value}</div>
    {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
  </div>;
}

export default function FinanceDashboardPage() {
  const params = useSearchParams();
  const workspaceId = params.get('workspaceId');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7) + '-01');
  const [data, setData] = useState<FinancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Please sign in through AuthorityIQ first.');
      const response = await fetch(`/api/finance/dashboard?workspaceId=${encodeURIComponent(workspaceId)}&month=${encodeURIComponent(month)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load finance dashboard');
      if (!cancelled) setData(payload);
    })().catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load finance dashboard');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId, month]);

  const maxRevenue = useMemo(() => Math.max(1, ...(data?.forecastTrend.map((item) => item.revenueExGst) ?? [1])), [data]);

  if (!workspaceId) return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-5xl rounded-2xl border bg-white p-8"><h1 className="text-2xl font-semibold">DAL Finance</h1><p className="mt-2 text-slate-600">Open this page with <code>?workspaceId=&lt;workspace UUID&gt;</code>.</p></div></main>;

  if (error) return <main className="min-h-screen bg-slate-50 p-8"><div className="mx-auto max-w-5xl rounded-2xl border bg-white p-8"><h1 className="text-2xl font-semibold">DAL Finance</h1><p className="mt-4 text-red-700">{error}</p><p className="mt-2 text-sm text-slate-500">Financial access is limited to workspace owners and admins.</p></div></main>;

  const a = data?.actual;
  const v = data?.variance;
  const f = data?.forecast;
  return <main className="min-h-screen bg-slate-50 p-5 md:p-8">
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-sm font-medium text-slate-500">AuthorityIQ · Private owner workspace</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Digital Authority Labs — Finance</h1>
          <p className="mt-2 text-sm text-slate-500">Actual cash, client economics and recurring revenue against plan</p>
        </div>
        <label className="text-sm text-slate-600">Reporting month
          <input type="month" value={month.slice(0, 7)} onChange={(event) => setMonth(event.target.value + '-01')} className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"/>
        </label>
      </header>

      {loading && <div className="rounded-xl border bg-white p-3 text-sm text-slate-500">Refreshing finance data…</div>}
      {!data && !loading && <div className="rounded-xl border bg-white p-6 text-slate-500">No finance data has been synced yet.</div>}

      {data && a && f && v && <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Leads this month" value={String(a.leads)} note="HubSpot contacts created"/>
          <Metric label="New signed clients" value={String(a.signedClients)} note={`Forecast: ${f.newClients}`} tone={a.signedClients >= f.newClients ? 'good' : 'warn'}/>
          <Metric label="CAC per client" value={money(a.cacPerClient)} note={`CAC spend: ${money(a.cacSpend)}`}/>
          <Metric label="Cash collected · ex GST" value={money(a.collectionsExGst)} note={`Gross receipts: ${money(a.grossCashCollected)}`}/>
          <Metric label="Active retainers" value={String(a.activeRetainerCount)} note={`MRR: ${money(a.activeRetainerMrr)}`}/>
          <Metric label="Monthly churn" value={`${(a.churnRate * 100).toFixed(1)}%`} note={`${a.churnedRetainers} retainers ended`} tone={a.churnRate <= Number(data.settings?.monthly_churn_rate ?? 0.05) ? 'good' : 'warn'}/>
          <Metric label="Delivery cost" value={money(a.deliveryCost)} note={`Gross margin: ${(a.grossMargin * 100).toFixed(1)}%`}/>
          <Metric label="Estimated GST reserve" value={money(a.gstReserveEstimate)} note={`Output: ${money(a.outputGst)} · Eligible ITC: ${money(a.eligibleInputGst)}`}/>
          <Metric label="Founder withdrawals" value={money(a.founderWithdrawals)} note="Actual bank/accounting entries"/>
          <Metric label="Operating cash after founder" value={money(a.cashAfterFounderProxy)} note="Management proxy; excludes GST cash movements"/>
          <Metric label="Invoice revenue · ex GST" value={money(a.invoiceRevenueExGst)} note={`Bookings: ${money(a.engagementBookingsExGst)}`}/>
          <Metric label="PayU processing fees" value={money(a.payuFeesExGst)} note="Actual settlement fees, ex GST"/>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Actual vs forecast</h2>
            <p className="mt-1 text-sm text-slate-500">{monthValue(data.month)} · positive variance is favourable except cost lines</p>
            <div className="mt-5 space-y-4">
              {[
                ['Signed clients', a.signedClients, f.newClients, v.signedClients, false],
                ['Invoice revenue', a.invoiceRevenueExGst, f.revenueExGst, v.revenueExGst, false],
                ['CAC spend', a.cacSpend, f.cacSpend, v.cacSpend, true],
                ['Delivery cost', a.deliveryCost, f.deliveryCost, v.deliveryCost, true],
                ['Retainer MRR', a.activeRetainerMrr, f.retainerRevenueExGst, v.retainerMrr, false],
                ['Founder withdrawals', a.founderWithdrawals, f.founderDrawTarget, v.founderWithdrawals, true],
              ].map(([label, actual, target, variance, lowerIsBetter]) => {
                const actualNumber = Number(actual); const targetNumber = Number(target); const delta = Number(variance);
                const favourable = lowerIsBetter ? delta >= 0 : delta >= 0;
                return <div key={String(label)}>
                  <div className="flex justify-between gap-3 text-sm"><span className="font-medium text-slate-700">{String(label)}</span><span className="text-slate-600">{money(actualNumber)} / {money(targetNumber)}</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-600" style={{ width: `${Math.min(100, targetNumber > 0 ? actualNumber / targetNumber * 100 : 0)}%` }}/></div>
                  <div className={`mt-1 text-xs ${favourable ? 'text-emerald-700' : 'text-amber-700'}`}>Variance: {money(delta)}</div>
                </div>;
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">12-month revenue outlook</h2>
            <p className="mt-1 text-sm text-slate-500">Engagement revenue plus recurring retainer revenue, excluding GST</p>
            <div className="mt-6 flex h-52 items-end gap-2">
              {data.forecastTrend.map((point) => <div key={point.month} className="flex h-full flex-1 flex-col justify-end gap-2">
                <div className="w-full rounded-t-md bg-sky-600" title={money(point.revenueExGst)} style={{ height: `${Math.max(3, point.revenueExGst / maxRevenue * 100)}%` }}/>
                <div className="truncate text-center text-[10px] text-slate-500">{monthValue(point.month).split(' ')[0]}</div>
              </div>)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Month 12 projected MRR</div><div className="mt-1 font-semibold">{money(data.forecastTrend[11]?.retainerMrrAtEnd ?? 0)}</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-slate-500">Month 12 cash after founder</div><div className="mt-1 font-semibold">{money(data.forecastTrend[11]?.cashAfterFounder ?? 0)}</div></div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Finance data health</h2>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div><div className="text-slate-500">Source</div><div className="font-medium">{data.syncStatus.source}</div></div>
            <div><div className="text-slate-500">Last refresh</div><div className="font-medium">{new Date(data.syncStatus.refreshedAt).toLocaleString()}</div></div>
            <div><div className="text-slate-500">Sync mode</div><div className="font-medium">{data.syncStatus.mode}</div></div>
          </div>
          <p className="mt-4 text-xs text-slate-500">This dashboard is live only after the finance schema is applied and HubSpot, PayU and accounting feeds have populated the ledger. It is a management dashboard, not a substitute for accounting records or GST returns.</p>
        </section>
      </>}
    </div>
  </main>;
}
