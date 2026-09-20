import { afterEach, describe, expect, it, vi } from 'vitest';

import { REFERENCE_EMBEDDING_DIMENSIONS } from '../../../database/schema/reference.js';
import {
  createAzureFoundryEmbeddings,
  createGeminiEmbeddings,
  getEmbeddingProvider,
  l2Normalize,
} from '../src/services/embeddings.js';

const CONFIG = {
  endpoint: 'https://edunet.openai.azure.com',
  apiKey: 'foundry-key',
  model: 'text-embedding-3-small',
};

function embeddingVector(fill: number): number[] {
  return Array.from({ length: REFERENCE_EMBEDDING_DIMENSIONS }, () => fill);
}

describe('Microsoft Foundry embeddings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the OpenAI v1 embeddings route and returns ordered vectors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [
        { index: 1, embedding: embeddingVector(0.2) },
        { index: 0, embedding: embeddingVector(0.1) },
      ],
    })));
    vi.stubGlobal('fetch', fetchMock);

    const vectors = await createAzureFoundryEmbeddings(CONFIG).embed(['alkenes', 'pythagoras']);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]?.[0]).toBe(0.1);
    expect(vectors[1]?.[0]).toBe(0.2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://edunet.openai.azure.com/openai/v1/embeddings');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: CONFIG.model,
      input: ['alkenes', 'pythagoras'],
    });
  });

  it('rejects a vector of the wrong length instead of storing a broken embedding', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ index: 0, embedding: [0.1, 0.2] }],
    }))));
    await expect(createAzureFoundryEmbeddings(CONFIG).embed(['alkenes']))
      .rejects.toMatchObject({ reason: 'provider_error' });
  });
});

describe('Gemini embeddings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_EMBEDDING_MODEL;
    delete process.env.AZURE_FOUNDRY_ENDPOINT;
    delete process.env.AZURE_FOUNDRY_API_KEY;
    delete process.env.AZURE_FOUNDRY_EMBEDDING_MODEL;
  });

  it('normalizes truncated 1536-d vectors', () => {
    const vector = l2Normalize([3, 4, ...Array.from({ length: REFERENCE_EMBEDDING_DIMENSIONS - 2 }, () => 0)]);
    expect(vector[0]).toBeCloseTo(0.6);
    expect(vector[1]).toBeCloseTo(0.8);
    expect(vector).toHaveLength(REFERENCE_EMBEDDING_DIMENSIONS);
  });

  it('posts batchEmbedContents at 1536 dimensions and L2-normalizes the result', async () => {
    const raw = embeddingVector(3);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      embeddings: [{ values: raw }],
    })));
    vi.stubGlobal('fetch', fetchMock);

    const [vector] = await createGeminiEmbeddings({
      apiKey: 'gemini-test-key',
      model: 'gemini-embedding-001',
    }).embed(['alkenes'], { taskType: 'RETRIEVAL_DOCUMENT' });

    expect(vector).toHaveLength(REFERENCE_EMBEDDING_DIMENSIONS);
    const expectedNorm = Math.sqrt(3 * 3 * REFERENCE_EMBEDDING_DIMENSIONS);
    expect(vector?.[0]).toBeCloseTo(3 / expectedNorm);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents',
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).requests[0]).toMatchObject({
      model: 'models/gemini-embedding-001',
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: REFERENCE_EMBEDDING_DIMENSIONS,
    });
  });

  it('prefers Gemini embeddings when GEMINI_API_KEY is set', async () => {
    process.env.GEMINI_API_KEY = 'gemini-test-key';
    process.env.AZURE_FOUNDRY_ENDPOINT = 'https://edunet.openai.azure.com';
    process.env.AZURE_FOUNDRY_API_KEY = 'foundry-key';
    process.env.AZURE_FOUNDRY_EMBEDDING_MODEL = 'text-embedding-3-small';

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      embeddings: [{ values: embeddingVector(0.1) }],
    })));
    vi.stubGlobal('fetch', fetchMock);
    await getEmbeddingProvider()?.embed(['alkenes']);
    expect(String(fetchMock.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
  });
});
