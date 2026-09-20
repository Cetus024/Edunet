import type { AnalysisModel, TopicGrounding } from './explanation-analysis.js';
import { loadCaptureGrounding } from './capture-grounding.js';
import { evaluateNotes, type NoteCitation, type NoteEvaluation } from './note-evaluation.js';
import { summarizeNotes } from './summarize-notes.js';
import { analysisFailure, type AnalysisFailureReason } from './analysis-error.js';

export type CaptureAssessment = {
  summaryPoints: string[];
  evaluation: NoteEvaluation | null;
  failure: CaptureAnalysisFailure | null;
};

export type CaptureAnalysisFailure = {
  stage: 'summary' | 'grounding' | 'evaluation';
  reason: AnalysisFailureReason | 'no_summary' | 'topic_not_found' | 'invalid_evaluation';
  retryAfterSeconds?: number;
};

/**
 * The Capture Hub 2.0 pipeline: compress the combined OCR and typed input,
 * then grade that exact summary against retrieved textbook passages, falling
 * back to stored syllabus facts when no staff notes have been ingested.
 */
export async function assessCapturedNotes(
  topicId: string,
  notes: string,
  model: AnalysisModel,
  loadGrounding?: (topicId: string) => Promise<TopicGrounding | null>,
): Promise<CaptureAssessment> {
  let summaryPoints: string[] | null;
  try {
    summaryPoints = await summarizeNotes(notes, model);
  } catch (error) {
    return {
      summaryPoints: [],
      evaluation: null,
      failure: { stage: 'summary', ...analysisFailure(error) },
    };
  }
  if (!summaryPoints || summaryPoints.length === 0) {
    return {
      summaryPoints: [],
      evaluation: null,
      failure: { stage: 'summary', reason: 'no_summary' },
    };
  }

  const summary = summaryPoints.join('\n');
  let grounding: TopicGrounding | null;
  let citations: NoteCitation[] = [];
  try {
    if (loadGrounding) {
      grounding = await loadGrounding(topicId);
    } else {
      const resolved = await loadCaptureGrounding(topicId, summary);
      grounding = resolved.grounding;
      citations = resolved.citations;
    }
  } catch (error) {
    return {
      summaryPoints,
      evaluation: null,
      failure: { stage: 'grounding', ...analysisFailure(error) },
    };
  }
  if (!grounding) {
    return {
      summaryPoints,
      evaluation: null,
      failure: { stage: 'grounding', reason: 'topic_not_found' },
    };
  }

  let evaluation: NoteEvaluation | null;
  try {
    evaluation = await evaluateNotes(
      topicId,
      summary,
      model,
      async () => grounding,
    );
  } catch (error) {
    return {
      summaryPoints,
      evaluation: null,
      failure: { stage: 'evaluation', ...analysisFailure(error) },
    };
  }

  if (!evaluation) {
    return {
      summaryPoints,
      evaluation: null,
      failure: { stage: 'evaluation', reason: 'invalid_evaluation' },
    };
  }

  return {
    summaryPoints,
    evaluation: { ...evaluation, citations },
    failure: null,
  };
}
