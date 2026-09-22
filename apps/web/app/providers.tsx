'use client';

import { useEffect, type ReactNode } from 'react';
import { Provider as JotaiProvider } from 'jotai';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';

import ErrorBoundary from '@/components/system/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { GlobalMascot } from '@/features/mascot';
import { queryClient } from '@/lib/query-client';
import { hasPowerAppsHost } from '@/app-gen-sdk/constants';

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
    // Dark mode is intentionally disabled site-wide: it kept surfacing new
    // low-contrast text/background pairs (dark-on-dark) across pages that
    // were only ever designed against the light "student" palette. Rather
    // than keep chasing individual color variables, every page now always
    // renders in that one light theme - forcedTheme keeps next-themes'
    // consumers (e.g. the toast styling below) working without ever
    // applying the `.dark` class.
    <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary resetQueryCache>
          <JotaiProvider>
            {children}
            <GlobalMascot />
            <Toaster richColors />
          </JotaiProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
