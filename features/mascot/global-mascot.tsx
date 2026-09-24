'use client';

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Minus, X } from 'lucide-react';
import { useAtom, useAtomValue } from 'jotai';

import { cn } from '@/lib/utils';

import { MascotVisual } from './mascot-visual';
import { SpideyChat } from './spidey-chat';
import {
  landingMascotSceneAtom,
  mascotFeedbackAtom,
  type MascotScene,
} from './state';

const COLLAPSED_KEY = 'edunets-mascot-collapsed';
const FIRST_WELCOME_KEY = 'edunets-spidey-first-welcome-done';
const SESSION_WELCOME_KEY = 'edunets-spidey-session-welcome-done';
const DRAG_THRESHOLD_PX = 5;
const VIEWPORT_GUTTER_PX = 12;
const MOBILE_APP_NAV_CLEARANCE_PX = 96;
const FEATURE_TIP_OPEN_DELAY_MS = 450;
const FEATURE_TIP_VISIBLE_MS = 5500;
const WELCOME_TIP_VISIBLE_MS = 12_000;
const MOTIVATION_INTERVAL_MS = 5 * 60 * 1000;
const MOTIVATION_VISIBLE_MS = 6500;

type PanelMode = 'closed' | 'tip' | 'chat';
type TipKind = 'feature' | 'welcome' | 'nudge';

const FIRST_VISIT_MESSAGE =
  "Hi, I'm Spidey! 🕷️ New here? Start at your Dashboard to check your reminders, then try a Smart Quiz. After that, explore the Concept Web or Revision Hub, and bring friends into Study Squad. Ask me anytime if you're lost!";

const WELCOME_BACK_MESSAGES = [
  'Welcome back to EduNets! Need any help navigating around?',
  'Good to see you again! Want a quick tip on where to go next?',
  'Welcome back! I can help you find your way around EduNets anytime.',
];

const MOTIVATION_TIPS = [
  'Small revision beats cramming — even 10 focused minutes builds your web.',
  'You showed up today. That already strengthens the threads!',
  'A short Smart Quiz now can stop a topic from fading later.',
  'Progress is a web, not a straight line. Keep spinning gently.',
  'Try one fading topic on Concept Web — tiny reviews add up.',
  'Breathe, pick one screen, and take the next small step. You have got this.',
  'Friends in Study Squad make revision lighter. Want to invite someone later?',
  'Your future self will thank you for one calm review session today.',
];

type Point = {
  x: number;
  y: number;
};

type DragSession = {
  pointerId: number;
  pointerStart: Point;
  positionStart: Point;
  latestPosition: Point;
  moved: boolean;
};

type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type ViewportEdges = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

let cachedSafeAreaInsets: SafeAreaInsets | null = null;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function pointsMatch(first: Point, second: Point) {
  return Math.abs(first.x - second.x) < 0.5 && Math.abs(first.y - second.y) < 0.5;
}

function readSafeAreaInsets(): SafeAreaInsets {
  if (cachedSafeAreaInsets) return cachedSafeAreaInsets;

  const fallback = { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof document === 'undefined' || !document.body) return fallback;

  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = [
    'position:fixed',
    'visibility:hidden',
    'pointer-events:none',
    'padding-top:env(safe-area-inset-top)',
    'padding-right:env(safe-area-inset-right)',
    'padding-bottom:env(safe-area-inset-bottom)',
    'padding-left:env(safe-area-inset-left)',
  ].join(';');
  document.body.appendChild(probe);

  const styles = window.getComputedStyle(probe);
  cachedSafeAreaInsets = {
    top: Number.parseFloat(styles.paddingTop) || 0,
    right: Number.parseFloat(styles.paddingRight) || 0,
    bottom: Number.parseFloat(styles.paddingBottom) || 0,
    left: Number.parseFloat(styles.paddingLeft) || 0,
  };
  probe.remove();

  return cachedSafeAreaInsets;
}

function getViewportEdges(appRoute: boolean): ViewportEdges {
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const safeArea = readSafeAreaInsets();
  const isMobileLayout = viewportWidth < 1024;
  const navigationClearance = appRoute && isMobileLayout ? MOBILE_APP_NAV_CLEARANCE_PX : 0;

  return {
    top: viewportTop + safeArea.top + VIEWPORT_GUTTER_PX,
    right: viewportLeft + viewportWidth - safeArea.right - VIEWPORT_GUTTER_PX,
    bottom:
      viewportTop +
      viewportHeight -
      safeArea.bottom -
      VIEWPORT_GUTTER_PX -
      navigationClearance,
    left: viewportLeft + safeArea.left + VIEWPORT_GUTTER_PX,
  };
}

function constrainPosition(candidate: Point, width: number, height: number, appRoute: boolean): Point {
  const edges = getViewportEdges(appRoute);
  const maximumX = Math.max(edges.left, edges.right - width);
  const maximumY = Math.max(edges.top, edges.bottom - height);

  return {
    x: clamp(candidate.x, edges.left, maximumX),
    y: clamp(candidate.y, edges.top, maximumY),
  };
}

type RouteMascotConfig = {
  scene: MascotScene;
  message: string;
  hidden?: boolean;
  compact?: boolean;
  appRoute?: boolean;
};

const landingMessages: Record<MascotScene, string> = {
  welcome: 'Hi! I am your EduNets study guide.',
  growth: 'Ready to turn small reviews into lasting progress?',
  study: 'Capture, connect, and practise — one focused step at a time.',
  question: 'Every strong memory starts with a good question.',
  success: 'You are building real O-Level momentum!',
  insight: 'See how every topic links into one connected learning web.',
};

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function configForPath(pathname: string): RouteMascotConfig {
  const isLogin = matchesRoute(pathname, '/login');
  const isSignup = matchesRoute(pathname, '/signup');
  const isPasswordRecovery = matchesRoute(pathname, '/forgot-password')
    || matchesRoute(pathname, '/reset-password');

  if (isLogin || isSignup || isPasswordRecovery) {
    return {
      scene: isSignup ? 'growth' : 'welcome',
      message: isSignup ? 'Let us start building your learning web.' : 'Welcome back to your learning web.',
      hidden: true,
    };
  }

  if (matchesRoute(pathname, '/onboarding')) {
    return {
      scene: 'growth',
      message: 'Let us build your first learning map together.',
      hidden: true,
    };
  }

  if (pathname === '/') {
    return { scene: 'welcome', message: landingMessages.welcome };
  }

  if (matchesRoute(pathname, '/concept-web')) {
    return {
      scene: 'insight',
      message: 'Concept Web maps how each idea links so you can revise the connections.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/quiz')) {
    return {
      scene: 'question',
      message: 'Smart Quiz adapts questions so you can practise one topic at a time.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/ask-teacher')) {
    return {
      scene: 'question',
      message: 'Ask Teacher sends a clear question so your teacher can explain the sticky point.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/notifications')) {
    return {
      scene: 'insight',
      message: 'Notifications keep you up to date on alerts and classroom updates.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/rescue-room') || matchesRoute(pathname, '/rescue-join')) {
    return {
      scene: 'question',
      message: 'Rescue Room is live practice — write, check OCR, then review feedback.',
      compact: true,
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/revision-room')) {
    return {
      scene: 'study',
      message: 'Revision Room is for step-by-step work — write clearly, then check the text.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/capture-hub')) {
    return {
      scene: 'study',
      message: 'Revision Hub checks your notes, builds flashcards, and opens Notes Library.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/study-squad')) {
    return {
      scene: 'study',
      message: 'Study Squad is group revision — learn faster when the team moves together.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/profile')) {
    return {
      scene: 'study',
      message: 'Profile shows your progress so you know where a small review will help most.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/dashboard')) {
    return {
      scene: 'study',
      message: 'Dashboard is your hub — start with the weakest topic for today.',
      appRoute: true,
    };
  }

  return {
    scene: 'welcome',
    message: 'That page is not in the learning web yet. Let us find another route.',
  };
}

function writeCollapsedPreference(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? 'true' : 'false');
  } catch {
    // Storage is optional in restricted WebViews.
  }
}

function readStorageFlag(key: string, storage: 'local' | 'session'): boolean {
  try {
    const store = storage === 'local' ? localStorage : sessionStorage;
    return store.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeStorageFlag(key: string, storage: 'local' | 'session') {
  try {
    const store = storage === 'local' ? localStorage : sessionStorage;
    store.setItem(key, 'true');
  } catch {
    // Storage is optional in restricted WebViews.
  }
}

function pickWelcomeBackMessage(): string {
  const index = Math.floor(Math.random() * WELCOME_BACK_MESSAGES.length);
  return WELCOME_BACK_MESSAGES[index] ?? WELCOME_BACK_MESSAGES[0]!;
}

function pickMotivationTip(exclude?: string | null): string {
  const options = exclude
    ? MOTIVATION_TIPS.filter((tip) => tip !== exclude)
    : MOTIVATION_TIPS;
  const pool = options.length > 0 ? options : MOTIVATION_TIPS;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? MOTIVATION_TIPS[0]!;
}

function resolveLandingTip(isAppRoute: boolean, featureMessage: string): {
  message: string;
  kind: TipKind;
  visibleMs: number;
} {
  if (!isAppRoute) {
    return { message: featureMessage, kind: 'feature', visibleMs: FEATURE_TIP_VISIBLE_MS };
  }

  if (!readStorageFlag(FIRST_WELCOME_KEY, 'local')) {
    writeStorageFlag(FIRST_WELCOME_KEY, 'local');
    writeStorageFlag(SESSION_WELCOME_KEY, 'session');
    return { message: FIRST_VISIT_MESSAGE, kind: 'welcome', visibleMs: WELCOME_TIP_VISIBLE_MS };
  }

  if (!readStorageFlag(SESSION_WELCOME_KEY, 'session')) {
    writeStorageFlag(SESSION_WELCOME_KEY, 'session');
    return {
      message: pickWelcomeBackMessage(),
      kind: 'welcome',
      visibleMs: FEATURE_TIP_VISIBLE_MS + 1500,
    };
  }

  return { message: featureMessage, kind: 'feature', visibleMs: FEATURE_TIP_VISIBLE_MS };
}

function GlobalMascotContent() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const landingScene = useAtomValue(landingMascotSceneAtom);
  const [feedback, setFeedback] = useAtom(mascotFeedbackAtom);
  const [panelMode, setPanelMode] = useState<PanelMode>('closed');
  const [tipKind, setTipKind] = useState<TipKind>('feature');
  const [tipOverride, setTipOverride] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [position, setPosition] = useState<Point | null>(null);
  const [bubbleOffset, setBubbleOffset] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const feedbackRef = useRef(feedback);
  const panelModeRef = useRef(panelMode);
  const tipOverrideRef = useRef<string | null>(null);
  const mascotButtonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLElement>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const routeConfig = useMemo(() => configForPath(pathname), [pathname]);
  const routeScene = pathname === '/' ? landingScene ?? routeConfig.scene : routeConfig.scene;
  const scene = feedback?.scene ?? routeScene;
  const tipMessage = tipOverride
    ?? feedback?.message
    ?? (pathname === '/' ? landingMessages[routeScene] : routeConfig.message);
  const bubbleOpen = panelMode !== 'closed';
  const showChat = panelMode === 'chat' && Boolean(routeConfig.appRoute);
  const showTip = bubbleOpen && !showChat;
  const tipLabel = tipKind === 'welcome' ? 'Spidey' : tipKind === 'nudge' ? 'Spidey nudge' : 'Spidey tip';

  const moveMascot = useCallback(
    (candidate: Point) => {
      const button = mascotButtonRef.current;
      if (!button) return candidate;

      const rect = button.getBoundingClientRect();
      const nextPosition = constrainPosition(candidate, rect.width, rect.height, Boolean(routeConfig.appRoute));
      setPosition(nextPosition);
      return nextPosition;
    },
    [routeConfig.appRoute],
  );

  const updateBubbleOffset = useCallback(() => {
    const button = mascotButtonRef.current;
    const bubble = bubbleRef.current;
    if (!button || !bubble) return;

    const buttonRect = button.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const edges = getViewportEdges(Boolean(routeConfig.appRoute));
    const gap = 8;
    const availableHeight = Math.max(160, edges.bottom - edges.top);
    const maxBubbleHeight = Math.min(availableHeight - 8, Math.floor(window.innerHeight * 0.78));
    if (bubble.style.maxHeight !== `${maxBubbleHeight}px`) {
      bubble.style.maxHeight = `${maxBubbleHeight}px`;
    }
    // Full chat scrolls inside; tip bubbles stay compact.
    const nextOverflow = showChat ? 'hidden' : 'visible';
    if (bubble.style.overflowY !== nextOverflow) {
      bubble.style.overflowY = nextOverflow;
    }

    const width = bubbleRect.width || bubble.offsetWidth;
    const height = Math.min(bubble.scrollHeight || bubbleRect.height, maxBubbleHeight);
    const centeredX = buttonRect.left + (buttonRect.width - width) / 2;
    const bubbleX = clamp(centeredX, edges.left, Math.max(edges.left, edges.right - width));
    const aboveY = buttonRect.top - height - gap;
    const belowY = buttonRect.bottom + gap;
    const hasRoomAbove = aboveY >= edges.top;
    const hasRoomBelow = belowY + height <= edges.bottom;
    let preferredY = hasRoomAbove || !hasRoomBelow ? aboveY : belowY;
    if (!hasRoomAbove && !hasRoomBelow) {
      preferredY = edges.top + Math.max(0, (availableHeight - height) / 2);
    }
    const bubbleY = clamp(preferredY, edges.top, Math.max(edges.top, edges.bottom - height));
    const nextOffset = { x: bubbleX - buttonRect.left, y: bubbleY - buttonRect.top };

    setBubbleOffset((current) => (current && pointsMatch(current, nextOffset) ? current : nextOffset));
  }, [routeConfig.appRoute, showChat]);

  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  useEffect(() => {
    panelModeRef.current = panelMode;
  }, [panelMode]);

  useEffect(() => {
    tipOverrideRef.current = tipOverride;
  }, [tipOverride]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === 'true');
    } catch {
      setCollapsed(false);
    }
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    setFeedback(null);
    setPanelMode('closed');
  }, [pathname, setFeedback]);

  // First visit / welcome-back / one-line feature tip when a screen opens.
  useEffect(() => {
    if (!preferencesReady || collapsed || routeConfig.hidden) return;

    const landing = resolveLandingTip(Boolean(routeConfig.appRoute), routeConfig.message);
    const openTimer = window.setTimeout(() => {
      if (panelModeRef.current === 'chat') return;
      setTipOverride(landing.message);
      setTipKind(landing.kind);
      setPanelMode('tip');
    }, FEATURE_TIP_OPEN_DELAY_MS);
    const closeTimer = window.setTimeout(() => {
      if (panelModeRef.current === 'tip' && !feedbackRef.current) {
        setPanelMode('closed');
      }
    }, FEATURE_TIP_OPEN_DELAY_MS + landing.visibleMs);
    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
    };
  }, [collapsed, pathname, preferencesReady, routeConfig.appRoute, routeConfig.hidden, routeConfig.message]);

  // Gentle study nudge every 5 minutes while the student is on an app screen.
  useEffect(() => {
    if (!preferencesReady || collapsed || !routeConfig.appRoute || routeConfig.hidden) return;

    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (panelModeRef.current === 'chat') return;
      const tip = pickMotivationTip(tipOverrideRef.current);
      setTipOverride(tip);
      setTipKind('nudge');
      setPanelMode('tip');
      window.setTimeout(() => {
        if (panelModeRef.current === 'tip' && !feedbackRef.current) {
          setPanelMode('closed');
        }
      }, MOTIVATION_VISIBLE_MS);
    }, MOTIVATION_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [collapsed, preferencesReady, routeConfig.appRoute, routeConfig.hidden]);

  useEffect(() => {
    if (!feedback) return;
    if (!collapsed) {
      setTipOverride(null);
      setTipKind('feature');
      setPanelMode('tip');
    }

    const timer = window.setTimeout(() => {
      setFeedback(null);
      if (panelModeRef.current === 'tip') setPanelMode('closed');
    }, feedback.durationMs);

    return () => window.clearTimeout(timer);
  }, [collapsed, feedback, setFeedback]);

  useEffect(() => {
    if (!bubbleOpen || collapsed) {
      setBubbleOffset(null);
      return;
    }

    const frame = window.requestAnimationFrame(updateBubbleOffset);
    const bubble = bubbleRef.current;
    let observer: ResizeObserver | undefined;
    if (bubble && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        window.requestAnimationFrame(updateBubbleOffset);
      });
      observer.observe(bubble);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [bubbleOpen, collapsed, tipMessage, panelMode, position, updateBubbleOffset]);

  useEffect(() => {
    const keepMascotInViewport = () => {
      cachedSafeAreaInsets = null;
      const button = mascotButtonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      setPosition((current) => {
        if (!current) return current;
        const next = constrainPosition(current, rect.width, rect.height, Boolean(routeConfig.appRoute));
        return pointsMatch(current, next) ? current : next;
      });

      if (bubbleOpen && !collapsed) {
        window.requestAnimationFrame(updateBubbleOffset);
      }
    };

    const frame = window.requestAnimationFrame(keepMascotInViewport);
    window.addEventListener('resize', keepMascotInViewport);
    window.visualViewport?.addEventListener('resize', keepMascotInViewport);
    window.visualViewport?.addEventListener('scroll', keepMascotInViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', keepMascotInViewport);
      window.visualViewport?.removeEventListener('resize', keepMascotInViewport);
      window.visualViewport?.removeEventListener('scroll', keepMascotInViewport);
    };
  }, [bubbleOpen, collapsed, routeConfig.appRoute, routeConfig.compact, updateBubbleOffset]);

  useEffect(() => {
    const button = mascotButtonRef.current;
    if (!button || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      const rect = button.getBoundingClientRect();
      setPosition((current) => {
        if (!current) return current;
        const next = constrainPosition(current, rect.width, rect.height, Boolean(routeConfig.appRoute));
        return pointsMatch(current, next) ? current : next;
      });

      if (bubbleOpen && !collapsed) {
        window.requestAnimationFrame(updateBubbleOffset);
      }
    });

    observer.observe(button);
    return () => observer.disconnect();
  }, [bubbleOpen, collapsed, routeConfig.appRoute, updateBubbleOffset]);

  useEffect(
    () => () => {
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
      }
    },
    [],
  );

  if (routeConfig.hidden) return null;

  const setCollapsedState = (nextCollapsed: boolean) => {
    setCollapsed(nextCollapsed);
    setPanelMode(nextCollapsed ? 'closed' : 'tip');
    writeCollapsedPreference(nextCollapsed);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const initialPosition = { x: rect.left, y: rect.top };
    dragSessionRef.current = {
      pointerId: event.pointerId,
      pointerStart: { x: event.clientX, y: event.clientY },
      positionStart: initialPosition,
      latestPosition: initialPosition,
      moved: false,
    };

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional in older embedded WebViews.
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - session.pointerStart.x;
    const deltaY = event.clientY - session.pointerStart.y;
    if (!session.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;

    event.preventDefault();
    session.moved = true;
    setDragging(true);
    session.latestPosition = moveMascot({
      x: session.positionStart.x + deltaX,
      y: session.positionStart.y + deltaY,
    });
  };

  const finishPointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    dragSessionRef.current = null;
    setDragging(false);

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture is optional in older embedded WebViews.
    }

    if (!session.moved) return;

    setPosition(session.latestPosition);
    suppressClickRef.current = true;
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current);
    }
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 300);
  };

  const handleMascotClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      return;
    }

    if (collapsed) {
      setCollapsedState(false);
      return;
    }

    // Tip is auto; click opens (or closes) the full chatbot on app pages.
    if (routeConfig.appRoute) {
      setPanelMode((mode) => (mode === 'chat' ? 'closed' : 'chat'));
      return;
    }
    setPanelMode((mode) => (mode === 'closed' ? 'tip' : 'closed'));
  };

  const handleMascotKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;

    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const step = event.shiftKey ? 32 : 12;
    const delta = {
      x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
      y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
    };
    moveMascot({ x: rect.left + delta.x, y: rect.top + delta.y });
  };

  return (
    <div
      style={position ? { left: position.x, top: position.y } : undefined}
      className={cn(
        'pointer-events-none fixed z-40',
        !position && 'right-3 sm:right-5',
        !position &&
          (routeConfig.appRoute
            ? 'bottom-[calc(env(safe-area-inset-bottom)+6rem)] lg:bottom-6'
            : 'bottom-[calc(env(safe-area-inset-bottom)+1rem)]'),
      )}
    >
      <AnimatePresence>
        {bubbleOpen && !collapsed && (
          <motion.aside
            ref={bubbleRef}
            aria-live={showChat ? 'off' : 'polite'}
            aria-atomic={showChat ? undefined : true}
            style={
              bubbleOffset
                ? { left: bubbleOffset.x, top: bubbleOffset.y }
                : { right: 0, bottom: 'calc(100% + 0.5rem)' }
            }
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 5, scale: 0.97 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
            onAnimationComplete={updateBubbleOffset}
            className={cn(
              'pointer-events-auto absolute z-10 flex flex-col overflow-hidden rounded-[1.35rem] border border-[#1D3A62]/12 bg-white text-card-foreground shadow-[0_20px_55px_rgba(29,58,98,0.22)]',
              showChat
                ? 'min-h-[18rem] w-[min(24rem,calc(100vw-2rem))] max-h-[min(78dvh,36rem)] p-3.5'
                : tipKind === 'welcome'
                  ? 'w-[min(22rem,calc(100vw-2rem))] p-3.5'
                  : 'w-[min(18rem,calc(100vw-2rem))] p-3',
            )}
          >
            {showChat ? (
              <SpideyChat
                onContentChange={updateBubbleOffset}
                onClose={() => setPanelMode('closed')}
              />
            ) : showTip ? (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6486B5]">
                    {tipLabel}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPanelMode('closed')}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#6486B5] transition-colors hover:bg-[#6486B5]/10 hover:text-[#1D3A62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6486B5]"
                    aria-label="Close tip"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm font-semibold leading-snug text-[#1D3A62]">{tipMessage}</p>
                {routeConfig.appRoute ? (
                  <button
                    type="button"
                    onClick={() => setPanelMode('chat')}
                    className="text-left text-xs font-semibold text-[#6486B5] underline-offset-2 hover:underline"
                  >
                    Ask Spidey
                  </button>
                ) : (
                  <div className="flex items-center gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setCollapsedState(true)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
                      aria-label="Minimize EduNets guide"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </motion.aside>
        )}
      </AnimatePresence>

      <span id="edunets-mascot-drag-help" className="sr-only">
        Drag with a mouse or touch, or use the arrow keys to move this guide. Hold Shift with an arrow key to move farther.
      </span>

      <motion.button
        ref={mascotButtonRef}
        type="button"
        onClick={handleMascotClick}
        onKeyDown={handleMascotKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        onLostPointerCapture={finishPointerDrag}
        whileTap={reduceMotion || dragging ? undefined : { scale: 0.94 }}
        title={routeConfig.appRoute
          ? 'Drag to move Spidey. Click to open or close the help chatbot.'
          : 'Drag to move the EduNets guide. Click to open or close its message.'}
        className={cn(
          'pointer-events-auto relative flex touch-none select-none items-center justify-center overflow-hidden rounded-full border border-white/70 bg-secondary/80 shadow-[0_12px_28px_rgba(29,58,98,0.2)] backdrop-blur-sm transition-[width,height,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
          // Match a typical floating chat avatar (~56px), not a large hero mascot.
          collapsed ? 'h-12 w-12 p-0.5' : 'h-14 w-14 p-0.5',
        )}
        aria-label={collapsed
          ? 'Expand EduNets guide'
          : panelMode === 'chat'
            ? 'Close Spidey chatbot'
            : routeConfig.appRoute
              ? 'Open Spidey help chatbot'
              : bubbleOpen
                ? 'Close EduNets guide tip'
                : 'Open EduNets guide tip'}
        aria-describedby="edunets-mascot-drag-help"
        aria-expanded={!collapsed && bubbleOpen}
      >
        <MascotVisual scene={scene} className="h-full w-full" priority />
      </motion.button>
    </div>
  );
}

type MascotErrorBoundaryState = { hasError: boolean };

class MascotErrorBoundary extends Component<{ children: ReactNode }, MascotErrorBoundaryState> {
  state: MascotErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MascotErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[mascot] hidden after render error', error, errorInfo);
    }
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export function GlobalMascot() {
  return (
    <MascotErrorBoundary>
      <GlobalMascotContent />
    </MascotErrorBoundary>
  );
}
