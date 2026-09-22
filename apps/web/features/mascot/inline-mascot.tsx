'use client';

import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/utils';

import { MascotVisual } from './mascot-visual';
import type { MascotScene } from './state';

type InlineMascotProps = {
  scene: MascotScene;
  message: string;
  className?: string;
};

export function InlineMascot({ scene, message, className }: InlineMascotProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn('flex max-w-sm items-end gap-3', className)}>
      <MascotVisual scene={scene} className="h-20 w-20 sm:h-24 sm:w-24" priority />
      <motion.p
        initial={reduceMotion ? false : { opacity: 0, x: -8, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : 0.12 }}
        className="relative mb-3 rounded-[1.15rem] border border-border bg-card px-4 py-3 text-sm font-bold leading-relaxed text-card-foreground shadow-[0_14px_32px_rgba(29,58,98,0.14)] before:absolute before:-left-2 before:bottom-4 before:h-4 before:w-4 before:rotate-45 before:border-b before:border-l before:border-border before:bg-card"
      >
        {message}
      </motion.p>
    </div>
  );
}
