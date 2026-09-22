'use client';

import { Languages } from 'lucide-react';

import { LOCALES, LOCALE_LABELS, useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Segmented EN / 华文 control. Lives in the desktop sidebar footer, and is
 * repeated on the profile page because the sidebar is `hidden lg:flex` — a
 * phone never renders it, and the mobile bottom bar has no room for an eighth
 * item.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div className={cn('rounded-[1.15rem] border border-sidebar-border bg-card p-1.5', className)}>
      <div className="flex items-center gap-1.5 px-1.5 pb-1.5 pt-0.5">
        <Languages className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
          {t('sidebar.language.label')}
        </span>
      </div>
      <div className="flex gap-1" role="group" aria-label={t('sidebar.language.label')}>
        {LOCALES.map((option) => {
          const isActive = option === locale;
          return (
            <button
              key={option}
              type="button"
              lang={option === 'zh' ? 'zh-Hans' : 'en'}
              aria-pressed={isActive}
              title={t('sidebar.language.switchTo', { language: LOCALE_LABELS[option] })}
              onClick={() => setLocale(option)}
              className={cn(
                'flex-1 rounded-[0.9rem] px-2 py-1.5 text-xs font-black transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_8px_20px_rgba(29,58,98,0.18)]'
                  : 'text-foreground hover:bg-secondary hover:text-secondary-foreground',
              )}
            >
              {LOCALE_LABELS[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
