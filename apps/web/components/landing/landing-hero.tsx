'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, BookOpenCheck, LogIn, Network } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';

type LandingHeroProps = {
  onGetStarted: () => void;
  onLogin: () => void;
};

const networkNodes = [
  { label: 'Biology', x: 88, y: 150, color: '#FFE38F' },
  { label: 'Cell Division', x: 286, y: 76, color: '#E8735F' },
  { label: 'Chemistry', x: 500, y: 148, color: '#6486B5' },
  { label: 'Physics', x: 858, y: 86, color: '#1D3A62' },
  { label: 'A-Math', x: 1098, y: 188, color: '#E8735F' },
  { label: 'Tourism', x: 1080, y: 506, color: '#6486B5' },
  { label: 'English', x: 814, y: 642, color: '#1D3A62' },
  { label: 'History', x: 406, y: 626, color: '#E8735F' },
  { label: 'Memory', x: 112, y: 480, color: '#6486B5' },
] as const;

const networkConnections = [
  [0, 1],
  [0, 8],
  [1, 2],
  [1, 8],
  [2, 3],
  [2, 7],
  [3, 4],
  [3, 6],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
] as const;

const productScope = [
  { icon: BookOpenCheck, number: '8', label: 'O-Level subjects' },
  { icon: Network, number: '51', label: 'mapped topics' },
] as const;

function useDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

export function LandingHero({ onGetStarted, onLogin }: LandingHeroProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const heroScale = useTransform(scrollYProgress, [0, 0.82], [1, 0.95]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.82], [1, 0.45]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -58]);
  const enableScrollEffects = useDesktopViewport() && !shouldReduceMotion;

  return (
    <section
      ref={sectionRef}
      id="top"
      aria-labelledby="landing-title"
      className="relative min-h-[100svh] scroll-mt-24 overflow-x-clip bg-[linear-gradient(118deg,#eaf2ff_0%,#f8f5e9_48%,#fff4cb_100%)] px-4 pb-14 pt-20 sm:px-6 lg:px-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(100,134,181,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(100,134,181,0.12)_1px,transparent_1px)] [background-size:72px_72px]"
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 top-20 h-96 w-96 rounded-full bg-[var(--edunets-light-blue)]/22 blur-3xl"
        animate={shouldReduceMotion ? undefined : { x: [0, 46, 0], y: [0, 28, 0], scale: [1, 1.14, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 bottom-4 h-[28rem] w-[28rem] rounded-full bg-[var(--edunets-yellow)]/45 blur-3xl"
        animate={shouldReduceMotion ? undefined : { x: [0, -40, 0], y: [0, -24, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg
        aria-hidden="true"
        viewBox="0 0 1200 720"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible opacity-45"
      >
        {networkConnections.map(([startIndex, endIndex], index) => {
          const start = networkNodes[startIndex];
          const end = networkNodes[endIndex];

          return (
            <motion.line
              key={`${start.label}-${end.label}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#6486B5"
              strokeWidth="1.7"
              strokeDasharray="6 9"
              initial={false}
              animate={
                shouldReduceMotion
                  ? { pathLength: 1, opacity: 0.28 }
                  : { pathLength: 1, opacity: [0.18, 0.48, 0.18], strokeDashoffset: [0, -30] }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      pathLength: { delay: 0.18 + index * 0.05, duration: 0.6 },
                      opacity: { duration: 3.6, repeat: Infinity, delay: index * 0.13 },
                      strokeDashoffset: { duration: 3.2, repeat: Infinity, ease: 'linear' },
                    }
              }
            />
          );
        })}

        {networkNodes.map((node, index) => (
          <g key={node.label}>
            <motion.circle
              cx={node.x}
              cy={node.y}
              fill={node.color}
              initial={false}
              animate={shouldReduceMotion ? { r: 7, opacity: 0.78 } : { r: [7, 10, 7], opacity: [0.64, 0.92, 0.64] }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 2.8, repeat: Infinity, delay: index * 0.24, ease: 'easeInOut' }}
            />
            <circle cx={node.x} cy={node.y} r="17" fill="none" stroke={node.color} strokeOpacity="0.2" />
            <text
              x={node.x}
              y={node.y + 29}
              textAnchor="middle"
              fill="#1D3A62"
              fillOpacity="0.48"
              fontSize="12"
              fontWeight="800"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>

      <motion.div
        style={enableScrollEffects ? { scale: heroScale, opacity: heroOpacity, y: heroY } : undefined}
        className="relative z-10 mx-auto flex min-h-[calc(100svh-8.5rem)] max-w-7xl items-center justify-center pb-20 pt-10 sm:pb-24 sm:pt-14 lg:pb-16 lg:pt-12"
      >
        <div className="mx-auto w-full max-w-5xl text-center">
          <motion.h1
            id="landing-title"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.62, ease: 'easeOut' }}
            className="mx-auto max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-[var(--edunets-ink)] sm:text-5xl md:text-6xl lg:text-7xl"
          >
            You knew Cell Division in March.
            <span className="mt-1 block text-[var(--edunets-dark-blue)]">Do you still?</span>
          </motion.h1>

          <motion.p
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.55, ease: 'easeOut' }}
            className="mx-auto mt-7 max-w-3xl text-base font-semibold leading-8 text-[var(--edunets-ink)]/72 sm:text-lg"
          >
            EduNets tracks a{' '}
            <span className="rounded-md bg-[var(--edunets-yellow)]/85 px-1.5 py-0.5 font-black text-[var(--edunets-dark-blue)]">
              live memory score
            </span>{' '}
            for every topic you study — and shows you{' '}
            <span className="rounded-md bg-[var(--edunets-yellow)]/85 px-1.5 py-0.5 font-black text-[var(--edunets-dark-blue)]">
              exactly what is fading
            </span>{' '}
            before revision becomes a rush.
          </motion.p>

          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.52, ease: 'easeOut' }}
            className="mt-9 flex flex-col items-center justify-center gap-3 min-[430px]:flex-row"
          >
            <motion.button
              type="button"
              onClick={onGetStarted}
              whileHover={shouldReduceMotion ? undefined : { y: -3, scale: 1.015 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              className="group inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--edunets-dark-blue)] via-[#4f75a8] to-[#9a781d] px-8 text-base font-black text-white shadow-[0_16px_38px_rgba(29,58,98,0.22)] outline-none transition-shadow hover:shadow-[0_20px_46px_rgba(29,58,98,0.28)] focus-visible:ring-4 focus-visible:ring-[var(--edunets-light-blue)]/30 min-[430px]:w-auto"
            >
              Get Started
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </motion.button>
            <motion.button
              type="button"
              onClick={onLogin}
              whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full border border-[var(--edunets-dark-blue)]/18 bg-white/72 px-7 text-base font-black text-[var(--edunets-dark-blue)] shadow-[0_10px_28px_rgba(29,58,98,0.08)] outline-none backdrop-blur-xl transition-colors hover:bg-white focus-visible:ring-4 focus-visible:ring-[var(--edunets-light-blue)]/25 min-[430px]:w-auto"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Log In
            </motion.button>
          </motion.div>

          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.52, ease: 'easeOut' }}
            className="mx-auto mt-9 flex max-w-xl flex-col items-stretch justify-center gap-3 min-[430px]:flex-row"
            role="list"
            aria-label="EduNets product scope"
          >
            {productScope.map(({ icon: Icon, number, label }, index) => (
              <motion.div
                key={label}
                role="listitem"
                className="flex min-w-0 flex-1 items-center justify-center gap-3 rounded-2xl border border-white/90 bg-white/72 px-5 py-3.5 text-left shadow-[0_12px_34px_rgba(29,58,98,0.09)] backdrop-blur-xl"
                animate={shouldReduceMotion ? undefined : { y: [0, index === 0 ? -4 : 4, 0] }}
                transition={{ duration: 4 + index * 0.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef4fb] text-[var(--edunets-light-blue)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block text-xl font-black leading-none text-[var(--edunets-dark-blue)]">{number}</strong>
                  <span className="mt-1 block text-xs font-bold text-[var(--edunets-ink)]/62">{label}</span>
                </span>
              </motion.div>
            ))}
          </motion.div>

          <motion.a
            href="#why"
            className="mx-auto mt-10 flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-black text-[var(--edunets-dark-blue)] outline-none transition-colors hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-[var(--edunets-light-blue)]"
            animate={shouldReduceMotion ? undefined : { y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            Explore how it works
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </motion.a>
        </div>
      </motion.div>
    </section>
  );
}
