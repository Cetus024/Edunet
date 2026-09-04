import type { AnalysisModel, TopicGrounding } from './explanation-analysis.js';
import { buildTopicGrounding } from './explanation-analysis.js';
import { evaluateNotes, type NoteEvaluation } from './note-evaluation.js';
import { summarizeNotes } from './summarize-notes.js';

export type CaptureAssessment = {
  summaryPoints: string[];
  evaluation: NoteEvaluation | null;
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
): Promise<CaptureAssessment | null> {
  const summaryPoints = await summarizeNotes(notes, model);
  if (!summaryPoints || summaryPoints.length === 0) return null;

  const evaluation = await evaluateNotes(
    topicId,
    summaryPoints.join('\n'),
    model,
    loadGrounding,
  );
  return { summaryPoints, evaluation };
}
