'use client';

import { createAuthClient } from 'better-auth/react';

import { API_BASE_URL } from '@/lib/api/client';

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  fetchOptions: {
    credentials: 'include',
  },
});

type AuthErrorLike = {
  message?: string;
  status?: number;
  statusText?: string;
  error?: {
    message?: string;
  };
};

export function getAuthErrorMessage(error: unknown, fallback: string) {
  const candidate = error as AuthErrorLike | null;
  const message =
    candidate?.message?.trim() ||
    candidate?.error?.message?.trim() ||
    candidate?.statusText?.trim();

  if (
    candidate?.status === 0 ||
    message?.toLowerCase().includes('failed to fetch') ||
    message?.toLowerCase().includes('network')
  ) {
    return 'EduNets could not reach the account service. Check that the API is running and try again.';
  }

  return message || fallback;
}
