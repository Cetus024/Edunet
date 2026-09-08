import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAzureFoundryModel,
  getAzureFoundryModel,
  isAzureFoundryConfigured,
} from '../src/services/azure-foundry.js';

const CONFIG = {
  endpoint: 'https://edunet.openai.azure.com',
  apiKey: 'foundry-key',
  model: 'capture-summary',
};

describe('Microsoft Foundry analysis model', () => {
  it('uses Astra-compatible parameters and reserves tokens for reasoning', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: '{"points":["Triangle angles sum to 180 degrees."]}' } }],
    })));
    vi.stubGlobal('fetch', fetchMock);
    await createAzureFoundryModel({ ...CONFIG, model: 'gpt-6-astra' }).complete('summarize', { maxTokens: 250 });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: 'gpt-6-astra', reasoning_effort: 'low', max_completion_tokens: 4346 });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('max_tokens');
  });

  it('supports a custom Azure deployment name and caps the Astra completion budget', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })));
    vi.stubGlobal('fetch', fetchMock);
    await createAzureFoundryModel({ ...CONFIG, modelId: 'gpt-6-astra-2026-09-03' }).complete('test', { maxTokens: 100000 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ model: CONFIG.model, max_completion_tokens: 8096 });
  });

  it('rejects truncated output instead of accepting incomplete JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'length', message: { content: '{"points":[' } }],
    }))));
    await expect(createAzureFoundryModel({ ...CONFIG, model: 'gpt-6-astra' }).complete('test'))
      .rejects.toMatchObject({ reason: 'incomplete_output' });
  });

  it('retries a short rate limit using Azure retry-after-ms', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after-ms': '10' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'recovered' } }] })));
    vi.stubGlobal('fetch', fetchMock);
    const started = Date.now();
    expect(await createAzureFoundryModel(CONFIG).complete('test')).toBe('recovered');
    expect(Date.now() - started).toBeGreaterThanOrEqual(9);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns the reset time instead of retrying a quota wait beyond the request deadline', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('private upstream details', {
      status: 429, headers: { 'retry-after': '60' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createAzureFoundryModel(CONFIG).complete('test')).rejects.toMatchObject({
      reason: 'rate_limited', retryAfterSeconds: 60, message: 'Analysis provider: rate_limited',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('supports Retry-After HTTP dates', async () => {
    const date = new Date(Date.now() + 90_000).toUTCString();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {
      status: 429, headers: { 'retry-after': date },
    })));
    await expect(createAzureFoundryModel(CONFIG).complete('test')).rejects.toMatchObject({
      reason: 'rate_limited', retryAfterSeconds: expect.any(Number),
    });
  });

  it('bounds repeated transient failures to three attempts', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('', {
      status: 503, headers: { 'retry-after-ms': '1' },
    })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createAzureFoundryModel(CONFIG).complete('test')).rejects.toMatchObject({ reason: 'provider_error' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry authentication errors or disclose provider response bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('secret upstream details', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createAzureFoundryModel(CONFIG).complete('test')).rejects.toThrow('Analysis provider: provider_error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a timed out request distinctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    })));
    await expect(createAzureFoundryModel(CONFIG).complete('test', { timeoutMs: 10 }))
      .rejects.toMatchObject({ reason: 'timeout' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AZURE_FOUNDRY_ENDPOINT;
    delete process.env.AZURE_FOUNDRY_API_KEY;
    delete process.env.AZURE_FOUNDRY_MODEL;
    delete process.env.AZURE_FOUNDRY_MODEL_ID;
  });

  it('uses the OpenAI v1 chat-completions route and Azure api-key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"points":["Mitosis"]}' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const reply = await createAzureFoundryModel(CONFIG).complete('Summarize these notes');

    expect(reply).toBe('{"points":["Mitosis"]}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://edunet.openai.azure.com/openai/v1/chat/completions');
    expect(init.headers['api-key']).toBe('foundry-key');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'capture-summary',
      temperature: 0,
    });
  });

  it('does not duplicate /openai/v1 when the copied endpoint already includes it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await createAzureFoundryModel({ ...CONFIG, endpoint: `${CONFIG.endpoint}/openai/v1/` })
      .complete('test');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://edunet.openai.azure.com/openai/v1/chat/completions',
    );
  });

  it('requires endpoint, key, and deployment name before reporting configured', () => {
    process.env.AZURE_FOUNDRY_ENDPOINT = CONFIG.endpoint;
    process.env.AZURE_FOUNDRY_API_KEY = CONFIG.apiKey;
    expect(isAzureFoundryConfigured()).toBe(false);
    expect(getAzureFoundryModel()).toBeNull();

    process.env.AZURE_FOUNDRY_MODEL = CONFIG.model;
    expect(isAzureFoundryConfigured()).toBe(true);
    expect(getAzureFoundryModel()).not.toBeNull();
  });

  it('allows a bounded longer response for step-by-step handwritten analysis', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) });
    vi.stubGlobal('fetch', fetchMock);
    await createAzureFoundryModel(CONFIG).complete('Review solution steps', { maxTokens: 2400, timeoutMs: 45000 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(2400);
    await createAzureFoundryModel(CONFIG).complete('Bound the output', { maxTokens: 100000 });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).max_tokens).toBe(4000);
  });
});
