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
import {
  landingMascotSceneAtom,
  mascotFeedbackAtom,
  type MascotScene,
} from './state';

const COLLAPSED_KEY = 'edunets-mascot-collapsed';
const ROUTE_PROMPTS_KEY = 'edunets-mascot-route-prompts';
const DRAG_THRESHOLD_PX = 5;
const VIEWPORT_GUTTER_PX = 12;
const MOBILE_APP_NAV_CLEARANCE_PX = 96;

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

  if (isLogin || isSignup) {
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
      message: 'Follow the links to see how each idea supports the next.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/quiz')) {
    return {
      scene: 'question',
      message: 'Focus on one question at a time. You have got this.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/ask-teacher')) {
    return {
      scene: 'question',
      message: 'Capture the exact point you want your teacher to explain.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/rescue-room') || matchesRoute(pathname, '/rescue-join')) {
    return {
      scene: 'question',
      message: 'Lock in your answer before the timer runs out.',
      compact: true,
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/capture-hub')) {
    return {
      scene: 'study',
      message: 'Capture a lesson and turn it into a stronger revision trail.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/study-squad')) {
    return {
      scene: 'study',
      message: 'Learning sticks better when the whole squad moves together.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/profile')) {
    return {
      scene: 'study',
      message: 'Your progress shows where the next small review will help most.',
      appRoute: true,
    };
  }

  if (matchesRoute(pathname, '/dashboard')) {
    return {
      scene: 'study',
      message: 'Your weakest topic is the best place to start today.',
      appRoute: true,
    };
  }

  return {
    scene: 'welcome',
    message: 'That page is not in the learning web yet. Let us find another route.',
  };
}

function readPromptedRoutes(): string[] {
  try {
    const value = sessionStorage.getItem(ROUTE_PROMPTS_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeCollapsedPreference(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? 'true' : 'false');
  } catch {
    // Storage is optional in restricted WebViews.
  }
}

function GlobalMascotContent() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const landingScene = useAtomValue(landingMascotSceneAtom);
  const [feedback, setFeedback] = useAtom(mascotFeedbackAtom);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [position, setPosition] = useState<Point | null>(null);
  const [bubbleOffset, setBubbleOffset] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const feedbackRef = useRef(feedback);
  const mascotButtonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLElement>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const routeConfig = useMemo(() => configForPath(pathname), [pathname]);
  const routeScene = pathname === '/' ? landingScene ?? routeConfig.scene : routeConfig.scene;
  const scene = feedback?.scene ?? routeScene;
  const message = feedback?.message ?? (pathname === '/' ? landingMessages[routeScene] : routeConfig.message);

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
    const centeredX = buttonRect.left + (buttonRect.width - bubbleRect.width) / 2;
    const bubbleX = clamp(centeredX, edges.left, Math.max(edges.left, edges.right - bubbleRect.width));
    const aboveY = buttonRect.top - bubbleRect.height - gap;
    const belowY = buttonRect.bottom + gap;
    const hasRoomAbove = aboveY >= edges.top;
    const hasRoomBelow = belowY + bubbleRect.height <= edges.bottom;
    const preferredY = hasRoomAbove || !hasRoomBelow ? aboveY : belowY;
    const bubbleY = clamp(preferredY, edges.top, Math.max(edges.top, edges.bottom - bubbleRect.height));
    const nextOffset = { x: bubbleX - buttonRect.left, y: bubbleY - buttonRect.top };

    setBubbleOffset((current) => (current && pointsMatch(current, nextOffset) ? current : nextOffset));
  }, [routeConfig.appRoute]);

  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

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
    setBubbleOpen(false);
  }, [pathname, setFeedback]);

  useEffect(() => {
    if (!preferencesReady || collapsed || routeConfig.hidden || routeConfig.compact) return;

    const promptedRoutes = readPromptedRoutes();
    if (promptedRoutes.includes(pathname)) return;

    const openTimer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(ROUTE_PROMPTS_KEY, JSON.stringify([...promptedRoutes, pathname]));
      } catch {
        // The prompt can still appear when session storage is unavailable.
      }
      setBubbleOpen(true);
    }, 650);
    const closeTimer = window.setTimeout(() => {
      if (!feedbackRef.current) setBubbleOpen(false);
    }, 6650);
    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
    };
  }, [collapsed, pathname, preferencesReady, routeConfig.compact, routeConfig.hidden]);

  useEffect(() => {
    if (!feedback) return;
    if (!collapsed) setBubbleOpen(true);

    const timer = window.setTimeout(() => {
      setFeedback(null);
      setBubbleOpen(false);
    }, feedback.durationMs);

    return () => window.clearTimeout(timer);
  }, [collapsed, feedback, setFeedback]);

  useEffect(() => {
    if (!bubbleOpen || collapsed) {
      setBubbleOffset(null);
      return;
    }

    const frame = window.requestAnimationFrame(updateBubbleOffset);
    return () => window.cancelAnimationFrame(frame);
  }, [bubbleOpen, collapsed, message, position, updateBubbleOffset]);

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
    setBubbleOpen(!nextCollapsed);
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
    } else {
      setBubbleOpen((open) => !open);
    }
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
            aria-live="polite"
            aria-atomic="true"
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
            className="pointer-events-auto absolute z-10 w-[min(18rem,calc(100vw-2rem))] rounded-[1.25rem] border border-border bg-card p-4 text-card-foreground shadow-[0_20px_55px_rgba(29,58,98,0.2)]"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-primary">EduNets guide</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCollapsedState(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Minimize EduNets guide"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setBubbleOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Close mascot message"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-sm font-bold leading-relaxed">{message}</p>
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
        title="Drag to move the EduNets guide. Click to open or close its message."
        className={cn(
          'pointer-events-auto relative flex touch-none select-none items-center justify-center rounded-full border border-white/70 bg-secondary/80 shadow-[0_18px_45px_rgba(29,58,98,0.22)] backdrop-blur-sm transition-[width,height,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
          collapsed
            ? 'h-11 w-11 p-0.5'
            : routeConfig.compact
              ? 'h-14 w-14 p-0.5'
              : 'h-16 w-16 p-0.5 lg:h-24 lg:w-24',
        )}
        aria-label={collapsed ? 'Expand EduNets guide' : bubbleOpen ? 'Close EduNets guide message' : 'Open EduNets guide message'}
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
