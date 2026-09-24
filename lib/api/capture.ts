'use client';

import { apiRequest } from '@/lib/api/client';

export type NoteCitation = {
  title: string;
  page: number | null;
  excerpt: string;
};

export type NoteEvaluation = {
  percentage: number;
  accurateCount?: number;
  objectiveCount?: number;
  formulaMarkdown?: string;
  correct: { point: string; quote: string }[];
  incorrect: { point: string; quote: string; correction: string }[];
  missing: string[];
  improvements?: string[];
  summary: string;
  citations?: NoteCitation[];
};

export type CaptureFailure = {
  retryAfterSeconds?: number;
  stage: 'ocr' | 'summary' | 'grounding' | 'evaluation' | 'generate';
  reason:
    | 'not_configured'
    | 'provider_error'
    | 'rate_limited'
    | 'timeout'
    | 'incomplete_output'
    | 'no_text'
    | 'no_summary'
    | 'topic_not_found'
    | 'invalid_evaluation'
    | 'no_textbook';
};

export function ocrImage(input: { imageBase64: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }) {
  return apiRequest<{ available: boolean; text: string | null; failure: CaptureFailure | null }>('/api/v1/me/capture/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function summarizeNotes(text: string) {
  return apiRequest<{ available: boolean; points: string[] | null; failure: CaptureFailure | null }>('/api/v1/me/capture/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export function evaluateNotes(input: { topicId: string; text: string }) {
  return apiRequest<{ available: boolean; summaryPoints: string[] | null; evaluation: NoteEvaluation | null; failure: CaptureFailure | null }>('/api/v1/me/capture/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function generateTopicNotes(input: { topicId: string }) {
  return apiRequest<{ available: boolean; text: string | null; failure: CaptureFailure | null }>('/api/v1/me/capture/generate-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export type Flashcard = {
  front: string;
  back: string;
};

export function generateFlashcards(input: {
  topicId: string;
  focus?: { name: string; description?: string };
}) {
  return apiRequest<{ available: boolean; cards: Flashcard[] | null; failure: CaptureFailure | null }>('/api/v1/me/capture/generate-flashcards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
