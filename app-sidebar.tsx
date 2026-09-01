'use client';

import { NavLink, useLocation } from '@/lib/navigation';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { motion } from 'motion/react';
import Image from 'next/image';
import { LayoutDashboard, Brain, Share2, Inbox, User, Users, MessageCircle, LogOut, type LucideIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentAccount, type TeachingScope } from '@/lib/api/me';
import { useEnquiryUnreadCount } from '@/lib/api/enquiries';
import { useSafeSignOut } from '@/features/auth/use-safe-sign-out';

import { cn } from '@/lib/utils';
import { isTeachingRole, type EduNetsRole } from '@/lib/roles';
import { useTeachingContext } from '@/lib/teaching-context';
import { TeachingContextSelect } from '@/components/teaching-context-select';
import { LanguageToggle } from '@/components/language-toggle';
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
  { path: '/profile', labelKey: 'nav.myProfile', shortKey: 'nav.myProfile.short', icon: User },
];

const teachingNavItems: NavItem[] = [
  { path: '/dashboard', labelKey: 'nav.teacherHome', shortKey: 'nav.teacherHome.short', icon: LayoutDashboard },
  { path: '/quiz', labelKey: 'nav.smartQuiz', shortKey: 'nav.smartQuiz.short', icon: Brain },
  { path: '/concept-web', labelKey: 'nav.conceptWeb', shortKey: 'nav.conceptWeb.short', icon: Share2 },
  { path: '/ask-teacher', labelKey: 'nav.messages', shortKey: 'nav.messages.short', icon: MessageCircle },
  { path: '/profile', labelKey: 'nav.myProfile', shortKey: 'nav.myProfile.short', icon: User },
];

const roleLabelKeys: Record<'teacher' | 'student', TranslationKey> = {
  teacher: 'role.teacher',
  student: 'role.student',
};


export function AppSidebar() {
  const location = useLocation();
  const signOut = useSafeSignOut();
  const { t } = useTranslation();
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
      <aside className="hidden lg:flex flex-col w-64 text-sidebar-foreground h-screen fixed left-0 top-0 z-40 border-r border-sidebar-border shadow-[18px_0_50px_rgba(29,58,98,0.10)] overflow-hidden bg-sidebar">
        <div className="absolute -left-20 top-12 h-52 w-52 rounded-full bg-secondary blob-soft" />
        <div className="absolute -right-24 bottom-24 h-56 w-56 rounded-full bg-accent blob-soft" />
        <div className="relative z-10 h-full">
          <SidebarContent
            user={user}
            role={role}
            location={location}
            unreadMessages={unreadMessages}
            navItems={activeNavItems}
            teachingScopes={scopes}
            activeTeachingScopeId={activeScopeId}
            onTeachingScopeChange={setActiveScopeId}
            onLogout={() => signOut('/login')}
          />
        </div>
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
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 bg-sidebar text-sidebar-foreground z-50 rounded-[1.5rem] border border-sidebar-border shadow-[0_18px_45px_rgba(29,58,98,0.18)] safe-area-inset-bottom overflow-hidden">
        <div className="flex items-center justify-around h-16 px-2">
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
                  'relative flex flex-col items-center justify-center px-3 py-2 rounded-2xl transition-all',
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
  user,
  role,
  location,
  unreadMessages,
  navItems,
  teachingScopes,
  activeTeachingScopeId,
  onTeachingScopeChange,
  onLogout,
}: {
  user: { name: string; image: string | null } | null;
  role: EduNetsRole | null;
  location: { pathname: string };
  unreadMessages: number;
  navItems: NavItem[];
  teachingScopes: TeachingScope[];
  activeTeachingScopeId: string | null;
  onTeachingScopeChange: (scopeId: string) => void;
  onLogout: () => Promise<boolean>;
}) {
  const { t, locale } = useTranslation();
  const initials = user?.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'EN';

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Image
            src="/branding/edunets-logo.png"
            alt="EduNets"
            width={881}
            height={459}
            className="h-9 w-auto select-none"
          />
          <p className="mt-1.5 text-xs font-semibold text-muted-foreground">{t('sidebar.tagline')}</p>
        </motion.div>
      </div>

      {/* Account Info */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mx-4 rounded-[1.35rem] border border-sidebar-border bg-card text-card-foreground px-4 py-4 shadow-[0_14px_34px_rgba(29,58,98,0.12)]"
      >
        <div className="flex items-center gap-3">
          <Avatar className="w-11 h-11 border-2 border-white shadow-sm">
            <AvatarImage src={user?.image ?? undefined} />
            <AvatarFallback className={cn(
              'text-sm font-bold',
              isTeachingRole(role) ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'bg-primary text-primary-foreground',
            )}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-card-foreground truncate">
              {user?.name || t('role.member')}
            </p>
            <p className="text-xs font-semibold text-muted-foreground">
              {role ? t(roleLabelKeys[role]) : t('role.member')}
              {' · '}
              {format(new Date(), locale === 'zh' ? 'yyyy年M月d日' : 'dd MMM yyyy', {
                locale: locale === 'zh' ? zhCN : undefined,
              })}
            </p>
          </div>
        </div>
      </motion.div>

      {isTeachingRole(role) && teachingScopes.length > 0 && (
        <TeachingContextSelect
          scopes={teachingScopes}
          activeScopeId={activeTeachingScopeId}
          onChange={onTeachingScopeChange}
        />
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item: NavItem, index: number) => {
          const isActive = item.path === '/' 
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          
          return (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + index * 0.05 }}
            >
              <NavLink
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 rounded-full text-sm font-bold transition-all relative',
                  isActive 
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_14px_34px_rgba(29,58,98,0.20)]' 
                    : 'text-foreground hover:bg-secondary hover:text-secondary-foreground hover:translate-x-1'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{t(item.labelKey)}</span>
                {item.path === '/ask-teacher' && unreadMessages > 0 && (
                  <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-2 text-xs font-black text-destructive-foreground">{unreadMessages}</span>
                )}
              </NavLink>
            </motion.div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-3 border-t border-sidebar-border p-4">
        <LanguageToggle />
        <button
          type="button"
          onClick={() => void onLogout()}
          className="flex w-full items-center justify-center gap-2 rounded-[1.15rem] border border-sidebar-border bg-card px-3 py-2.5 text-xs font-black text-foreground transition-colors hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t('sidebar.logOut')}
        </button>
        <div className="rounded-[1.15rem] bg-secondary text-secondary-foreground p-3 text-center shadow-[0_14px_30px_rgba(29,58,98,0.10)]">
          <p className="text-xs font-bold leading-relaxed">
            {isTeachingRole(role) ? t('sidebar.footer.teacher') : t('sidebar.footer.learner')}
          </p>
        </div>
      </div>
    </div>
  );
}
