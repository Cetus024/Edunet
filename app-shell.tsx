'use client';

import type { ReactNode } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { useCurrentAccount } from '@/lib/api/me';
import { isTeachingRole } from '@/lib/roles';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const { data: account } = useCurrentAccount();
  const usesTeachingWorkspace = isTeachingRole(account?.profile?.role);

  return (
    <div
      className={cn(
        'min-h-screen bg-background',
        usesTeachingWorkspace && 'teacher-workspace',
      )}
      data-workspace={usesTeachingWorkspace ? 'teaching' : 'learning'}
    >
      <AppSidebar />
      <main className="min-h-screen pb-24 lg:ml-64 lg:pb-0">{children}</main>
    </div>
  );
}
