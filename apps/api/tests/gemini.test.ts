import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnalysisProviderError } from '../src/services/analysis-error.js';
import { getAnalysisModel, isAnalysisConfigured } from '../src/services/analysis-model.js';
import {
  createGeminiModel,
  extractGeminiVisibleText,
  generateGeminiContent,
  getGeminiChatModel,
  isGeminiConfigured,
} from '../src/services/gemini.js';

const CONFIG = { apiKey: 'gemini-test-key', model: 'gemini-3.5-flash' };

function geminiResponse(text: string, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{
        finishReason: 'STOP',
        content: { parts: [{ text }] },
        ...extra,
      }],
    }),
  };
}

describe('Gemini generateContent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_CHAT_MODEL;
    delete process.env.AZURE_FOUNDRY_ENDPOINT;
    delete process.env.AZURE_FOUNDRY_API_KEY;
    delete process.env.AZURE_FOUNDRY_MODEL;
  });

  it('posts to generateContent with the API key header and thinking level', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse('{"points":["alkenes"]}')) ;
    vi.stubGlobal('fetch', fetchMock);

    const reply = await createGeminiModel(CONFIG).complete('summarize', { maxTokens: 250 });
    expect(reply).toBe('{"points":["alkenes"]}');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent');
    expect(init.headers['x-goog-api-key']).toBe(CONFIG.apiKey);
    expect(JSON.parse(init.body)).toMatchObject({
      contents: [{ parts: [{ text: 'summarize' }] }],
      generationConfig: {
        thinkingConfig: { thinkingLevel: 'low' },
      },
    });
  });

  it('strips thought parts and keeps the visible answer', () => {
    expect(extractGeminiVisibleText({
      candidates: [{
        finishReason: 'STOP',
        content: {
          parts: [
            { thought: true, text: 'I should reason privately' },
            { text: '{"summary":"you covered alkenes"}' },
          ],
        },
      }],
    }).text).toBe('{"summary":"you covered alkenes"}');
  });

  it('treats MAX_TOKENS as incomplete output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{' }] } }],
      }),
    }));
    await expect(createGeminiModel(CONFIG).complete('test')).rejects.toMatchObject({
      reason: 'incomplete_output',
    });
  });

  it('retries HTTP 429 within the deadline then recovers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (name: string) => (name === 'retry-after-ms' ? '1' : null) },
        body: { cancel: async () => undefined },
      })
      .mockResolvedValueOnce(geminiResponse('recovered'));
    vi.stubGlobal('fetch', fetchMock);

    expect(await createGeminiModel(CONFIG).complete('test')).toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends inline image bytes for OCR-style generateContent calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse('Covalent bonds share electrons'));
    vi.stubGlobal('fetch', fetchMock);

    const text = await generateGeminiContent(
      [
        { text: 'Transcribe' },
        { inline_data: { mime_type: 'image/png', data: 'ZmFrZQ==' } },
      ],
      { thinkingLevel: 'minimal', maxOutputTokens: 4096 },
      CONFIG,
    );
    expect(text).toBe('Covalent bonds share electrons');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[1]).toEqual({
      inline_data: { mime_type: 'image/png', data: 'ZmFrZQ==' },
    });
  });

  it('routes generated notes through Gemini 3.1 Flash-Lite instead of 3.5 Flash', async () => {
    process.env.GEMINI_API_KEY = CONFIG.apiKey;
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse('alkenes decolourise bromine'));
    vi.stubGlobal('fetch', fetchMock);

    await getGeminiChatModel()?.complete('What is the bromine test?', { maxTokens: 700 });
    expect(String(fetchMock.mock.calls[0][0])).toContain('models/gemini-3.1-flash-lite:generateContent');
  });

  it('prefers Gemini over Foundry when GEMINI_API_KEY is set', async () => {
    process.env.GEMINI_API_KEY = CONFIG.apiKey;
    process.env.AZURE_FOUNDRY_ENDPOINT = 'https://edunet.openai.azure.com';
    process.env.AZURE_FOUNDRY_API_KEY = 'foundry-key';
    process.env.AZURE_FOUNDRY_MODEL = 'gpt-5-mini';

    const fetchMock = vi.fn().mockResolvedValue(geminiResponse('ok'));
    vi.stubGlobal('fetch', fetchMock);

    expect(isGeminiConfigured()).toBe(true);
    expect(isAnalysisConfigured()).toBe(true);
    await getAnalysisModel()?.complete('grade these notes', { maxTokens: 600 });
    expect(String(fetchMock.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
  });

  it('maps HTTP 500 to provider_error rather than leaking the body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      body: { cancel: async () => undefined },
    }));
    await expect(createGeminiModel(CONFIG).complete('test')).rejects.toBeInstanceOf(AnalysisProviderError);
    await expect(createGeminiModel(CONFIG).complete('test')).rejects.toMatchObject({ reason: 'provider_error' });
  });
});
