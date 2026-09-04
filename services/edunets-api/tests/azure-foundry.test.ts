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
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AZURE_FOUNDRY_ENDPOINT;
    delete process.env.AZURE_FOUNDRY_API_KEY;
    delete process.env.AZURE_FOUNDRY_MODEL;
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
});
