import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAzureVisionOcr, getOcrProvider, isOcrConfigured } from '../src/services/ocr.js';

const CONFIG = { endpoint: 'https://example.cognitiveservices.azure.com', apiKey: 'test-key' };

describe('createAzureVisionOcr', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AZURE_VISION_ENDPOINT;
    delete process.env.AZURE_VISION_KEY;
  });

  it('sends the image bytes with the subscription key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ readResult: { content: 'Mitosis produces two cells' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createAzureVisionOcr(CONFIG);
    const text = await provider.recognize(Buffer.from('fake-image-bytes'), 'image/png');

    expect(text).toBe('Mitosis produces two cells');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(CONFIG.endpoint);
    expect(url).toContain('features=read');
    expect(init.headers['Ocp-Apim-Subscription-Key']).toBe('test-key');
    expect(init.headers['Content-Type']).toBe('image/png');
    expect(init.body).toBeInstanceOf(Uint8Array);
  });

  it('reads the pre-GA blocks/lines shape when content is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        readResult: {
          blocks: [{ lines: [{ text: 'Line one' }, { text: 'Line two' }] }],
        },
      }),
    }));

    const text = await createAzureVisionOcr(CONFIG).recognize(Buffer.from('x'), 'image/jpeg');
    expect(text).toBe('Line one\nLine two');
  });

  it('returns empty text for a response with neither known shape, rather than throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect(await createAzureVisionOcr(CONFIG).recognize(Buffer.from('x'), 'image/png')).toBe('');
  });

  it('throws on a non-OK response rather than silently returning nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    await expect(createAzureVisionOcr(CONFIG).recognize(Buffer.from('x'), 'image/png'))
      .rejects.toThrow('401');
  });

  it('strips a trailing slash from the configured endpoint before building the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ readResult: { content: '' } }) });
    vi.stubGlobal('fetch', fetchMock);
    process.env.AZURE_VISION_ENDPOINT = 'https://example.cognitiveservices.azure.com/';
    process.env.AZURE_VISION_KEY = 'k';
    await getOcrProvider()?.recognize(Buffer.from('x'), 'image/png');
    expect(fetchMock.mock.calls[0][0]).not.toContain('.com//computervision');
  });
});

describe('getOcrProvider / isOcrConfigured', () => {
  afterEach(() => {
    delete process.env.AZURE_VISION_ENDPOINT;
    delete process.env.AZURE_VISION_KEY;
  });

  it('is unconfigured with no environment variables set', () => {
    expect(isOcrConfigured()).toBe(false);
    expect(getOcrProvider()).toBeNull();
  });

  it('is unconfigured when only one of the two variables is set', () => {
    process.env.AZURE_VISION_ENDPOINT = 'https://example.cognitiveservices.azure.com';
    expect(isOcrConfigured()).toBe(false);
  });

  it('is configured once both variables are set', () => {
    process.env.AZURE_VISION_ENDPOINT = 'https://example.cognitiveservices.azure.com';
    process.env.AZURE_VISION_KEY = 'k';
    expect(isOcrConfigured()).toBe(true);
    expect(getOcrProvider()).not.toBeNull();
  });
});
