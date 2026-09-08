import type { AnalysisModel, TopicGrounding } from './explanation-analysis.js';
import { buildTopicGrounding } from './explanation-analysis.js';
import { evaluateNotes, type NoteEvaluation } from './note-evaluation.js';
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
 * then grade that exact summary against the application's stored topic data.
 */
export async function assessCapturedNotes(
  topicId: string,
  notes: string,
  model: AnalysisModel,
  loadGrounding: (topicId: string) => Promise<TopicGrounding | null> = buildTopicGrounding,
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

  let grounding: TopicGrounding | null;
  try {
    grounding = await loadGrounding(topicId);
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
      summaryPoints.join('\n'),
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

  return { summaryPoints, evaluation, failure: null };
}
