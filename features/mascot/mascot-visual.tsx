'use client';

import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/utils';

import type { MascotScene } from './state';

const sceneAssets: Record<MascotScene, string> = {
  welcome: '/mascots/mascot1.webp',
  growth: '/mascots/mascot2.webp',
  study: '/mascots/mascot3.webp',
  question: '/mascots/mascot4.webp',
  success: '/mascots/mascot5.webp',
  insight: '/mascots/mascot6.webp',
};

const sceneLabels: Record<MascotScene, string> = {
  welcome: 'EduNets mascot waving hello',
  growth: 'EduNets mascot celebrating learning progress',
  study: 'EduNets mascot studying on a laptop',
  question: 'EduNets mascot thinking about a question',
  success: 'EduNets mascot holding a trophy',
  insight: 'EduNets mascot sharing a new idea',
};

type MascotVisualProps = {
  scene: MascotScene;
  className?: string;
  priority?: boolean;
};

function idleAnimation(scene: MascotScene) {
  if (scene === 'success') {
    return { y: [0, -12, 0], rotate: [0, -4, 4, 0], scale: [1, 1.06, 1] };
  }

  if (scene === 'question') {
    return { y: [0, -4, 0], rotate: [-2, 2, -2] };
  }

  if (scene === 'insight') {
    return { y: [0, -5, 0], scale: [1, 1.025, 1] };
  }

  return { y: [0, -5, 0], rotate: [0, 1.5, 0] };
}

export function MascotVisual({ scene, className, priority = false }: MascotVisualProps) {
  const reduceMotion = useReducedMotion();
  const isCelebration = scene === 'success';

  return (
    <motion.div
      className={cn('relative shrink-0', className)}
      animate={reduceMotion ? undefined : idleAnimation(scene)}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              duration: isCelebration ? 0.8 : scene === 'question' ? 2.8 : 3.2,
              repeat: isCelebration ? 0 : Infinity,
              ease: 'easeInOut',
            }
      }
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={scene}
          className="absolute inset-0"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.86, rotate: -3 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9, rotate: 3 }}
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: 'easeOut' }}
        >
          <Image
            src={sceneAssets[scene]}
            alt={sceneLabels[scene]}
            fill
            priority={priority}
            sizes="(max-width: 768px) 96px, 160px"
            className="select-none object-contain drop-shadow-[0_14px_16px_rgba(29,58,98,0.22)]"
            draggable={false}
          />
        </motion.div>
      </AnimatePresence>
      {scene === 'insight' && (
        <motion.span
          aria-hidden="true"
          className="absolute right-[5%] top-[5%] -z-10 h-1/2 w-1/2 rounded-full bg-secondary/70 blur-xl"
          animate={reduceMotion ? undefined : { opacity: [0.35, 0.8, 0.35], scale: [0.9, 1.12, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.div>
  );
}
