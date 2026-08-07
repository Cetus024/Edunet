import { Suspense, type ReactNode } from 'react';

import { AppShell } from '@/components/app-shell';
import { AppGate } from '@/features/auth/auth-gates';

function RouteLoadingState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8 text-muted-foreground">
      Loading EduNets…
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppGate>
      <AppShell>
        <Suspense fallback={<RouteLoadingState />}>{children}</Suspense>
      </AppShell>
    </AppGate>
  );
}
