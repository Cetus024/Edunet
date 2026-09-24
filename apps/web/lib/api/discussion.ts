'use client';

import { apiRequest } from '@/lib/api/client';

export type ExplanationAnalysis = {
  correct: { point: string; quote: string }[];
  incorrect: { point: string; quote: string; correction: string }[];
  missing: string[];
  summary: string;
};

export type AnalysisResponse = {
  /** False when the deployment has no model configured. Not an error. */
  available: boolean;
  /** Null when unavailable, unusable, or the transcript was too short to judge. */
  analysis: ExplanationAnalysis | null;
};

export function requestExplanationAnalysis(input: { topicId: string; transcript: string }) {
  return apiRequest<AnalysisResponse>('/api/v1/me/discussion-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
