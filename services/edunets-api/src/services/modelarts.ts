import type { AnalysisModel } from './explanation-analysis.js';

/**
 * Huawei ModelArts inference, over the OpenAI-compatible chat-completions shape
 * its MaaS endpoints expose.
 *
 * Configured entirely from the environment so the deployment decides whether
 * analysis is available at all. Nothing here is required: with no endpoint
 * configured `getAnalysisModel()` returns null, the route skips the call, and
 * the discussion room falls back to the deterministic rubric. A student then
 * still sees coverage — never a broken panel.
 *
 * The credentials stay server-side. They must never be given a NEXT_PUBLIC_
 * prefix: the frontend is a static export, so anything with that prefix is
 * baked into files the browser downloads.
 */

const REQUEST_TIMEOUT_MS = 25_000;

type ModelArtsConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
};

function readConfig(): ModelArtsConfig | null {
  const endpoint = process.env.MODELARTS_ENDPOINT?.trim();
  const apiKey = process.env.MODELARTS_API_KEY?.trim();
  const model = process.env.MODELARTS_MODEL?.trim();
  if (!endpoint || !apiKey || !model) return null;
  return { endpoint: endpoint.replace(/\/+$/, ''), apiKey, model };
}

export function isAnalysisConfigured(): boolean {
  return readConfig() !== null;
}

export function createModelArtsModel(config: ModelArtsConfig): AnalysisModel {
  return {
    async complete(prompt: string, options): Promise<string> {
      // Serverless invocations have a wall clock. An inference call that hangs
      // has to fail fast enough for the caller to fall back to the rubric
      // rather than taking the whole request down with it.
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), Math.min(options?.timeoutMs ?? REQUEST_TIMEOUT_MS, 45_000));

      try {
        const response = await fetch(`${config.endpoint}/chat/completions`, {
          method: 'POST',
          signal: abort.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            // Marking should not vary run to run for the same transcript.
            temperature: 0,
            max_tokens: Math.min(options?.maxTokens ?? 900, 4000),
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!response.ok) {
          // The body can echo the request, so it is not logged. The caller only
          // needs to know the call failed.
          throw new Error(`ModelArts returned HTTP ${response.status}`);
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

export function getAnalysisModel(): AnalysisModel | null {
  const config = readConfig();
  return config ? createModelArtsModel(config) : null;
}
