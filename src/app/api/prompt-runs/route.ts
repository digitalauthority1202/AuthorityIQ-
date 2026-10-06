import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, requireWorkspaceMember } from '@/lib/auth';
import { createProvider } from '@/lib/ai/http-provider';
import { createIdempotencyKey, runPrompt } from '@/lib/ai/prompt-runner';
import { extractObservations, rankRecommendations } from '@/lib/extraction/extract-observations';
import { calculateAuthorityMetrics } from '@/lib/scoring/authority';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const inputSchema = z.object({
  workspaceId: z.string().uuid(),
  promptId: z.string().uuid(),
  providerId: z.string().uuid().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(8000).optional(),
});

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'PROMPT_RUN_FAILED';
  const status = message === 'AUTH_REQUIRED' || message === 'AUTH_INVALID' ? 401
    : message === 'WORKSPACE_FORBIDDEN' ? 403
    : message === 'WORKSPACE_NOT_FOUND' || message === 'PROMPT_NOT_FOUND' || message === 'PROVIDER_NOT_FOUND' ? 404
    : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = inputSchema.parse(await request.json());
    await requireWorkspaceMember(user.id, body.workspaceId);

    const admin = createSupabaseAdminClient();
    const { data: prompt, error: promptError } = await admin
      .from('prompts')
      .select('id, workspace_id, text, commercial_intent')
      .eq('id', body.promptId)
      .eq('workspace_id', body.workspaceId)
      .eq('active', true)
      .maybeSingle();
    if (promptError || !prompt) throw new Error('PROMPT_NOT_FOUND');

    const providerQuery = admin
      .from('ai_providers')
      .select('id, provider, model')
      .eq('workspace_id', body.workspaceId)
      .eq('enabled', true);
    const { data: providers, error: providerError } = body.providerId
      ? await providerQuery.eq('id', body.providerId).limit(1)
      : await providerQuery.limit(1);
    if (providerError || !providers?.[0]) throw new Error('PROVIDER_NOT_FOUND');
    const configured = providers[0];

    const { data: brand } = await admin
      .from('brands')
      .select('id, name')
      .eq('workspace_id', body.workspaceId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!brand) throw new Error('BRAND_NOT_FOUND');

    const { data: competitors } = await admin
      .from('competitors')
      .select('id, name')
      .eq('workspace_id', body.workspaceId);

    const provider = createProvider(configured.provider as 'openai' | 'anthropic' | 'google', configured.model);
    const runInput = {
      workspaceId: body.workspaceId,
      promptId: prompt.id,
      providerId: configured.id,
      prompt: prompt.text,
      model: configured.model,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
    };
    const idempotencyKey = createIdempotencyKey(runInput);

    const existing = await admin
      .from('prompt_runs')
      .select('id, status, idempotency_key, created_at')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing.data?.id && existing.data.status === 'succeeded') {
      return NextResponse.json({ runId: existing.data.id, status: existing.data.status, reused: true });
    }

    const { data: run, error: runError } = await admin
      .from('prompt_runs')
      .insert({
        workspace_id: body.workspaceId,
        prompt_id: prompt.id,
        provider_id: configured.id,
        status: 'running',
        idempotency_key: idempotencyKey,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (runError || !run) {
      // A concurrent request may have created the same idempotent run.
      const retry = await admin.from('prompt_runs').select('id, status').eq('idempotency_key', idempotencyKey).maybeSingle();
      if (retry.data?.id) return NextResponse.json({ runId: retry.data.id, status: retry.data.status, reused: true });
      throw new Error(`RUN_CREATE_FAILED${runError?.message ? `: ${runError.message}` : ''}`);
    }

    try {
      const result = await runPrompt(provider, runInput, {
        timeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 30000),
        retries: Number(process.env.AI_REQUEST_MAX_RETRIES ?? 2),
      });

      const responseInsert = await admin.from('ai_responses').insert({
        prompt_run_id: run.id,
        provider: result.response.provider,
        model: result.response.model,
        response_text: result.response.text,
        normalized_json: result.response.raw,
        input_tokens: result.response.usage?.inputTokens ?? null,
        output_tokens: result.response.usage?.outputTokens ?? null,
        estimated_cost: provider.estimateCost(result.response.usage ?? {}, result.response.model),
      }).select('id').single();
      if (responseInsert.error) throw new Error(`RESPONSE_PERSIST_FAILED: ${responseInsert.error.message}`);

      const observations = extractObservations(result.response.text, {
        brand: brand.name,
        competitors: (competitors ?? []).map((item) => item.name),
      });
      const recommendations = rankRecommendations(observations);

      if (observations.length) {
        const mentionRows = observations.map((item) => ({
          prompt_run_id: run.id,
          entity_name: item.entityName,
          entity_type: item.entityType,
          confidence: item.confidence,
        }));
        const { error } = await admin.from('mentions').insert(mentionRows);
        if (error) throw new Error(`MENTION_PERSIST_FAILED: ${error.message}`);
      }

      const competitorByName = new Map((competitors ?? []).map((item) => [item.name.toLowerCase(), item.id]));
      if (recommendations.length) {
        const rows = recommendations.map((item) => ({
          prompt_run_id: run.id,
          brand_id: item.entityType === 'brand' ? brand.id : null,
          competitor_id: item.entityType === 'competitor' ? competitorByName.get(item.entityName.toLowerCase()) ?? null : null,
          rank: item.rank ?? null,
          recommended: item.recommended,
          confidence: item.confidence,
        }));
        const { error } = await admin.from('recommendations').insert(rows);
        if (error) throw new Error(`RECOMMENDATION_PERSIST_FAILED: ${error.message}`);
      }

      const targetMentions = observations.filter((item) => item.entityType === 'brand').length;
      const targetRecommendations = recommendations.filter((item) => item.entityType === 'brand').length;
      const competitorRecommendations = recommendations.filter((item) => item.entityType === 'competitor').length;
      const averageConfidence = observations.length
        ? observations.reduce((sum, item) => sum + item.confidence, 0) / observations.length
        : 0;
      const metrics = calculateAuthorityMetrics({
        targetRecommendations,
        totalRecommendations: recommendations.length,
        targetMentions,
        totalMentions: observations.length,
        targetCitations: 0,
        totalCitations: 0,
        competitorRecommendations,
        observations: observations.length,
        averageConfidence,
      });

      const scoreRows = [
        ['recommendation_share', metrics.recommendationShare],
        ['visibility', metrics.visibilityScore],
        ['citation_share', metrics.citationShare],
        ['competitive', metrics.competitiveScore],
        ['authority', metrics.authorityScore],
      ].map(([scoreType, score]) => ({
        workspace_id: body.workspaceId,
        brand_id: brand.id,
        score_type: scoreType,
        score,
        formula_version: metrics.formulaVersion,
        observation_count: observations.length,
        confidence: averageConfidence,
      }));
      const { error: scoreError } = await admin.from('authority_scores').insert(scoreRows);
      if (scoreError) throw new Error(`SCORE_PERSIST_FAILED: ${scoreError.message}`);

      await admin.from('prompt_runs').update({
        status: 'succeeded',
        completed_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      }).eq('id', run.id);

      await admin.from('audit_events').insert({
        organization_id: (await requireWorkspaceMember(user.id, body.workspaceId)).workspace.organization_id,
        user_id: user.id,
        action: 'prompt_run.succeeded',
        resource_type: 'prompt_run',
        resource_id: run.id,
        metadata: { provider: configured.provider, model: configured.model, durationMs: result.durationMs },
      });

      return NextResponse.json({
        runId: run.id,
        status: 'succeeded',
        reused: false,
        metrics,
        observationCount: observations.length,
      }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PROMPT_RUN_FAILED';
      await admin.from('prompt_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_code: message.split(':')[0].slice(0, 80),
        error_message: message.slice(0, 1000),
      }).eq('id', run.id);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
