'use client';

import { NavLink, useLocation } from '@/lib/navigation';
import { useAtom } from 'jotai';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LayoutDashboard, Brain, Share2, Inbox, Users, MessageCircle, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { useCurrentAccount, type TeachingScope } from '@/lib/api/me';
import { useEnquiryUnreadCount } from '@/lib/api/enquiries';

import { cn } from '@/lib/utils';
import { isTeachingRole, type EduNetsRole } from '@/lib/roles';
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DURATION_MS,
  SIDEBAR_EXPANDED_WIDTH,
  sidebarCollapsedAtom,
} from '@/lib/sidebar-state';
import { useTeachingContext } from '@/lib/teaching-context';
import { TeachingContextSelect } from '@/components/teaching-context-select';
import { useTranslation, type TranslationKey } from '@/lib/i18n';

// ─── Shared nav model (desktop rail + mobile dock use the same list) ─────────

type NavItem = { path: string; labelKey: TranslationKey; shortKey: TranslationKey; icon: LucideIcon };

const learnerNavItems: NavItem[] = [
  { path: '/dashboard', labelKey: 'nav.dashboard', shortKey: 'nav.dashboard.short', icon: LayoutDashboard },
  { path: '/quiz', labelKey: 'nav.smartQuiz', shortKey: 'nav.smartQuiz.short', icon: Brain },
  { path: '/concept-web', labelKey: 'nav.conceptWeb', shortKey: 'nav.conceptWeb.short', icon: Share2 },
  { path: '/ask-teacher', labelKey: 'nav.askTeacher', shortKey: 'nav.askTeacher.short', icon: MessageCircle },
  { path: '/capture-hub', labelKey: 'nav.captureHub', shortKey: 'nav.captureHub.short', icon: Inbox },
  { path: '/study-squad', labelKey: 'nav.studySquad', shortKey: 'nav.studySquad.short', icon: Users },
];

const teachingNavItems: NavItem[] = [
  { path: '/dashboard', labelKey: 'nav.teacherHome', shortKey: 'nav.teacherHome.short', icon: LayoutDashboard },
  { path: '/quiz', labelKey: 'nav.smartQuiz', shortKey: 'nav.smartQuiz.short', icon: Brain },
  { path: '/concept-web', labelKey: 'nav.conceptWeb', shortKey: 'nav.conceptWeb.short', icon: Share2 },
  { path: '/ask-teacher', labelKey: 'nav.messages', shortKey: 'nav.messages.short', icon: MessageCircle },
  { path: '/capture-hub', labelKey: 'nav.captureHub', shortKey: 'nav.captureHub.short', icon: Inbox },
];

/** One radius everywhere — rail, collapsed icon, mobile dock. */
const NAV_RADIUS = 'rounded-xl';
const NAV_ACTIVE_SURFACE = 'bg-sidebar-accent shadow-[0_6px_16px_rgba(29,58,98,0.16)]';
const NAV_HOVER_SURFACE = 'bg-sidebar-primary/10';
const NAV_FOCUS =
  'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar';

const SIDEBAR_MOTION_EASE = [0.2, 0.8, 0.2, 1] as const;
const SIDEBAR_MOTION_DURATION = SIDEBAR_DURATION_MS / 1000;
const ACTIVE_PILL_SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.85 };

function isNavActive(pathname: string, path: string) {
  return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

function badgeForPath(path: string, unreadMessages: number) {
  if (path === '/ask-teacher') return unreadMessages;
  return 0;
}

// ─── Shared nav item (desktop + mobile) ──────────────────────────────────────

function SidebarNavItem({
  item,
  active,
  badgeCount,
  layoutId,
  prefersReducedMotion,
  variant,
  collapsed,
  label,
}: {
  item: NavItem;
  active: boolean;
  badgeCount: number;
  layoutId: string;
  prefersReducedMotion: boolean;
  variant: 'rail' | 'dock';
  collapsed?: boolean;
  label: string;
}) {
  const Icon = item.icon;
  const isRail = variant === 'rail';
  const isIconOnly = isRail && collapsed;

  return (
    <NavLink
      to={item.path}
      title={isIconOnly ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex font-bold transition-colors duration-200',
        NAV_FOCUS,
        NAV_RADIUS,
        active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/80 hover:text-sidebar-foreground',
        isRail && isIconOnly && 'mx-auto h-11 w-11 items-center justify-center',
        isRail && !isIconOnly && 'w-full items-center gap-3 px-3.5 py-3 text-[15px]',
        variant === 'dock' && 'min-w-16 flex-col items-center justify-center gap-1 px-2.5 py-2 text-[10px] font-semibold',
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className={cn('absolute inset-0 z-0', NAV_RADIUS, NAV_ACTIVE_SURFACE)}
          transition={prefersReducedMotion ? { duration: 0 } : ACTIVE_PILL_SPRING}
        />
      )}

      {!active && (
        <span
          className={cn(
            'absolute inset-0 z-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100',
            NAV_RADIUS,
            NAV_HOVER_SURFACE,
          )}
          aria-hidden
        />
      )}

      <span className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center">
        <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
      </span>

      {isRail && !isIconOnly && (
        <span className="relative z-10 flex min-w-0 flex-1 items-center">
          <span className="min-w-0 truncate">{label}</span>
          {badgeCount > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-md bg-destructive px-1.5 text-[11px] font-black text-destructive-foreground">
              {badgeCount}
            </span>
          )}
        </span>
      )}

      {variant === 'dock' && (
        <>
          <span className="relative z-10 leading-none">{label}</span>
          {badgeCount > 0 && (
            <span className="absolute -right-0.5 top-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-md bg-destructive px-1 text-[9px] font-black text-destructive-foreground">
              {badgeCount}
            </span>
          )}
        </>
      )}

      {isIconOnly && badgeCount > 0 && (
        <span className="absolute right-1.5 top-1.5 z-10 h-2 w-2 rounded-full bg-destructive" />
      )}
    </NavLink>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export function AppSidebar() {
  const location = useLocation();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom);
  const prefersReducedMotion = useReducedMotion();
  const reduced = Boolean(prefersReducedMotion);
  const { data: account } = useCurrentAccount();
  const user = account?.user ?? null;
  const role = account?.profile?.role ?? null;
  const usesTeachingWorkspace = isTeachingRole(role);
  const { scopes, activeScopeId, setActiveScopeId } = useTeachingContext();
  const { unreadCount: unreadMessages } = useEnquiryUnreadCount({
    userId: user?.id ?? null,
    enabled: Boolean(account?.onboardingCompleted),
  });

  const activeNavItems = usesTeachingWorkspace ? teachingNavItems : learnerNavItems;
  const widthTransition = reduced
    ? { duration: 0 }
    : { duration: SIDEBAR_MOTION_DURATION, ease: SIDEBAR_MOTION_EASE };

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
        transition={widthTransition}
        className="fixed left-0 top-0 z-40 hidden h-screen overflow-visible text-sidebar-foreground lg:block"
      >
        <div className="relative h-full overflow-hidden border-r border-sidebar-border bg-sidebar">
          {/* Soft brand blobs — keep the cool gradient wash */}
          <div className="pointer-events-none absolute -left-20 top-12 h-52 w-52 rounded-full bg-secondary blob-soft" />
          <div className="pointer-events-none absolute -right-24 bottom-24 h-56 w-56 rounded-full bg-accent blob-soft" />
          <div
            className="relative z-10 h-full"
            style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
          >
            <SidebarRail
              role={role}
              pathname={location.pathname}
              unreadMessages={unreadMessages}
              navItems={activeNavItems}
              teachingScopes={scopes}
              activeTeachingScopeId={activeScopeId}
              onTeachingScopeChange={setActiveScopeId}
              collapsed={collapsed}
              prefersReducedMotion={reduced}
            />
          </div>
        </div>

        {/* Edge toggle — sits on the rail rim so it stays easy to reach when collapsed */}
        <motion.button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          whileHover={reduced ? undefined : { scale: 1.06 }}
          whileTap={reduced ? undefined : { scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 480, damping: 28 }}
          className={cn(
            'absolute top-5 z-50 flex h-8 w-8 -translate-x-1/2 items-center justify-center',
            'rounded-full border border-sidebar-border bg-card text-sidebar-foreground',
            'shadow-[0_4px_14px_rgba(29,58,98,0.16)] hover:bg-secondary',
            NAV_FOCUS,
          )}
          style={{ left: '100%' }}
        >
          <motion.span
            key={collapsed ? 'expand' : 'collapse'}
            initial={reduced ? false : { rotate: collapsed ? -90 : 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.2, ease: SIDEBAR_MOTION_EASE }}
            className="inline-flex"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </motion.span>
        </motion.button>
      </motion.aside>

      {usesTeachingWorkspace && scopes.length > 0 && (
        <div className="fixed bottom-20 left-3 right-3 z-50 rounded-2xl border border-sidebar-border bg-card p-2 shadow-xl lg:hidden">
          <TeachingContextSelect
            scopes={scopes}
            activeScopeId={activeScopeId}
            onChange={setActiveScopeId}
            compact
          />
        </div>
      )}

      {/* Mobile dock — same tokens / active surface as the desktop rail */}
      <nav
        aria-label="Primary"
        className="safe-area-inset-bottom fixed bottom-3 left-3 right-3 z-50 overflow-x-auto rounded-2xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[0_18px_45px_rgba(29,58,98,0.16)] lg:hidden"
      >
        <div className="flex h-16 min-w-max items-center gap-0.5 px-2">
          {activeNavItems.map((item) => (
            <SidebarNavItem
              key={item.path}
              item={item}
              active={isNavActive(location.pathname, item.path)}
              badgeCount={badgeForPath(item.path, unreadMessages)}
              layoutId="mobile-nav-active"
              prefersReducedMotion={reduced}
              variant="dock"
              label={t(item.shortKey)}
            />
          ))}
        </div>
      </nav>
    </>
  );
}

function SidebarRail({
  role,
  pathname,
  unreadMessages,
  navItems,
  teachingScopes,
  activeTeachingScopeId,
  onTeachingScopeChange,
  collapsed,
  prefersReducedMotion,
}: {
  role: EduNetsRole | null;
  pathname: string;
  unreadMessages: number;
  navItems: NavItem[];
  teachingScopes: TeachingScope[];
  activeTeachingScopeId: string | null;
  onTeachingScopeChange: (scopeId: string) => void;
  collapsed: boolean;
  prefersReducedMotion: boolean;
}) {
  const { t } = useTranslation();
  const labelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: SIDEBAR_MOTION_EASE };

  return (
    <div className="flex h-full w-full flex-col">
      <div
        className={cn(
          'relative shrink-0 border-b border-sidebar-border/70',
          collapsed ? 'flex h-[4.25rem] w-full items-center justify-center px-3' : 'px-5 pb-4 pt-5',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {collapsed ? (
            <motion.div
              key="spidey"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={labelTransition}
              className="flex h-12 w-12 shrink-0 items-center justify-center"
            >
              <Image
                src="/branding/spidey-icon.png"
                alt="EduNets"
                width={96}
                height={96}
                className="h-11 w-11 max-h-full max-w-full select-none object-contain"
                priority
              />
            </motion.div>
          ) : (
            <motion.div
              key="logo"
              initial={prefersReducedMotion ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={labelTransition}
            >
              <Image
                src="/branding/edunets-logo.png"
                alt="EduNets"
                width={881}
                height={459}
                sizes="200px"
                className="select-none object-contain object-left"
                style={{ height: 42, width: 'auto', maxWidth: 200 }}
                priority
              />
              <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
                {t('sidebar.tagline')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && isTeachingRole(role) && teachingScopes.length > 0 && (
          <motion.div
            key="teaching-scope"
            initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={labelTransition}
            className="overflow-hidden px-4 pt-3"
          >
            <TeachingContextSelect
              scopes={teachingScopes}
              activeScopeId={activeTeachingScopeId}
              onChange={onTeachingScopeChange}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        aria-label="Primary"
        className={cn(
          'min-h-0 flex-1 space-y-1.5 overflow-y-auto',
          collapsed ? 'px-2 py-3' : 'px-3.5 py-3',
        )}
      >
        {navItems.map((item) => (
          <SidebarNavItem
            key={item.path}
            item={item}
            active={isNavActive(pathname, item.path)}
            badgeCount={badgeForPath(item.path, unreadMessages)}
            layoutId="desktop-nav-active"
            prefersReducedMotion={prefersReducedMotion}
            variant="rail"
            collapsed={collapsed}
            label={t(item.labelKey)}
          />
        ))}
      </nav>
    </div>
  );
}
