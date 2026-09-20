/**
 * OCR for Capture Hub.
 *
 * Gemini 3.5 Flash is the primary handwritten-note reader. Azure AI Vision
 * remains a fallback when GEMINI_API_KEY is absent. Nothing outside this file
 * knows which service answers `recognize()`; swapping providers later means
 * writing one new `createXOcr()` and changing what `getOcrProvider()`
 * constructs.
 *
 * Configured entirely from the environment: unset, `getOcrProvider()` returns
 * null, the route reports `available: false`, and Capture Hub falls back to
 * typed/pasted text only. Credentials stay server-side and must never carry a
 * NEXT_PUBLIC_ prefix.
 */

import { generateGeminiContent, isGeminiConfigured, readGeminiConfig } from './gemini.js';

export interface OcrProvider {
  /** `image` is raw bytes, not a data: URL -- callers strip the base64 header before this. */
  recognize(image: Buffer, mimeType: string): Promise<string>;
}

const REQUEST_TIMEOUT_MS = 20_000;
const GEMINI_OCR_TIMEOUT_MS = 45_000;

const GEMINI_OCR_PROMPT = [
  'Transcribe every handwritten and printed word in this image of student notes.',
  'Preserve the original line breaks and order.',
  'Do not translate, correct, summarise, or add commentary.',
  'If nothing is readable, return an empty string.',
].join(' ');

type AzureVisionConfig = {
  endpoint: string;
  apiKey: string;
};

function readAzureConfig(): AzureVisionConfig | null {
  const endpoint = process.env.AZURE_VISION_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_VISION_KEY?.trim();
  if (!endpoint || !apiKey) return null;
  return { endpoint: endpoint.replace(/\/+$/, ''), apiKey };
}

export function isOcrConfigured(): boolean {
  return isGeminiConfigured() || readAzureConfig() !== null;
}

/**
 * Azure has returned Read results in two shapes across API versions: a single
 * flattened `readResult.content` string (2024-02-01 GA), and, before that,
 * `readResult.blocks[].lines[].text` with no top-level string. Tried in that
 * order rather than pinned to one, since this has never run against a live
 * account to confirm which version an eventual key will be provisioned
 * against.
 */
function extractText(payload: unknown): string {
  const readResult = (payload as { readResult?: unknown })?.readResult as
    | { content?: unknown; blocks?: unknown }
    | undefined;
  if (!readResult) return '';

  if (typeof readResult.content === 'string') return readResult.content;

  if (Array.isArray(readResult.blocks)) {
    const lines: string[] = [];
    for (const block of readResult.blocks) {
      const blockLines = (block as { lines?: unknown })?.lines;
      if (!Array.isArray(blockLines)) continue;
      for (const line of blockLines) {
        const text = (line as { text?: unknown })?.text;
        if (typeof text === 'string') lines.push(text);
      }
    }
    return lines.join('\n');
  }

  return '';
}

export function createGeminiOcr(): OcrProvider {
  return {
    async recognize(image: Buffer, mimeType: string): Promise<string> {
      const config = readGeminiConfig();
      if (!config) throw new Error('Gemini OCR is not configured');
      const text = await generateGeminiContent(
        [
          { text: GEMINI_OCR_PROMPT },
          {
            inline_data: {
              mime_type: mimeType || 'image/png',
              data: image.toString('base64'),
            },
          },
        ],
        {
          maxOutputTokens: 4096,
          timeoutMs: GEMINI_OCR_TIMEOUT_MS,
          thinkingLevel: 'minimal',
        },
        config,
      );
      return text.trim();
    },
  };
}

export function createAzureVisionOcr(config: AzureVisionConfig): OcrProvider {
  return {
    async recognize(image: Buffer, mimeType: string): Promise<string> {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(
          `${config.endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read`,
          {
            method: 'POST',
            signal: abort.signal,
            headers: {
              'Ocp-Apim-Subscription-Key': config.apiKey,
              'Content-Type': mimeType || 'application/octet-stream',
            },
            // Buffer satisfies BodyInit at runtime (it is a Uint8Array), but this
            // TS config's fetch types don't accept it directly.
            body: new Uint8Array(image),
          },
        );

        if (!response.ok) {
          // The body can echo request details; not logged, only the failure matters upstream.
          throw new Error(`Azure Vision returned HTTP ${response.status}`);
        }

        return extractText(await response.json());
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function getOcrProvider(): OcrProvider | null {
  if (isGeminiConfigured()) return createGeminiOcr();
  const config = readAzureConfig();
  return config ? createAzureVisionOcr(config) : null;
}
