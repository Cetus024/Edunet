/**
 * Character-budget chunking for staff textbook ingest. 1 token is treated as
 * ~4 characters, so 2800 characters is roughly a 700-token passage with a
 * short overlap so a split sentence still appears in the next chunk.
 */
export const TARGET_CHUNK_CHARS = 2800;
export const CHUNK_OVERLAP_CHARS = 400;

export function chunkText(
  text: string,
  size = TARGET_CHUNK_CHARS,
  overlap = CHUNK_OVERLAP_CHARS,
): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= size) return [normalized];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + size, normalized.length);
    if (end < normalized.length) {
      const breakAt = normalized.lastIndexOf(' ', end);
      if (breakAt > start + Math.floor(size / 2)) end = breakAt;
    }
    const piece = normalized.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denominator === 0 ? 0 : dot / denominator;
}

export function rankByCosine<T extends { embedding: number[] }>(
  query: number[],
  items: readonly T[],
  limit: number,
): T[] {
  return items
    .map((item) => ({ item, score: cosineSimilarity(query, item.embedding) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.item);
}

export const CITATION_EXCERPT_CHARS = 280;

export function excerptForCitation(content: string): string {
  const compact = content.replace(/\s+/g, ' ').trim();
  if (compact.length <= CITATION_EXCERPT_CHARS) return compact;
  const sliced = compact.slice(0, CITATION_EXCERPT_CHARS);
  const breakAt = sliced.lastIndexOf(' ');
  return `${(breakAt > 80 ? sliced.slice(0, breakAt) : sliced).trim()}…`;
}
