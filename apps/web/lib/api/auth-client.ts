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
  code?: string;
  message?: string;
  status?: number;
  statusText?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

export function getAuthErrorCode(error: unknown): string | undefined {
  const candidate = error as AuthErrorLike | null;
  return candidate?.code ?? candidate?.error?.code;
}

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
