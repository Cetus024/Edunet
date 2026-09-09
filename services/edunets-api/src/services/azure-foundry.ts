import type { AnalysisModel } from './explanation-analysis.js';
import { setTimeout as delay } from 'node:timers/promises';
import { AnalysisProviderError } from './analysis-error.js';

/**
 * Microsoft Foundry chat completions adapter.
 *
 * Capture Hub only depends on AnalysisModel, so the provider can be replaced
 * later without changing the OCR, summary, or syllabus-evaluation routes.
 * Credentials are server-only and must never use a NEXT_PUBLIC_ prefix.
 */

const REQUEST_TIMEOUT_MS = 25_000;

function retryDelayMs(response: Response): number {
  const milliseconds = response.headers?.get('retry-after-ms');
  if (milliseconds && Number.isFinite(Number(milliseconds))) return Math.max(0, Number(milliseconds));
  const value = response.headers?.get('retry-after');
  if (!value) return 1000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 1000;
}

type AzureFoundryConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
  /** Underlying model ID when the Azure deployment uses a custom name. */
  modelId?: string;
};

function readConfig(): AzureFoundryConfig | null {
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY?.trim();
  const model = process.env.AZURE_FOUNDRY_MODEL?.trim();
  if (!endpoint || !apiKey || !model) return null;
  const modelId = process.env.AZURE_FOUNDRY_MODEL_ID?.trim();
  return { endpoint: endpoint.replace(/\/+$/, ''), apiKey, model, ...(modelId ? { modelId } : {}) };
}

function chatCompletionsUrl(endpoint: string): string {
  const base = endpoint.replace(/\/+$/, '');
  return base.endsWith('/openai/v1')
    ? `${base}/chat/completions`
    : `${base}/openai/v1/chat/completions`;
}

export function isAzureFoundryConfigured(): boolean {
  return readConfig() !== null;
}

export function createAzureFoundryModel(config: AzureFoundryConfig): AnalysisModel {
  const isReasoningModel = /^(?:gpt-6-astra|gpt-5-mini)(?:-|$)/i.test(config.modelId || config.model);
  return {
    async complete(prompt: string, options): Promise<string> {
      const abort = new AbortController();
      const timeoutMs = Math.min(options?.timeoutMs ?? (isReasoningModel ? 45_000 : REQUEST_TIMEOUT_MS), 45_000);
      const outputTokens = Math.min(options?.maxTokens ?? 900, 4000);
      const deadline = Date.now() + timeoutMs;
      const timer = setTimeout(() => abort.abort(), timeoutMs);

      try {
        for (let attempt = 0; ; attempt++) {
          const response = await fetch(chatCompletionsUrl(config.endpoint), {
            method: 'POST',
            signal: abort.signal,
            headers: {
              'Content-Type': 'application/json',
              'api-key': config.apiKey,
            },
            body: JSON.stringify({
              model: config.model,
              ...(isReasoningModel ? {
                // These models use reasoning and count it against completion
                // tokens. Reserve room beyond the caller's visible-output target.
                reasoning_effort: 'low',
                max_completion_tokens: outputTokens + 4096,
              } : { temperature: 0, max_tokens: outputTokens }),
              messages: [{ role: 'user', content: prompt }],
            }),
          });

          if (!response.ok) {
            const retryable = response.status === 429 || response.status === 503;
            const waitMs = retryDelayMs(response);
            await response.body?.cancel();
            // Keep all attempts within the original deadline. Never retry before
            // Azure's reset time, or keep the student waiting through a long quota reset.
            if (retryable && attempt < 2 && Date.now() + waitMs + 1000 < deadline) {
              await delay(waitMs, undefined, { signal: abort.signal });
              continue;
            }
            throw new AnalysisProviderError(
              response.status === 429 ? 'rate_limited' : 'provider_error',
              response.status === 429 ? Math.ceil(waitMs / 1000) : undefined,
            );
          }

          const payload = await response.json() as {
            choices?: { finish_reason?: string; message?: { content?: unknown } }[];
          };
          if (payload.choices?.[0]?.finish_reason === 'length') {
            throw new AnalysisProviderError('incomplete_output');
          }
          const content = payload.choices?.[0]?.message?.content;
          return typeof content === 'string' ? content : '';
        }
      } catch (error) {
        if (abort.signal.aborted) throw new AnalysisProviderError('timeout');
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function getAzureFoundryModel(): AnalysisModel | null {
  const config = readConfig();
  return config ? createAzureFoundryModel(config) : null;
}
