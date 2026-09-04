import type { AnalysisModel } from './explanation-analysis.js';

/**
 * Microsoft Foundry chat completions adapter.
 *
 * Capture Hub only depends on AnalysisModel, so the provider can be replaced
 * later without changing the OCR, summary, or syllabus-evaluation routes.
 * Credentials are server-only and must never use a NEXT_PUBLIC_ prefix.
 */

const REQUEST_TIMEOUT_MS = 25_000;

type AzureFoundryConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
};

function readConfig(): AzureFoundryConfig | null {
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY?.trim();
  const model = process.env.AZURE_FOUNDRY_MODEL?.trim();
  if (!endpoint || !apiKey || !model) return null;
  return { endpoint: endpoint.replace(/\/+$/, ''), apiKey, model };
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
  return {
    async complete(prompt: string): Promise<string> {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(chatCompletionsUrl(config.endpoint), {
          method: 'POST',
          signal: abort.signal,
          headers: {
            'Content-Type': 'application/json',
            'api-key': config.apiKey,
          },
          body: JSON.stringify({
            model: config.model,
            temperature: 0,
            max_tokens: 900,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!response.ok) {
          throw new Error(`Microsoft Foundry returned HTTP ${response.status}`);
        }

        const payload = await response.json() as {
          choices?: { message?: { content?: unknown } }[];
        };
        const content = payload.choices?.[0]?.message?.content;
        return typeof content === 'string' ? content : '';
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
