import { topicSubconcepts, type SubconceptSeed } from '@/features/concept-web/content';

/**
 * Scores what a student actually said about a topic against the three
 * subconcepts the syllabus already defines for it.
 *
 * **What this measures, and what it does not.** It detects whether a subconcept
 * was *talked about*, by looking for its distinctive vocabulary. It cannot tell
 * whether what was said was correct. A student who recites the right words
 * while misunderstanding them scores the same as one who explains it properly.
 *
 * That asymmetry decides how the review must be worded. "Nobody mentioned
 * Growth & Repair" is a reliable finding — the words are simply absent. "Ben
 * explained Chromosomes well" is not something this can support, so the review
 * says *covered*, never *correct*.
 *
 * Coverage is still the useful signal for a study group: the common failure in
 * a three-minute group explanation is a whole branch of the topic going
 * untouched, and that is exactly what this catches.
 *
 * No model is involved, which is deliberate. It is deterministic, unit
 * testable, needs no credentials, runs offline, and reuses the rubric the
 * concept web already ships for all 51 catalog topics.
 */

/**
 * Resolves a squad topic to the catalog id the rubric is keyed by.
 *
 * Study Squad carries two kinds of weak topic. The signed-in student's own come
 * from study state and already hold a catalog id; the demo roster's hold short
 * slugs like `genetics` that do not. Both, however, carry a subject and a topic
 * name, and `squad-data.ts` keeps those names deliberately in step with the
 * seeded catalog — so deriving the id from the pair covers both. All 50
 * distinct squad topics resolve this way.
 *
 * Returns null when nothing matches, so a caller can hide the entry point
 * instead of opening a room that would score against an empty rubric and
 * produce a blank review with no error.
 */
export function resolveRubricTopicId(subject: string, topicName: string): string | null {
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const candidate = `${slug(subject)}-${slug(topicName)}`;
  return topicSubconcepts[candidate] ? candidate : null;
}

export function getSubconcepts(topicId: string): readonly SubconceptSeed[] {
  return topicSubconcepts[topicId] ?? [];
}

export type CoverageVerdict = 'covered' | 'partial' | 'missed';

export type SubconceptCoverage = {
  id: string;
  name: string;
  verdict: CoverageVerdict;
  /** Rubric terms found in the transcript, for showing the student the evidence. */
  matchedTerms: string[];
  /** Terms that never appeared — this is the actionable half. */
  missingTerms: string[];
};

export type SpeakerTranscript = { speakerId: string; speakerName: string; text: string };

export type SpeakerReview = {
  speakerId: string;
  speakerName: string;
  spokenWords: number;
  coverage: SubconceptCoverage[];
  coveredCount: number;
};

export type DiscussionReview = {
  topicId: string;
  /** Coverage across everyone's speech combined — what the group got to as a whole. */
  group: SubconceptCoverage[];
  perSpeaker: SpeakerReview[];
  /** Subconcepts nobody touched. The most reliable output this produces. */
  untouched: string[];
};

// Words carrying no topic signal. Kept deliberately small: an over-long list
// starts removing real subject vocabulary ("cell" and "power" are stopwords in
// some general lists and are load-bearing terms here).
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'by', 'for',
  'with', 'from', 'into', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it',
  'its', 'this', 'that', 'these', 'those', 'as', 'so', 'than', 'then', 'there',
  'their', 'them', 'they', 'which', 'who', 'what', 'when', 'where', 'how', 'why',
  'can', 'could', 'will', 'would', 'each', 'every', 'has', 'have', 'had', 'not',
  'more', 'most', 'other', 'such', 'usually', 'used', 'use', 'uses', 'same',
]);

// Endings that look plural but are not, and are common in exactly this
// vocabulary: mitosis, meiosis, osmosis, photosynthesis, analysis, nucleus,
// menisc­us. Stripping their final s produced "mitosi", which then matched
// nothing and showed up as noise in the evidence a student reads.
const NOT_PLURAL_ENDINGS = ['sis', 'ses', 'us', 'is', 'ss', 'ics'];

function normalizeWord(word: string): string {
  const lower = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Crude singularisation so "chromosomes" matches "chromosome". Stemming
  // properly would need a library; this covers the plural-vs-singular case that
  // actually shows up in spoken science and leaves everything else alone.
  if (NOT_PLURAL_ENDINGS.some((ending) => lower.endsWith(ending))) return lower;
  if (lower.length > 4 && lower.endsWith('ies')) return `${lower.slice(0, -3)}y`;
  if (lower.length > 4 && lower.endsWith('es')) return lower.slice(0, -2);
  if (lower.length > 3 && lower.endsWith('s')) return lower.slice(0, -1);
  return lower;
}

function contentWords(text: string): string[] {
  return contentTerms(text).map((term) => term.normalized);
}

/**
 * Content words paired with the form they were written in.
 *
 * Matching runs on the normalized stem, but the evidence shown back to a
 * student has to read as English — "chromosomes", not "chromosom".
 */
function contentTerms(text: string): { normalized: string; display: string }[] {
  return text
    .split(/\s+/)
    .map((word) => ({ normalized: normalizeWord(word), display: word.replace(/[^A-Za-z0-9-]/g, '') }))
    .filter((term) => term.normalized.length > 2 && !STOPWORDS.has(term.normalized));
}

function uniqueByNormalized(terms: { normalized: string; display: string }[]) {
  const seen = new Map<string, string>();
  for (const term of terms) if (!seen.has(term.normalized)) seen.set(term.normalized, term.display);
  return [...seen].map(([normalized, display]) => ({ normalized, display }));
}

/**
 * The terms that stand for a subconcept.
 *
 * Words from the name are weighted as required — saying "mitochondria" is the
 * clearest evidence someone addressed Mitochondria. Words from the description
 * are supporting evidence, and only those unique to this subconcept within the
 * topic count, so a term shared by all three cannot make every one look covered.
 */
export function subconceptTerms(subconcepts: readonly SubconceptSeed[]) {
  const descriptionCounts = new Map<string, number>();
  for (const subconcept of subconcepts) {
    for (const word of new Set(contentWords(subconcept.description))) {
      descriptionCounts.set(word, (descriptionCounts.get(word) ?? 0) + 1);
    }
  }

  return subconcepts.map((subconcept) => {
    const required = uniqueByNormalized(contentTerms(subconcept.name));
    const requiredStems = new Set(required.map((term) => term.normalized));
    const supporting = uniqueByNormalized(contentTerms(subconcept.description))
      .filter((term) => !requiredStems.has(term.normalized)
        && descriptionCounts.get(term.normalized) === 1);
    return { subconcept, required, supporting };
  });
}

function verdictFor(requiredHits: number, requiredTotal: number, supportingHits: number): CoverageVerdict {
  if (requiredTotal > 0 && requiredHits === requiredTotal) return 'covered';
  if (requiredHits > 0 || supportingHits >= 2) return 'partial';
  return 'missed';
}

export function scoreTranscript(topicId: string, text: string): SubconceptCoverage[] {
  const subconcepts = topicSubconcepts[topicId];
  if (!subconcepts) return [];

  const spoken = new Set(contentWords(text));

  return subconceptTerms(subconcepts).map(({ subconcept, required, supporting }) => {
    const matchedRequired = required.filter((term) => spoken.has(term.normalized));
    const matchedSupporting = supporting.filter((term) => spoken.has(term.normalized));
    return {
      id: subconcept.id,
      name: subconcept.name,
      verdict: verdictFor(matchedRequired.length, required.length, matchedSupporting.length),
      matchedTerms: [...matchedRequired, ...matchedSupporting].map((term) => term.display),
      missingTerms: required.filter((term) => !spoken.has(term.normalized)).map((term) => term.display),
    };
  });
}

export function reviewDiscussion(
  topicId: string,
  transcripts: readonly SpeakerTranscript[],
): DiscussionReview {
  const group = scoreTranscript(topicId, transcripts.map((entry) => entry.text).join(' '));

  const perSpeaker = transcripts.map((entry) => {
    const coverage = scoreTranscript(topicId, entry.text);
    return {
      speakerId: entry.speakerId,
      speakerName: entry.speakerName,
      spokenWords: entry.text.trim() ? entry.text.trim().split(/\s+/).length : 0,
      coverage,
      coveredCount: coverage.filter((item) => item.verdict === 'covered').length,
    };
  });

  return {
    topicId,
    group,
    perSpeaker,
    untouched: group.filter((item) => item.verdict === 'missed').map((item) => item.name),
  };
}
