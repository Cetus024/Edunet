import { setTimeout as delay } from 'node:timers/promises';

import type { AnalysisModel } from './explanation-analysis.js';
import { AnalysisProviderError } from './analysis-error.js';

/**
 * Gemini Developer API adapter for Capture Hub.
 *
 * Gemini 3.5 Flash handles handwritten-note OCR, note summaries, and
 * evaluation/scoring. Capture Hub Generate Notes and the Spidey chatbot use
 * Gemini 3.1 Flash-Lite via getGeminiChatModel() so they stay cheaper. Embeddings stay in embeddings.ts
 * so the 1536-d schema contract lives next to the Foundry fallback. Credentials
 * are server-only and must never use a NEXT_PUBLIC_ prefix.
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';
export const DEFAULT_GEMINI_CHAT_MODEL = 'gemini-3.1-flash-lite';
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_TIMEOUT_MS = 60_000;

export type GeminiConfig = {
  apiKey: string;
  model: string;
};

export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type GeminiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export type GeminiGenerateOptions = {
  maxOutputTokens?: number;
  timeoutMs?: number;
  thinkingLevel?: GeminiThinkingLevel;
};

export function readGeminiConfig(): GeminiConfig | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
  };
}

export function isGeminiConfigured(): boolean {
  return readGeminiConfig() !== null;
}

export function readGeminiChatConfig(): GeminiConfig | null {
  const config = readGeminiConfig();
  if (!config) return null;
  return {
    ...config,
    model: process.env.GEMINI_CHAT_MODEL?.trim() || DEFAULT_GEMINI_CHAT_MODEL,
  };
}

export function getGeminiChatModel(): AnalysisModel | null {
  const config = readGeminiChatConfig();
  if (!config) return null;
  return {
    async complete(prompt, options) {
      const visible = Math.min(options?.maxTokens ?? 700, 4000);
      return generateGeminiContent(
        [{ text: prompt }],
        {
          maxOutputTokens: Math.min(visible + 1024, 8192),
          thinkingLevel: 'low',
          ...(options?.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
        },
        config,
      );
    },
  };
}

export function retryDelayMs(response: Response): number {
  const milliseconds = response.headers?.get('retry-after-ms');
  if (milliseconds && Number.isFinite(Number(milliseconds))) return Math.max(0, Number(milliseconds));
  const value = response.headers?.get('retry-after');
  if (!value) return 1000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 1000;
}

export function extractGeminiVisibleText(payload: unknown): { text: string; finishReason: string | undefined } {
  const candidate = (payload as {
    candidates?: { finishReason?: string; content?: { parts?: unknown[] } }[];
  })?.candidates?.[0];
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  const text = parts.map((part) => {
    if (!part || typeof part !== 'object') return '';
    const record = part as { text?: unknown; thought?: unknown };
    if (record.thought === true) return '';
    return typeof record.text === 'string' ? record.text : '';
  }).join('');
  return { text, finishReason: candidate?.finishReason };
}

function thinkingLevelForTokens(maxTokens: number | undefined): GeminiThinkingLevel {
  return (maxTokens ?? 900) <= 300 ? 'low' : 'medium';
}

export async function generateGeminiContent(
  parts: readonly GeminiPart[],
  options: GeminiGenerateOptions = {},
  config: GeminiConfig | null = readGeminiConfig(),
): Promise<string> {
  if (!config) throw new AnalysisProviderError('provider_error');

  const abort = new AbortController();
  const timeoutMs = Math.min(options.timeoutMs ?? REQUEST_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const deadline = Date.now() + timeoutMs;
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  const thinkingLevel = options.thinkingLevel ?? 'low';
  const maxOutputTokens = Math.min(options.maxOutputTokens ?? 900, 8192);

  try {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(
        `${GEMINI_API_BASE}/models/${encodeURIComponent(config.model)}:generateContent`,
        {
          method: 'POST',
          signal: abort.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': config.apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              maxOutputTokens,
              thinkingConfig: { thinkingLevel },
            },
          }),
        },
      );

      if (!response.ok) {
        const retryable = response.status === 429 || response.status === 503;
        const waitMs = retryDelayMs(response);
        await response.body?.cancel();
        if (retryable && attempt < 2 && Date.now() + waitMs + 1000 < deadline) {
          await delay(waitMs, undefined, { signal: abort.signal });
          continue;
        }
        throw new AnalysisProviderError(
          response.status === 429 ? 'rate_limited' : 'provider_error',
          response.status === 429 ? Math.ceil(waitMs / 1000) : undefined,
        );
      }

      const { text, finishReason } = extractGeminiVisibleText(await response.json());
      if (finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH') {
        throw new AnalysisProviderError('incomplete_output');
      }
      return text;
    }
  } catch (error) {
    if (abort.signal.aborted) throw new AnalysisProviderError('timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function createGeminiModel(config: GeminiConfig): AnalysisModel {
  return {
    async complete(prompt, options) {
      const visible = Math.min(options?.maxTokens ?? 900, 4000);
      const thinkingLevel = thinkingLevelForTokens(options?.maxTokens);
      const thinkingHeadroom = thinkingLevel === 'low' ? 1024 : 2048;
      return generateGeminiContent(
        [{ text: prompt }],
        {
          maxOutputTokens: Math.min(visible + thinkingHeadroom, 8192),
          thinkingLevel,
          ...(options?.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
        },
        config,
      );
    },
  };
}

export function getGeminiModel(): AnalysisModel | null {
  const config = readGeminiConfig();
  return config ? createGeminiModel(config) : null;
}
