/**
 * OCR for Capture Hub, over Azure AI Vision's Image Analysis (Read) API.
 *
 * Chosen as the interim provider on the way to a different one -- the whole
 * point of OcrProvider is that nothing outside this file knows which service
 * answers `recognize()`. Swapping providers later means writing one new
 * `createXOcr()` and changing what `getOcrProvider()` constructs; the route
 * and everything upstream of it stays the same.
 *
 * Configured entirely from the environment, mirroring modelarts.ts: unset,
 * `getOcrProvider()` returns null, the route reports `available: false`, and
 * Capture Hub falls back to typed/pasted text only. Nothing here is required
 * for the rest of the app to work.
 *
 * Credentials stay server-side and must never carry a NEXT_PUBLIC_ prefix --
 * the frontend is a static export, so anything with that prefix ships to the
 * browser.
 */

export interface OcrProvider {
  /** `image` is raw bytes, not a data: URL -- callers strip the base64 header before this. */
  recognize(image: Buffer, mimeType: string): Promise<string>;
}

const REQUEST_TIMEOUT_MS = 20_000;

type AzureVisionConfig = {
  endpoint: string;
  apiKey: string;
};

function readConfig(): AzureVisionConfig | null {
  const endpoint = process.env.AZURE_VISION_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_VISION_KEY?.trim();
  if (!endpoint || !apiKey) return null;
  return { endpoint: endpoint.replace(/\/+$/, ''), apiKey };
}

export function isOcrConfigured(): boolean {
  return readConfig() !== null;
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
  const config = readConfig();
  return config ? createAzureVisionOcr(config) : null;
}
