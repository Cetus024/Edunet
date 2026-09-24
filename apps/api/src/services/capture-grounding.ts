import {
  buildTopicGrounding,
  buildTopicRubric,
  type TopicGrounding,
} from './explanation-analysis.js';
import type { NoteCitation } from './note-evaluation.js';
import {
  passagesToCitations,
  passagesToFacts,
  retrieveTopicPassages,
  type RetrievedPassage,
} from './reference-retrieval.js';

export type CaptureGroundingResult = {
  grounding: TopicGrounding | null;
  citations: NoteCitation[];
};

/**
 * Prefers retrieved textbook passages for Capture Hub grading. Falls back to
 * the existing quiz-explanation grounding so a topic with no ingested staff
 * notes still produces a score.
 */
export async function loadCaptureGrounding(
  topicId: string,
  summary: string,
  retrieve = retrieveTopicPassages,
  fallback = buildTopicGrounding,
): Promise<CaptureGroundingResult> {
  let passages: RetrievedPassage[] = [];
  try {
    passages = await retrieve(topicId, summary);
  } catch {
    passages = [];
  }
  if (passages.length > 0) {
    const subconcepts = buildTopicRubric(topicId) ?? [{
      id: topicId,
      name: topicId,
      description: 'Staff-provided textbook passages for this topic.',
    }];
    return {
      grounding: {
        topicId,
        subconcepts,
        facts: passagesToFacts(passages),
      },
      citations: passagesToCitations(passages),
    };
  }

  return {
    grounding: await fallback(topicId),
    citations: [],
  };
}
