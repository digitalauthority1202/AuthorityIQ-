import { NextResponse } from 'next/server';
import { requireUser, requireWorkspaceMember } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const workspaceId = new URL(request.url).searchParams.get('workspaceId');
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    await requireWorkspaceMember(user.id, workspaceId);

    const admin = createSupabaseAdminClient();
    const [brandResult, scoresResult, runsResult, opportunitiesResult] = await Promise.all([
      admin.from('brands').select('id, name, domain').eq('workspace_id', workspaceId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
      admin.from('authority_scores').select('score_type, score, formula_version, observation_count, confidence, calculated_at')
        .eq('workspace_id', workspaceId).order('calculated_at', { ascending: false }).limit(25),
      admin.from('prompt_runs').select('id, status, started_at, completed_at, created_at, prompt_id, provider_id')
        .eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(20),
      admin.from('opportunities').select('id, title, description, score, status, confidence, effort, created_at')
        .eq('workspace_id', workspaceId).order('score', { ascending: false }).limit(10),
    ]);

    if (brandResult.error) throw brandResult.error;
    if (scoresResult.error) throw scoresResult.error;
    if (runsResult.error) throw runsResult.error;
    if (opportunitiesResult.error) throw opportunitiesResult.error;

    const latestByType: Record<string, unknown> = {};
    for (const score of scoresResult.data ?? []) {
      if (!latestByType[score.score_type]) latestByType[score.score_type] = score;
    }

    return NextResponse.json({
      brand: brandResult.data,
      scores: latestByType,
      scoreHistory: scoresResult.data ?? [],
      runs: runsResult.data ?? [],
      opportunities: opportunitiesResult.data ?? [],
      provenance: { source: 'AuthorityIQ live database', generatedAt: new Date().toISOString() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DASHBOARD_LOAD_FAILED';
    const status = message === 'AUTH_REQUIRED' || message === 'AUTH_INVALID' ? 401 : message === 'WORKSPACE_FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
