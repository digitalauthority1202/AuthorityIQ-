export type ProviderName = 'openai' | 'anthropic' | 'google';

export interface PromptRequest {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface NormalizedResponse {
  text: string;
  provider: ProviderName;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  raw: unknown;
}

export interface AIProvider {
  readonly name: ProviderName;
  runPrompt(request: PromptRequest): Promise<NormalizedResponse>;
  normalizeResponse(raw: unknown, request: PromptRequest): NormalizedResponse;
  extractUsage(raw: unknown): { inputTokens?: number; outputTokens?: number };
  estimateCost(usage: { inputTokens?: number; outputTokens?: number }, model: string): number;
  getProviderMetadata(model: string): Record<string, unknown>;
}
