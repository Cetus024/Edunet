'use client';

import { NavLink, useLocation } from '@/lib/navigation';
import { useAtom } from 'jotai';
import Image from 'next/image';
import { LayoutDashboard, Brain, Share2, Inbox, Users, MessageCircle, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { useCurrentAccount, type TeachingScope } from '@/lib/api/me';
import { useEnquiryUnreadCount } from '@/lib/api/enquiries';

import { cn } from '@/lib/utils';
import { isTeachingRole, type EduNetsRole } from '@/lib/roles';
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_DURATION_MS,
  SIDEBAR_EASE,
  SIDEBAR_EXPANDED_WIDTH,
  sidebarCollapsedAtom,
} from '@/lib/sidebar-state';
import { useTeachingContext } from '@/lib/teaching-context';
import { TeachingContextSelect } from '@/components/teaching-context-select';
import { useTranslation, type TranslationKey } from '@/lib/i18n';


// `shortKey` feeds the mobile bottom bar. English used to derive it with
// `label.split(' ')[0]`, which produces nothing useful for Chinese — it has no
// word breaks, so the full label would render into a 10px slot.
type NavItem = { path: string; labelKey: TranslationKey; shortKey: TranslationKey; icon: LucideIcon };

const learnerNavItems: NavItem[] = [
  { path: '/dashboard', labelKey: 'nav.dashboard', shortKey: 'nav.dashboard.short', icon: LayoutDashboard },
  { path: '/quiz', labelKey: 'nav.smartQuiz', shortKey: 'nav.smartQuiz.short', icon: Brain },
  { path: '/concept-web', labelKey: 'nav.conceptWeb', shortKey: 'nav.conceptWeb.short', icon: Share2 },
  { path: '/ask-teacher', labelKey: 'nav.askTeacher', shortKey: 'nav.askTeacher.short', icon: MessageCircle },
  { path: '/capture-hub', labelKey: 'nav.captureHub', shortKey: 'nav.captureHub.short', icon: Inbox },
  { path: '/study-squad', labelKey: 'nav.studySquad', shortKey: 'nav.studySquad.short', icon: Users },
];

// Teachers get no Notifications or Revision Hub entry: unread notifications
// are folded into Teacher Home's priority list instead. Profile + notifications
// + streak live in AppTopBar.
const teachingNavItems: NavItem[] = [
  { path: '/dashboard', labelKey: 'nav.teacherHome', shortKey: 'nav.teacherHome.short', icon: LayoutDashboard },
  { path: '/quiz', labelKey: 'nav.smartQuiz', shortKey: 'nav.smartQuiz.short', icon: Brain },
  { path: '/concept-web', labelKey: 'nav.conceptWeb', shortKey: 'nav.conceptWeb.short', icon: Share2 },
  { path: '/ask-teacher', labelKey: 'nav.messages', shortKey: 'nav.messages.short', icon: MessageCircle },
];

const widthTransition = {
  transitionProperty: 'width',
  transitionDuration: `${SIDEBAR_DURATION_MS}ms`,
  transitionTimingFunction: SIDEBAR_EASE,
  willChange: 'width',
  // Do NOT use contain:paint — it clips the collapse control that sits
  // half outside the rail (`-right-3`).
} as const;


export function AppSidebar() {
  const location = useLocation();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useAtom(sidebarCollapsedAtom);
  // Layout flips with `collapsed` immediately — no delayed "icons in a wide
  // empty rail" frame on expand. Overflow on the rail clips labels while the
  // width swipe catches up, which reads as a reveal rather than a pause.
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
  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        style={{
          ...widthTransition,
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
        }}
        className="hidden lg:block fixed left-0 top-0 z-40 h-screen overflow-visible text-sidebar-foreground"
      >
        {/* Soft edge only — avoid animating a large box-shadow blur with width. */}
        <div className="relative h-full overflow-hidden border-r border-sidebar-border bg-sidebar">
          {/* Blurred blobs are expensive to composite. Never opacity-tween them
              during the width swipe — mount only when expanded. */}
          {!collapsed && (
            <>
              <div className="pointer-events-none absolute -left-20 top-12 h-52 w-52 rounded-full bg-secondary blob-soft" />
              <div className="pointer-events-none absolute -right-24 bottom-24 h-56 w-56 rounded-full bg-accent blob-soft" />
            </>
          )}
          <div
            className="relative z-10 h-full"
            style={{ width: collapsed ? '100%' : SIDEBAR_EXPANDED_WIDTH }}
          >
            <SidebarContent
              role={role}
              location={location}
              unreadMessages={unreadMessages}
              navItems={activeNavItems}
              teachingScopes={scopes}
              activeTeachingScopeId={activeScopeId}
              onTeachingScopeChange={setActiveScopeId}
              collapsed={collapsed}
            />
          </div>
        </div>
        {/* Anchored to the rail's right edge — same spot collapsed or expanded
            because the aside's right edge is always the spine of the button. */}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-24 z-50 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-sidebar-border bg-card text-foreground shadow-md hover:bg-secondary hover:text-secondary-foreground"
          style={{ left: '100%' }}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Mobile Bottom Navigation */}
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
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 bg-sidebar text-sidebar-foreground z-50 rounded-[1.5rem] border border-sidebar-border shadow-[0_18px_45px_rgba(29,58,98,0.18)] safe-area-inset-bottom overflow-x-auto">
        <div className="flex min-w-max items-center h-16 px-2">
          {activeNavItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'relative flex min-w-16 flex-col items-center justify-center px-2 py-2 rounded-2xl transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'text-foreground hover:bg-secondary hover:text-secondary-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] mt-1 font-medium">{t(item.shortKey)}</span>
                {item.path === '/ask-teacher' && unreadMessages > 0 && (
                  <span className="absolute -right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-black text-destructive-foreground">{unreadMessages}</span>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function SidebarContent({
  role,
  location,
  unreadMessages,
  navItems,
  teachingScopes,
  activeTeachingScopeId,
  onTeachingScopeChange,
  collapsed,
}: {
  role: EduNetsRole | null;
  location: { pathname: string };
  unreadMessages: number;
  navItems: NavItem[];
  teachingScopes: TeachingScope[];
  activeTeachingScopeId: string | null;
  onTeachingScopeChange: (scopeId: string) => void;
  collapsed: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-full flex-col">
      {/* Brand — keep both assets mounted; toggle with CSS so Next/Image
          doesn't re-decode on every collapse. Expanded keeps the original
          top breathing room (pt-5) so the logo isn't jammed under the edge. */}
      <div className={cn('relative shrink-0', collapsed ? 'flex h-[3.75rem] items-center justify-center px-2' : 'px-5 pt-5 pb-3')}>
        <div
          className={cn(
            'flex items-center justify-center',
            collapsed ? 'visible' : 'absolute opacity-0 pointer-events-none',
          )}
          aria-hidden={!collapsed}
        >
          <Image
            src="/branding/spidey-icon.png"
            alt="EduNets"
            width={380}
            height={380}
            className="h-6 w-6 select-none object-contain"
            priority
          />
        </div>
        <div
          className={cn(
            collapsed ? 'absolute opacity-0 pointer-events-none' : 'visible',
          )}
          aria-hidden={collapsed}
        >
          <Image
            src="/branding/edunets-logo.png"
            alt="EduNets"
            width={881}
            height={459}
            sizes="160px"
            className="select-none object-contain object-left"
            style={{ height: 32, width: 'auto', maxWidth: 160 }}
            priority
          />
          <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
            {t('sidebar.tagline')}
          </p>
        </div>
      </div>

      {!collapsed && isTeachingRole(role) && teachingScopes.length > 0 && (
        <div className="px-4 pt-3">
          <TeachingContextSelect
            scopes={teachingScopes}
            activeScopeId={activeTeachingScopeId}
            onChange={onTeachingScopeChange}
          />
        </div>
      )}

      <nav className={cn(
        'min-h-0 flex-1 space-y-1 overflow-y-auto',
        collapsed ? 'px-2 py-3' : 'p-4',
      )}>
        {navItems.map((item: NavItem) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          const badgeCount = item.path === '/ask-teacher' ? unreadMessages : 0;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? t(item.labelKey) : undefined}
              className={cn(
                'relative flex items-center text-sm font-bold',
                collapsed
                  ? 'mx-auto h-11 w-11 justify-center rounded-2xl'
                  : 'gap-3 rounded-full px-4 py-3.5',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-foreground hover:bg-secondary hover:text-secondary-foreground',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="min-w-0 truncate">{t(item.labelKey)}</span>
                  {badgeCount > 0 && (
                    <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-2 text-xs font-black text-destructive-foreground">
                      {badgeCount}
                    </span>
                  )}
                </>
              )}
              {collapsed && badgeCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
