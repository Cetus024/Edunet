'use client';

import type { ReactNode } from 'react';
import { useAtomValue } from 'jotai';

import { AppSidebar } from '@/components/app-sidebar';
import { AppTopBar } from '@/components/app-top-bar';
import { useCurrentAccount } from '@/lib/api/me';
import { isTeachingRole } from '@/lib/roles';
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DURATION_MS,
  SIDEBAR_EASE,
  SIDEBAR_EXPANDED_WIDTH,
  sidebarCollapsedAtom,
} from '@/lib/sidebar-state';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const { data: account } = useCurrentAccount();
  const usesTeachingWorkspace = isTeachingRole(account?.profile?.role);
  const collapsed = useAtomValue(sidebarCollapsedAtom);
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div
      // Teachers used to get a separate `.teacher-workspace` dark palette
      // applied to the whole shell here. It kept surfacing contrast bugs
      // wherever a page used theme-variable classes (bg-card, text-foreground,
      // etc) expecting the light "student" values — removed so teachers and
      // students always render from the same light color set.
      className="min-h-screen bg-background"
      data-workspace={usesTeachingWorkspace ? 'teaching' : 'learning'}
      style={{
        // Shared with the rail so main content swipes in lockstep.
        ['--shell-sidebar-width' as string]: `${sidebarWidth}px`,
      }}
    >
      <AppSidebar />
      <main
        className={cn(
          'min-h-screen pb-24 lg:pb-0 lg:ml-[var(--shell-sidebar-width)] lg:transition-[margin-left]',
          usesTeachingWorkspace && 'pb-40 lg:pb-0',
        )}
        style={{
          transitionDuration: `${SIDEBAR_DURATION_MS}ms`,
          transitionTimingFunction: SIDEBAR_EASE,
          willChange: 'margin-left',
        }}
      >
        <AppTopBar />
        {children}
      </main>
    </div>
  );
}
