'use client';

import { apiRequest } from '@/lib/api/client';

export type SpideyChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export type SpideyMaterialContext = {
  name: string;
  subject: string;
  topic: string;
};

export type SpideyChatFailure = {
  retryAfterSeconds?: number;
  reason: 'not_configured' | 'provider_error' | 'rate_limited' | 'timeout' | 'incomplete_output' | 'blocked';
};

export type SpideyChatResponse = {
  available: boolean;
  text: string | null;
  failure: SpideyChatFailure | null;
};

export function sendSpideyChat(input: {
  messages: SpideyChatMessage[];
  materials?: SpideyMaterialContext[];
}) {
  return apiRequest<SpideyChatResponse>('/api/v1/me/spidey/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
