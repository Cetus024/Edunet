'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

import { Switch } from '@/components/ui/switch';

/**
 * Fixed, always-on-top light/dark switch in the top-right corner, present on
 * every page (public site, auth, and the authenticated app shell alike)
 * since it renders once from app/providers.tsx rather than per-page.
 * Persisted via next-themes (localStorage + `.dark` on <html>); the CSS
 * variables it flips live in globals.css.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes can't know the persisted/system theme until after hydration,
  // so render nothing interactive until then to avoid a server/client mismatch.
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <div
      className="fixed right-3 top-3 z-[60] flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-2.5 py-1.5 shadow-lg backdrop-blur-xl sm:right-4 sm:top-4"
      suppressHydrationWarning
    >
      <Sun className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <Switch
        checked={isDark}
        disabled={!mounted}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle theme'}
      />
      <Moon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
