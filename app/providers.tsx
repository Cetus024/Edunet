'use client';

import { useEffect, type ReactNode } from 'react';
import { Provider as JotaiProvider } from 'jotai';
import { QueryClientProvider } from '@tanstack/react-query';

import ErrorBoundary from '@/components/system/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { GlobalMascot } from '@/features/mascot';
import { queryClient } from '@/lib/query-client';
import { hasPowerAppsHost } from '../../app-gen-sdk/constants';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!hasPowerAppsHost()) return;

    void import('@microsoft/power-apps/app')
      .then(({ initialize }) => initialize())
      .catch((error: unknown) => {
        console.error('Failed to initialize the Power Apps host connection.', error);
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary resetQueryCache>
        <JotaiProvider>
          {children}
          <GlobalMascot />
          <Toaster richColors />
        </JotaiProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
