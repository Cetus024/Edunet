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
      // Teachers used to get a separate `.teacher-workspace` dark palette
      // applied to the whole shell here. It kept surfacing contrast bugs
      // wherever a page used theme-variable classes (bg-card, text-foreground,
      // etc) expecting the light "student" values — removed so teachers and
      // students always render from the same light color set.
      className="min-h-screen bg-background"
      data-workspace={usesTeachingWorkspace ? 'teaching' : 'learning'}
    >
      <AppSidebar />
      <main className={cn('min-h-screen pb-24 lg:ml-64 lg:pb-0', usesTeachingWorkspace && 'pb-40 lg:pb-0')}>{children}</main>
    </div>
  );
}
