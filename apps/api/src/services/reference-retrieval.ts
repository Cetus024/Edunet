import { eq, sql } from 'drizzle-orm';

import { db } from '../../../../packages/database/index.js';
import {
  referenceChunks,
  referenceDocuments,
  referenceDocumentTopics,
} from '../../../../packages/database/schema/reference.js';
import { excerptForCitation } from '../lib/text-chunks.js';
import { getEmbeddingProvider, type EmbeddingProvider } from './embeddings.js';
import type { NoteCitation } from './note-evaluation.js';

export const REFERENCE_RETRIEVAL_LIMIT = 8;

export type RetrievedPassage = {
  title: string;
  page: number | null;
  content: string;
};

export function passagesToCitations(passages: readonly RetrievedPassage[]): NoteCitation[] {
  const seen = new Set<string>();
  const citations: NoteCitation[] = [];
  for (const passage of passages) {
    const excerpt = excerptForCitation(passage.content);
    const key = `${passage.title}:${passage.page ?? ''}:${excerpt}`;
    if (seen.has(key) || !excerpt) continue;
    seen.add(key);
    citations.push({
      title: passage.title,
      page: passage.page,
      excerpt,
    });
  }
  return citations;
}

export function passagesToFacts(passages: readonly RetrievedPassage[]): { concept: string; statement: string }[] {
  return passages.map((passage) => ({
    concept: passage.page ? `${passage.title} p.${passage.page}` : passage.title,
    statement: passage.content.replace(/\s+/g, ' ').trim().slice(0, 2000),
  })).filter((fact) => fact.statement);
}

export async function retrieveTopicPassages(
  topicId: string,
  query: string,
  embedder: EmbeddingProvider | null = getEmbeddingProvider(),
): Promise<RetrievedPassage[]> {
  const trimmed = query.trim();
  if (!trimmed || !embedder) return [];

  const [embedding] = await embedder.embed([trimmed], { taskType: 'RETRIEVAL_QUERY' });
  if (!embedding) return [];

  const distance = sql`${referenceChunks.embedding} OPERATOR(extensions.<=>) ${JSON.stringify(embedding)}::extensions.vector`;
  const rows = await db
    .select({
      title: referenceDocuments.title,
      page: referenceChunks.page,
      content: referenceChunks.content,
    })
    .from(referenceChunks)
    .innerJoin(referenceDocuments, eq(referenceChunks.documentId, referenceDocuments.id))
    .innerJoin(referenceDocumentTopics, eq(referenceDocumentTopics.documentId, referenceChunks.documentId))
    .where(eq(referenceDocumentTopics.topicId, topicId))
    .orderBy(distance)
    .limit(REFERENCE_RETRIEVAL_LIMIT);

  return rows.map((row) => ({
    title: row.title,
    page: row.page,
    content: row.content,
  }));
}
