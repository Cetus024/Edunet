import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { eq } from 'drizzle-orm';
import { extractText, getDocumentProxy, renderPageAsImage } from 'unpdf';
import { z } from 'zod';

import { adminDb, adminPool } from './admin-client.js';
import { ACTIVE_SUBJECT_IDS } from './constants.js';
import {
  referenceChunks,
  referenceDocumentTopics,
  referenceDocuments,
} from './schema/reference.js';
import { CURRICULUM_TOPIC_BY_ID } from '../../apps/web/lib/curriculum.js';
import { chunkText } from '../services/edunets-api/src/lib/text-chunks.js';
import { AnalysisProviderError } from '../services/edunets-api/src/services/analysis-error.js';
import { getEmbeddingProvider } from '../services/edunets-api/src/services/embeddings.js';
import {
  generateGeminiContent,
  isGeminiConfigured,
} from '../services/edunets-api/src/services/gemini.js';

const TEXTBOOKS_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '../content/textbooks');
const MANIFEST_PATH = join(TEXTBOOKS_DIRECTORY, 'manifest.json');
const MIN_PAGE_CHARS = 40;
const OCR_PAGE_WIDTH = 1400;
const OCR_MAX_ATTEMPTS = 8;

const manifestEntrySchema = z.object({
  file: z.string().min(1),
  title: z.string().min(1),
  subjectId: z.enum(ACTIVE_SUBJECT_IDS),
  topicIds: z.array(z.string().min(1)).min(1),
});

const manifestSchema = z.array(manifestEntrySchema);

type PageText = { page: number | null; text: string };

function stableId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 32);
}

function usablePageCount(pages: readonly PageText[]): number {
  return pages.filter((page) => page.text.replace(/\s+/g, ' ').trim().length >= MIN_PAGE_CHARS).length;
}

function assignTopicId(content: string, topicIds: readonly string[]): string {
  const haystack = content.toLowerCase();
  let bestId = topicIds[0] ?? '';
  let bestScore = -1;
  for (const topicId of topicIds) {
    const topic = CURRICULUM_TOPIC_BY_ID.get(topicId);
    if (!topic) continue;
    const terms = [topic.name, ...topic.aliases, ...topic.subtopics.map((subtopic) => subtopic.name)];
    let score = 0;
    for (const term of terms) {
      const needle = term.toLowerCase().trim();
      if (needle.length < 4) continue;
      if (haystack.includes(needle)) score += needle.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = topicId;
    }
  }
  return bestId;
}

function cacheDirectory(sourceFile: string): string {
  return join(TEXTBOOKS_DIRECTORY, '.extract-cache', sourceFile.replace(/[^\w.-]+/g, '_'));
}

async function ocrPageWithRetries(image: Buffer, page: number, pageCount: number): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < OCR_MAX_ATTEMPTS; attempt += 1) {
    try {
      return (await generateGeminiContent(
        [
          {
            text: [
              `Transcribe all printed and handwritten text on this textbook page (${page} of ${pageCount}).`,
              'Preserve headings, equations, lists, and line breaks.',
              'Do not summarise, translate, or add commentary.',
              'If the page is blank, return an empty string.',
            ].join(' '),
          },
          { inline_data: { mime_type: 'image/png', data: image.toString('base64') } },
        ],
        { maxOutputTokens: 4096, timeoutMs: 60_000, thinkingLevel: 'minimal' },
      )).trim();
    } catch (error) {
      lastError = error;
      const retryAfter = error instanceof AnalysisProviderError && error.reason === 'rate_limited'
        ? Math.max(5, error.retryAfterSeconds ?? 20)
        : 5 * (attempt + 1);
      if (attempt === OCR_MAX_ATTEMPTS - 1) break;
      console.warn(`Gemini OCR page ${page} failed (attempt ${attempt + 1}); retrying in ${retryAfter}s.`);
      await delay(retryAfter * 1000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Gemini OCR failed on page ${page}`);
}

async function ocrPdfPages(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
  sourceFile: string,
  pageCount: number,
): Promise<PageText[]> {
  const directory = cacheDirectory(sourceFile);
  mkdirSync(directory, { recursive: true });
  const pages: PageText[] = [];

  for (let page = 1; page <= pageCount; page += 1) {
    const cachePath = join(directory, `page-${String(page).padStart(4, '0')}.txt`);
    if (existsSync(cachePath)) {
      pages.push({ page, text: readFileSync(cachePath, 'utf8') });
      continue;
    }

    const png = await renderPageAsImage(pdf, page, {
      canvasImport: () => import('@napi-rs/canvas'),
      width: OCR_PAGE_WIDTH,
    });
    const text = await ocrPageWithRetries(Buffer.from(png), page, pageCount);
    writeFileSync(cachePath, text);
    pages.push({ page, text });
    console.log(`OCR ${page}/${pageCount} (${text.replace(/\s+/g, ' ').trim().length} chars)`);
  }

  return pages;
}

async function extractPages(absolutePath: string, sourceFile: string): Promise<PageText[]> {
  const extension = absolutePath.toLowerCase();
  if (extension.endsWith('.txt') || extension.endsWith('.md')) {
    const text = readFileSync(absolutePath, 'utf8');
    return text.split('\f').map((section, index) => ({
      page: index + 1,
      text: section,
    }));
  }
  if (!extension.endsWith('.pdf')) {
    throw new Error(`Unsupported textbook file type: ${absolutePath}`);
  }

  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(absolutePath)));
  const extracted = await extractText(pdf, { mergePages: false });
  const nativePages = extracted.text.map((pageText, index) => ({
    page: index + 1,
    text: pageText,
  }));

  if (nativePages.length === 0) return [];
  if (usablePageCount(nativePages) >= Math.max(1, Math.ceil(nativePages.length * 0.3))) {
    return nativePages;
  }
  if (!isGeminiConfigured()) {
    console.warn(`Thin text layer in ${sourceFile} and GEMINI_API_KEY is unset; cannot OCR pages.`);
    return nativePages;
  }

  console.warn(`Thin text layer in ${sourceFile}; OCR-ing ${nativePages.length} pages with Gemini 3.5 Flash.`);
  return ocrPdfPages(pdf, sourceFile, nativePages.length);
}

async function ingestTextbooks(): Promise<void> {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing ${MANIFEST_PATH}. Copy the example manifest and add your files.`);
  }

  const embedder = getEmbeddingProvider();
  if (!embedder) {
    throw new Error('GEMINI_API_KEY (preferred) or AZURE_FOUNDRY_ENDPOINT, AZURE_FOUNDRY_API_KEY, and AZURE_FOUNDRY_EMBEDDING_MODEL are required.');
  }

  const manifest = manifestSchema.parse(JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')));
  let ingestedDocuments = 0;
  let ingestedChunks = 0;

  for (const entry of manifest) {
    for (const topicId of entry.topicIds) {
      const topic = CURRICULUM_TOPIC_BY_ID.get(topicId);
      if (!topic) throw new Error(`Unknown topicId "${topicId}" in ${entry.file}`);
      if (topic.subjectId !== entry.subjectId) {
        throw new Error(`topicId "${topicId}" does not belong to subject "${entry.subjectId}"`);
      }
    }

    const absolutePath = resolve(TEXTBOOKS_DIRECTORY, entry.file);
    if (!existsSync(absolutePath)) {
      console.warn(`Skipping missing file: ${entry.file}`);
      continue;
    }

    const pages = await extractPages(absolutePath, entry.file);
    const prepared: { topicId: string; page: number | null; chunkIndex: number; content: string }[] = [];
    let chunkIndex = 0;
    for (const page of pages) {
      const pageText = page.text.replace(/\s+/g, ' ').trim();
      if (pageText.length < MIN_PAGE_CHARS) {
        console.warn(`Skipping thin page ${page.page ?? '?'} in ${entry.file} (no usable text layer).`);
        continue;
      }
      for (const content of chunkText(pageText)) {
        prepared.push({
          topicId: assignTopicId(content, entry.topicIds),
          page: page.page,
          chunkIndex,
          content,
        });
        chunkIndex += 1;
      }
    }

    if (prepared.length === 0) {
      console.warn(`No ingestible text in ${entry.file}; export a searchable PDF or .txt notes.`);
      continue;
    }

    const embeddings = await embedder.embed(prepared.map((row) => row.content), {
      taskType: 'RETRIEVAL_DOCUMENT',
    });
    if (embeddings.length !== prepared.length) {
      throw new Error(`Embedding count mismatch for ${entry.file}`);
    }

    const documentId = stableId('document', entry.file);
    await adminDb.delete(referenceChunks).where(eq(referenceChunks.documentId, documentId));
    await adminDb.delete(referenceDocumentTopics).where(eq(referenceDocumentTopics.documentId, documentId));
    await adminDb.delete(referenceDocuments).where(eq(referenceDocuments.id, documentId));

    await adminDb.insert(referenceDocuments).values({
      id: documentId,
      title: entry.title,
      sourceFilename: entry.file,
      subjectId: entry.subjectId,
    });
    await adminDb.insert(referenceDocumentTopics).values(
      entry.topicIds.map((topicId) => ({ documentId, topicId })),
    );
    await adminDb.insert(referenceChunks).values(prepared.map((row, index) => ({
      id: stableId('chunk', documentId, String(row.chunkIndex)),
      documentId,
      topicId: row.topicId,
      page: row.page,
      chunkIndex: row.chunkIndex,
      content: row.content,
      embedding: embeddings[index] ?? [],
    })));

    ingestedDocuments += 1;
    ingestedChunks += prepared.length;
    console.log(`Ingested ${entry.file}: ${prepared.length} chunks across ${entry.topicIds.join(', ')}`);
  }

  console.log(`Γ£à Textbook ingest finished (${ingestedDocuments} documents, ${ingestedChunks} chunks).`);
}

ingestTextbooks()
  .then(() => adminPool.end())
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
    console.error('Γ¥î Textbook ingest failed:', cause ? `${message} (${cause})` : message);
    await adminPool.end();
    process.exitCode = 1;
  });
