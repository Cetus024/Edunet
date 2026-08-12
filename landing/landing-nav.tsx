'use client';

import type { MouseEvent } from 'react';
import { Brain } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';

import { Button } from '@/components/ui/button';
import { NavLink } from '@/lib/navigation';

const navigationItems = [
  { href: '#why', label: 'Why it matters' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#impact', label: 'Impact' },
] as const;

const docLinks = [
  { href: '/user-manual', label: 'User Manual' },
  { href: '/tech-stack', label: 'Tech Stack' },
] as const;

type LandingNavProps = {
  onLogin: () => void;
  onGetStarted: () => void;
};

export function LandingNav({ onLogin, onGetStarted }: LandingNavProps) {
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 28,
    mass: 0.3,
  });

  const scrollToSection = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (shouldReduceMotion) return;
    const target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <motion.div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 h-1 origin-left bg-gradient-to-r from-[var(--edunets-yellow)] via-[var(--edunets-coral)] to-[var(--edunets-light-blue)]"
        style={{ scaleX: shouldReduceMotion ? 1 : smoothProgress }}
      />

      <nav
        aria-label="Landing page navigation"
        className="mx-auto flex h-14 max-w-6xl items-center gap-3 rounded-2xl border border-white/60 bg-[rgba(255,248,222,0.82)] px-3 shadow-[0_10px_35px_rgba(29,58,98,0.10)] backdrop-blur-xl sm:h-16 sm:px-4"
      >
        <a
          href="#top"
          onClick={(event) => scrollToSection(event, '#top')}
          aria-label="EduNets home"
          className="flex shrink-0 items-center gap-2 rounded-xl text-[var(--edunets-dark-blue)] outline-none transition-colors hover:text-[var(--edunets-light-blue)] focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] focus-visible:ring-offset-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--edunets-dark-blue)] text-[var(--edunets-yellow)] shadow-sm sm:h-10 sm:w-10">
            <Brain className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="hidden text-lg font-black tracking-tight min-[390px]:inline sm:text-xl">EduNets</span>
        </a>

        <div className="mx-auto hidden items-center gap-1 lg:flex">
          {navigationItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(event) => scrollToSection(event, item.href)}
              className="rounded-full px-3 py-2 text-sm font-bold text-[var(--edunets-ink)]/70 outline-none transition-colors hover:bg-white/75 hover:text-[var(--edunets-dark-blue)] focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] focus-visible:ring-offset-1"
            >
              {item.label}
            </a>
          ))}
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--edunets-ink)]/15" />
          {docLinks.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className="rounded-full px-3 py-2 text-sm font-bold text-[var(--edunets-ink)]/70 outline-none transition-colors hover:bg-white/75 hover:text-[var(--edunets-dark-blue)] focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)] focus-visible:ring-offset-1"
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onLogin}
            className="rounded-full px-2.5 font-bold text-[var(--edunets-dark-blue)] hover:bg-white/80 hover:text-[var(--edunets-dark-blue)] focus-visible:ring-[var(--edunets-light-blue)] sm:px-4"
          >
            Log In
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onGetStarted}
            aria-label="Get Started"
            className="rounded-full bg-[var(--edunets-dark-blue)] px-3 font-bold text-white shadow-sm hover:bg-[var(--edunets-light-blue)] focus-visible:ring-[var(--edunets-light-blue)] sm:px-5"
          >
            <span className="sm:hidden">Start</span>
            <span className="hidden sm:inline">Get Started</span>
          </Button>
        </div>
      </nav>
    </header>
  );
}
