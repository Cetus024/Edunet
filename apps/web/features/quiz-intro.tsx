'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Brain } from 'lucide-react';

// A Persona-5-inspired hype beat before the actual topic/mode picker. Pure
// theatre — no controls live here — so it can only ever delay the real UI,
// never gate it. Tap/click (or ~2.4s) advances it either way.
export function QuizIntro({ onComplete }: { onComplete: () => void }) {
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDismissing(true), 2400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-label="Skip intro"
      className="absolute inset-0 z-20 cursor-pointer overflow-hidden rounded-[clamp(2rem,7vw,86px)] bg-[#17233A]"
      initial={{ opacity: 1, scale: 1 }}
      animate={dismissing ? { opacity: 0, scale: 1.06 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.7, 0, 0.84, 0] }}
      onAnimationComplete={() => { if (dismissing) onComplete(); }}
      onClick={() => setDismissing(true)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setDismissing(true); }}
    >
      {/* Three heavily-blurred blobs in the brand ramp (navy, light blue,
          gold) drifting and overlapping — the blur radius is wide enough
          that where they overlap reads as one continuous ink-diffusion
          wash, never a hard-edged shape. */}
      <motion.div
        className="absolute -left-16 -top-10 h-72 w-72 rounded-full bg-[#1D3A62] blur-[70px]"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={dismissing
          ? { opacity: 0, scale: 1.5, x: -60, y: 40 }
          : { opacity: 0.85, scale: 1, x: 0, y: 0 }}
        transition={{ duration: dismissing ? 0.5 : 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        className="absolute right-[-4rem] top-6 h-80 w-80 rounded-full bg-[#6486B5] blur-[80px]"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={dismissing
          ? { opacity: 0, scale: 1.5, x: 70, y: -30 }
          : { opacity: 0.6, scale: 1, x: 0, y: 0 }}
        transition={{ duration: dismissing ? 0.5 : 0.9, ease: [0.16, 1, 0.3, 1], delay: dismissing ? 0.02 : 0.1 }}
      />
      <motion.div
        className="absolute bottom-[-5rem] left-1/3 h-72 w-72 rounded-full bg-[#FFE38F] blur-[85px]"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={dismissing
          ? { opacity: 0, scale: 1.5, y: 60 }
          : { opacity: 0.5, scale: 1, y: 0 }}
        transition={{ duration: dismissing ? 0.5 : 0.9, ease: [0.16, 1, 0.3, 1], delay: dismissing ? 0.04 : 0.2 }}
      />

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <motion.span
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
          animate={dismissing
            ? { opacity: 0, scale: 0.4, rotate: 20 }
            : { opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: dismissing ? 0 : 0.1 }}
        >
          <Brain className="h-7 w-7 text-[#FFE38F]" aria-hidden="true" />
        </motion.span>
        <motion.h1
          className="font-display mt-4 text-5xl text-white sm:text-6xl"
          initial={{ opacity: 0, scale: 1.7, rotate: -10 }}
          animate={dismissing
            ? { opacity: 0, scale: 0.55, rotate: 8 }
            : { opacity: 1, scale: 1, rotate: -3 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: dismissing ? 0 : 0.18 }}
        >
          SMART QUIZ
        </motion.h1>
        <motion.p
          className="mt-4 max-w-sm text-sm font-bold leading-6 text-white/80"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: dismissing ? 0 : 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.35 }}
        >
          Do you think you&apos;ve got what it takes to complete this?
        </motion.p>
      </div>
    </motion.div>
  );
}
