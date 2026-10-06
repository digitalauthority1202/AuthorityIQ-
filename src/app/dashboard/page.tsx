'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

type DashboardData = {
  brand: { name: string; domain?: string | null } | null;
  scores: Record<string, { score: number; confidence: number; calculated_at: string }>;
  runs: Array<{ id: string; status: string; created_at: string }>;
  opportunities: Array<{ id: string; title: string; score: number; status: string }>;
  provenance: { source: string; generatedAt: string };
};

function ScoreCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value == null ? '—' : `${value.toFixed(1)}%`}</div>
    </div>
  );
}

export default function DashboardPage() {
  const params = useSearchParams();
  const workspaceId = params.get('workspaceId');
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('Sign in through Supabase before opening the dashboard.');
        return;
      }
      const response = await fetch(`/api/dashboard?workspaceId=${encodeURIComponent(workspaceId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (cancelled) return;
      if (!response.ok) setError(payload.error ?? 'Unable to load dashboard');
      else setData(payload);
    })().catch((cause) => !cancelled && setError(cause instanceof Error ? cause.message : 'Unable to load dashboard'));
    return () => { cancelled = true; };
  }, [workspaceId]);

  if (!workspaceId) {
    return <main className="min-h-screen bg-neutral-50 p-8"><div className="mx-auto max-w-5xl rounded-2xl border bg-white p-8"><h1 className="text-2xl font-semibold">AuthorityIQ Live Dashboard</h1><p className="mt-2 text-neutral-600">Open this page with <code>?workspaceId=&lt;workspace UUID&gt;</code>.</p></div></main>;
  }

  if (error) {
    return <main className="min-h-screen bg-neutral-50 p-8"><div className="mx-auto max-w-5xl rounded-2xl border bg-white p-8"><h1 className="text-2xl font-semibold">AuthorityIQ Live Dashboard</h1><p className="mt-4 text-red-600">{error}</p></div></main>;
  }

  if (!data) return <main className="min-h-screen bg-neutral-50 p-8"><div className="mx-auto max-w-5xl text-neutral-600">Loading live AuthorityIQ data…</div></main>;

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <div className="text-sm font-medium text-neutral-500">AuthorityIQ · Live Intelligence</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{data.brand?.name ?? 'Workspace'} authority dashboard</h1>
          <p className="mt-2 text-sm text-neutral-500">Observe → Diagnose → Prioritize → Act → Measure</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <ScoreCard label="Authority Score" value={data.scores.authority?.score} />
          <ScoreCard label="AI Visibility" value={data.scores.visibility?.score} />
          <ScoreCard label="Recommendation Share" value={data.scores.recommendation_share?.score} />
          <ScoreCard label="Citation Share" value={data.scores.citation_share?.score} />
          <ScoreCard label="Competitive Score" value={data.scores.competitive?.score} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Recent prompt runs</h2>
            <div className="mt-4 divide-y">
              {data.runs.length === 0 ? <p className="py-4 text-sm text-neutral-500">No live runs yet.</p> : data.runs.map((run) => (
                <div key={run.id} className="flex items-center justify-between py-3 text-sm"><span className="font-mono text-xs">{run.id.slice(0, 8)}…</span><span className="capitalize text-neutral-600">{run.status}</span></div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Top opportunities</h2>
            <div className="mt-4 divide-y">
              {data.opportunities.length === 0 ? <p className="py-4 text-sm text-neutral-500">No opportunities generated yet.</p> : data.opportunities.map((item) => (
                <div key={item.id} className="py-3"><div className="flex justify-between gap-4"><span className="font-medium">{item.title}</span><span className="font-semibold">{item.score.toFixed(1)}</span></div><div className="mt-1 text-xs text-neutral-500 capitalize">{item.status.replace('_', ' ')}</div></div>
              ))}
            </div>
          </div>
        </section>

        <footer className="text-xs text-neutral-400">Source: {data.provenance.source}. Last refreshed {new Date(data.provenance.generatedAt).toLocaleString()}.</footer>
      </div>
    </main>
  );
}
