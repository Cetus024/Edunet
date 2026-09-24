'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useAtomValue } from 'jotai';
import { Bell } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentAccount } from '@/lib/api/me';
import { useNotifications } from '@/lib/api/notifications';
import { NavLink, useLocation } from '@/lib/navigation';
import { isTeachingRole } from '@/lib/roles';
import { countLearnerStreakDays, subjectsAtom } from '@/lib/study-data';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type TitleRule = { prefix: string; labelKey: TranslationKey };

const TITLE_RULES: TitleRule[] = [
  { prefix: '/dashboard', labelKey: 'nav.dashboard' },
  { prefix: '/quiz', labelKey: 'nav.smartQuiz' },
  { prefix: '/concept-web', labelKey: 'nav.conceptWeb' },
  { prefix: '/ask-teacher', labelKey: 'nav.askTeacher' },
  { prefix: '/notifications', labelKey: 'nav.notifications' },
  { prefix: '/capture-hub', labelKey: 'nav.captureHub' },
  { prefix: '/study-squad', labelKey: 'nav.studySquad' },
  { prefix: '/profile', labelKey: 'nav.myProfile' },
];

function titleKeyForPath(pathname: string, teaching: boolean): TranslationKey {
  if (teaching && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    return 'nav.teacherHome';
  }
  if (teaching && pathname.startsWith('/ask-teacher')) {
    return 'nav.messages';
  }
  const match = TITLE_RULES.find((rule) =>
    rule.prefix === '/dashboard'
      ? pathname === '/dashboard' || pathname.startsWith('/dashboard/')
      : pathname.startsWith(rule.prefix),
  );
  return match?.labelKey ?? 'nav.dashboard';
}

function initialsFromName(name: string | undefined): string {
  return name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'EN';
}

export function AppTopBar() {
  const { t, locale } = useTranslation();
  const location = useLocation();
  const { data: account } = useCurrentAccount();
  const user = account?.user ?? null;
  const role = account?.profile?.role ?? null;
  const teaching = isTeachingRole(role);
  const subjects = useAtomValue(subjectsAtom);
  const { data: notificationData } = useNotifications(
    user?.id ?? null,
    Boolean(account?.onboardingCompleted) && !teaching,
  );
  const unreadNotifications = notificationData?.unreadCount ?? 0;

  const streakDays = useMemo(
    () => (teaching ? 0 : countLearnerStreakDays(subjects)),
    [subjects, teaching],
  );

  const title = t(titleKeyForPath(location.pathname, teaching));
  const dateLabel = format(new Date(), locale === 'zh' ? 'yyyy年M月d日' : 'd MMM yyyy', {
    locale: locale === 'zh' ? zhCN : undefined,
  });
  const initials = initialsFromName(user?.name);
  const isProfileActive = location.pathname.startsWith('/profile');
  const isNotificationsActive = location.pathname.startsWith('/notifications');

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 lg:px-10 lg:py-4">
        <h1 className="min-w-0 truncate text-xl font-black tracking-tight text-primary lg:text-2xl">
          {title}
        </h1>

        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3.5">
          {!teaching && (
            <>
              <div
                className="inline-flex items-center gap-1.5 rounded-full bg-[#F6E9B8] px-2.5 py-1.5 text-xs font-bold text-[var(--edunets-dark-blue)] sm:hidden"
                title={t('topbar.streak', { days: streakDays })}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    streakDays > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                  )}
                  aria-hidden="true"
                />
                <span>{streakDays}d</span>
                <span aria-hidden="true">🔥</span>
              </div>
              <div
                className="hidden items-center gap-2 rounded-full bg-[#F6E9B8] px-3 py-1.5 text-sm font-bold text-[var(--edunets-dark-blue)] sm:inline-flex"
                title={t('topbar.streak', { days: streakDays })}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    streakDays > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                  )}
                  aria-hidden="true"
                />
                <span>{t('topbar.streak', { days: streakDays })}</span>
                <span aria-hidden="true">🔥</span>
              </div>
            </>
          )}

          <time
            dateTime={new Date().toISOString()}
            className="hidden text-sm font-semibold text-muted-foreground md:block"
          >
            {dateLabel}
          </time>

          {!teaching && (
            <NavLink
              to="/notifications"
              aria-label={t('nav.notifications')}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-full text-primary transition-colors',
                'hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                isNotificationsActive && 'bg-secondary',
              )}
            >
              <Bell className="h-5 w-5" strokeWidth={2.25} />
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </NavLink>
          )}

          <NavLink
            to="/profile"
            aria-label={t('nav.myProfile')}
            className={cn(
              'rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              isProfileActive && 'ring-2 ring-primary ring-offset-2',
            )}
          >
            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
              <AvatarImage src={user?.image ?? undefined} alt="" />
              <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </NavLink>
        </div>
      </div>
    </header>
  );
}
