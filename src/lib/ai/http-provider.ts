import type { AIProvider, NormalizedResponse, PromptRequest, ProviderName } from './provider';

export interface HttpProviderConfig {
  name: ProviderName;
  apiKey: string;
  endpoint: string;
}

export class HttpAIProvider implements AIProvider {
  readonly name: ProviderName;
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(config: HttpProviderConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
  }

  async runPrompt(request: PromptRequest): Promise<NormalizedResponse> {
    if (!this.apiKey) throw new Error(`${this.name.toUpperCase()}_API_KEY_MISSING`);
    const body = this.requestBody(request);
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`${this.name.toUpperCase()}_HTTP_${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
    }
    const raw = await response.json();
    return this.normalizeResponse(raw, request);
  }

  normalizeResponse(raw: any, request: PromptRequest): NormalizedResponse {
    const text = this.extractText(raw);
    if (!text) throw new Error(`${this.name.toUpperCase()}_EMPTY_RESPONSE`);
    return { text, provider: this.name, model: request.model, usage: this.extractUsage(raw), raw };
  }

  extractUsage(raw: any) {
    const usage = raw?.usage ?? {};
    return {
      inputTokens: usage.prompt_tokens ?? usage.input_tokens,
      outputTokens: usage.completion_tokens ?? usage.output_tokens,
    };
  }

  estimateCost(usage: { inputTokens?: number; outputTokens?: number }, model: string): number {
    // Provider/model prices change; keep this deliberately conservative until a pricing registry is added.
    const input = usage.inputTokens ?? 0;
    const output = usage.outputTokens ?? 0;
    const multiplier = model.includes('mini') || model.includes('flash') ? 0.5 : 1;
    return ((input * 0.000002) + (output * 0.000008)) * multiplier;
  }

  getProviderMetadata(model: string) {
    return { provider: this.name, model, observationType: 'api_observation' };
  }

  private authHeaders(): Record<string, string> {
    if (this.name === 'anthropic') return { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' };
    if (this.name === 'google') return {};
    return { authorization: `Bearer ${this.apiKey}` };
  }

  private requestBody(request: PromptRequest): Record<string, unknown> {
    if (this.name === 'anthropic') return {
      model: request.model,
      max_tokens: request.maxTokens ?? 1200,
      temperature: request.temperature ?? 0.2,
      messages: [{ role: 'user', content: request.prompt }],
    };
    if (this.name === 'google') return {
      contents: [{ parts: [{ text: request.prompt }] }],
      generationConfig: { temperature: request.temperature ?? 0.2, maxOutputTokens: request.maxTokens ?? 1200 },
    };
    return {
      model: request.model,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1200,
      messages: [{ role: 'user', content: request.prompt }],
    };
  }

  private extractText(raw: any): string {
    if (this.name === 'anthropic') return raw?.content?.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n') ?? '';
    if (this.name === 'google') return raw?.candidates?.[0]?.content?.parts?.map((x: any) => x.text ?? '').join('') ?? '';
    return raw?.choices?.[0]?.message?.content ?? '';
  }
}

export function createProvider(name: ProviderName, model: string): HttpAIProvider {
  if (name === 'openai') return new HttpAIProvider({ name, apiKey: process.env.OPENAI_API_KEY ?? '', endpoint: 'https://api.openai.com/v1/chat/completions' });
  if (name === 'anthropic') return new HttpAIProvider({ name, apiKey: process.env.ANTHROPIC_API_KEY ?? '', endpoint: 'https://api.anthropic.com/v1/messages' });
  return new HttpAIProvider({ name, apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '', endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? ''}` });
}
