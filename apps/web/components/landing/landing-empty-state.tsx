'use client';

import { Brain, ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { Button } from '@/components/ui/button';

type LandingEmptyStateProps = {
  onGetStarted: () => void;
  onLogin: () => void;
};

export function LandingEmptyState({ onGetStarted, onLogin }: LandingEmptyStateProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto flex max-w-md flex-col items-center justify-center p-8 text-center"
    >
      <motion.div
        initial={false}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="relative mb-6"
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-secondary blur-xl"
          animate={shouldReduceMotion ? undefined : { scale: [1, 1.14, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative flex h-28 w-28 items-center justify-center rounded-[1.75rem] bg-secondary text-secondary-foreground shadow-[0_16px_34px_rgba(29,58,98,0.16)]">
          <Brain className="h-14 w-14" />
        </div>
      </motion.div>

      <motion.h3
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-3 text-3xl font-black tracking-tight text-studynow-dark sm:text-4xl"
      >
        Build a stronger memory with EduNets
      </motion.h3>

      <motion.p
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-6 text-base font-medium leading-relaxed text-muted-foreground sm:text-lg"
      >
        Turn O-Level revision into connected knowledge, targeted quizzes, and study momentum that lasts.
      </motion.p>

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        <Button
          onClick={onGetStarted}
          className="h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:bg-accent"
        >
          Get Started
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onLogin}
          className="h-12 rounded-xl border-primary px-6 font-semibold text-primary transition-all hover:-translate-y-0.5 hover:bg-secondary"
        >
          Log In
        </Button>
      </motion.div>

      <motion.p
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-4 text-xs text-muted-foreground"
      >
        ✨ Your progress will be tracked automatically
      </motion.p>
    </motion.div>
  );
}
