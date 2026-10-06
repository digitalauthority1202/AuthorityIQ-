import { createHash } from 'node:crypto';
import type { AIProvider, PromptRequest, NormalizedResponse } from './provider';

export interface PromptRunInput extends PromptRequest {
  workspaceId: string;
  promptId: string;
  providerId?: string;
}

export interface PromptRunResult {
  idempotencyKey: string;
  response: NormalizedResponse;
  durationMs: number;
}

export function createIdempotencyKey(input: PromptRunInput): string {
  return createHash('sha256')
    .update(JSON.stringify({
      workspaceId: input.workspaceId,
      promptId: input.promptId,
      providerId: input.providerId,
      prompt: input.prompt,
      model: input.model,
    }))
    .digest('hex');
}

export async function runPrompt(
  provider: AIProvider,
  input: PromptRunInput,
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<PromptRunResult> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const retries = options.retries ?? 2;
  const started = Date.now();
  const request: PromptRequest = {
    prompt: input.prompt,
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await Promise.race([
        provider.runPrompt(request),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('PROVIDER_TIMEOUT')), timeoutMs),
        ),
      ]);

      return {
        idempotencyKey: createIdempotencyKey(input),
        response,
        durationMs: Date.now() - started,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = 500 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('PROMPT_RUN_FAILED');
}
