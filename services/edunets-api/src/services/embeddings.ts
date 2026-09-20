import { REFERENCE_EMBEDDING_DIMENSIONS } from '../../../../database/schema/reference.js';
import { AnalysisProviderError } from './analysis-error.js';
import { retryDelayMs } from './gemini.js';

/**
 * Embedding adapters for Capture Hub retrieval and staff textbook ingest.
 *
 * Gemini `gemini-embedding-001` is preferred when GEMINI_API_KEY is set, with
 * output truncated to 1536 dimensions to match the pgvector schema. Microsoft
 * Foundry remains the fallback. Credentials stay server-side and must never
 * use a NEXT_PUBLIC_ prefix.
 */

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_BATCH = 16;
export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type AzureFoundryEmbeddingConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
};

type GeminiEmbeddingConfig = {
  apiKey: string;
  model: string;
};

export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

function readFoundryConfig(): AzureFoundryEmbeddingConfig | null {
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY?.trim();
  const model = process.env.AZURE_FOUNDRY_EMBEDDING_MODEL?.trim();
  if (!endpoint || !apiKey || !model) return null;
  return { endpoint: endpoint.replace(/\/+$/, ''), apiKey, model };
}

function readGeminiEmbeddingConfig(): GeminiEmbeddingConfig | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.GEMINI_EMBEDDING_MODEL?.trim() || DEFAULT_GEMINI_EMBEDDING_MODEL,
  };
}

function embeddingsUrl(endpoint: string): string {
  const base = endpoint.replace(/\/+$/, '');
  return base.endsWith('/openai/v1')
    ? `${base}/embeddings`
    : `${base}/openai/v1/embeddings`;
}

export function isEmbeddingsConfigured(): boolean {
  return readGeminiEmbeddingConfig() !== null || readFoundryConfig() !== null;
}

export interface EmbeddingProvider {
  embed(texts: readonly string[], options?: { taskType?: EmbeddingTaskType }): Promise<number[][]>;
}

function assertDimensions(vector: number[]): number[] {
  if (vector.length !== REFERENCE_EMBEDDING_DIMENSIONS) {
    throw new AnalysisProviderError('provider_error');
  }
  return vector;
}

/** Required for gemini-embedding-001 when outputDimensionality is not 3072. */
export function l2Normalize(vector: number[]): number[] {
  let sumSquares = 0;
  for (const value of vector) sumSquares += value * value;
  const norm = Math.sqrt(sumSquares);
  if (!Number.isFinite(norm) || norm === 0) return vector;
  return vector.map((value) => value / norm);
}

export function createAzureFoundryEmbeddings(config: AzureFoundryEmbeddingConfig): EmbeddingProvider {
  return {
    async embed(texts) {
      const inputs = texts.map((text) => text.trim()).filter(Boolean);
      if (inputs.length === 0) return [];

      const vectors: number[][] = [];
      for (let offset = 0; offset < inputs.length; offset += MAX_BATCH) {
        const batch = inputs.slice(offset, offset + MAX_BATCH);
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
        try {
          const response = await fetch(embeddingsUrl(config.endpoint), {
            method: 'POST',
            signal: abort.signal,
            headers: {
              'Content-Type': 'application/json',
              'api-key': config.apiKey,
            },
            body: JSON.stringify({
              model: config.model,
              input: batch,
            }),
          });
          if (!response.ok) {
            await response.body?.cancel();
            throw new AnalysisProviderError(
              response.status === 429 ? 'rate_limited' : 'provider_error',
              response.status === 429 ? 60 : undefined,
            );
          }
          const payload = await response.json() as {
            data?: { index?: number; embedding?: number[] }[];
          };
          const rows = [...(payload.data ?? [])].sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
          if (rows.length !== batch.length) throw new AnalysisProviderError('provider_error');
          for (const row of rows) {
            if (!Array.isArray(row.embedding)) throw new AnalysisProviderError('provider_error');
            vectors.push(assertDimensions(row.embedding));
          }
        } catch (error) {
          if (abort.signal.aborted) throw new AnalysisProviderError('timeout');
          throw error;
        } finally {
          clearTimeout(timer);
        }
      }
      return vectors;
    },
  };
}

export function createGeminiEmbeddings(config: GeminiEmbeddingConfig): EmbeddingProvider {
  return {
    async embed(texts, options) {
      const inputs = texts.map((text) => text.trim()).filter(Boolean);
      if (inputs.length === 0) return [];

      const taskType = options?.taskType ?? 'RETRIEVAL_DOCUMENT';
      const vectors: number[][] = [];
      for (let offset = 0; offset < inputs.length; offset += MAX_BATCH) {
        const batch = inputs.slice(offset, offset + MAX_BATCH);
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
        try {
          const response = await fetch(
            `${GEMINI_API_BASE}/models/${encodeURIComponent(config.model)}:batchEmbedContents`,
            {
              method: 'POST',
              signal: abort.signal,
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': config.apiKey,
              },
              body: JSON.stringify({
                requests: batch.map((text) => ({
                  model: `models/${config.model}`,
                  content: { parts: [{ text }] },
                  taskType,
                  outputDimensionality: REFERENCE_EMBEDDING_DIMENSIONS,
                })),
              }),
            },
          );
          if (!response.ok) {
            const retryAfter = response.status === 429 ? Math.ceil(retryDelayMs(response) / 1000) : undefined;
            await response.body?.cancel();
            throw new AnalysisProviderError(
              response.status === 429 ? 'rate_limited' : 'provider_error',
              retryAfter,
            );
          }
          const payload = await response.json() as {
            embeddings?: { values?: number[] }[];
          };
          const rows = payload.embeddings ?? [];
          if (rows.length !== batch.length) throw new AnalysisProviderError('provider_error');
          for (const row of rows) {
            if (!Array.isArray(row.values)) throw new AnalysisProviderError('provider_error');
            vectors.push(l2Normalize(assertDimensions(row.values)));
          }
        } catch (error) {
          if (abort.signal.aborted) throw new AnalysisProviderError('timeout');
          throw error;
        } finally {
          clearTimeout(timer);
        }
      }
      return vectors;
    },
  };
}

export function getEmbeddingProvider(): EmbeddingProvider | null {
  const gemini = readGeminiEmbeddingConfig();
  if (gemini) return createGeminiEmbeddings(gemini);
  const foundry = readFoundryConfig();
  return foundry ? createAzureFoundryEmbeddings(foundry) : null;
}
