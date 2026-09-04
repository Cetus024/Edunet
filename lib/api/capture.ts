'use client';

import { apiRequest } from '@/lib/api/client';

export type NoteEvaluation = {
  percentage: number;
  correct: { point: string; quote: string }[];
  incorrect: { point: string; quote: string; correction: string }[];
  missing: string[];
  summary: string;
};

export function ocrImage(input: { imageBase64: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }) {
  return apiRequest<{ available: boolean; text: string | null }>('/api/v1/me/capture/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function summarizeNotes(text: string) {
  return apiRequest<{ available: boolean; points: string[] | null }>('/api/v1/me/capture/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export function evaluateNotes(input: { topicId: string; text: string }) {
  return apiRequest<{ available: boolean; evaluation: NoteEvaluation | null }>('/api/v1/me/capture/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
