'use client';

import { ArrowRight, Brain, GraduationCap, Sparkles, UserRound } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

type LandingCtaProps = {
  onGetStarted: () => void;
  onLogin: () => void;
};

const valueCards = [
  {
    body: 'Turn weak topics into a clear path—from captured ideas to focused practice and peer support.',
    icon: UserRound,
    label: 'For students',
  },
  {
    body: 'See where topic support is needed and respond with the learning context already connected.',
    icon: GraduationCap,
    label: 'For teachers',
  },
] as const;

const networkNodes = [
  { label: 'Capture', x: 76, y: 50, color: '#FFE38F' },
  { label: 'Students', x: 80, y: 194, color: '#FFFFFF' },
  { label: 'Concepts', x: 218, y: 28, color: '#A9C3E6' },
  { label: 'Practice', x: 218, y: 218, color: '#E8735F' },
  { label: 'Support', x: 504, y: 28, color: '#FFE38F' },
  { label: 'Teachers', x: 504, y: 218, color: '#FFFFFF' },
  { label: 'Squad', x: 644, y: 50, color: '#A9C3E6' },
  { label: 'Reflect', x: 640, y: 194, color: '#E8735F' },
] as const;

export function LandingCta({ onGetStarted, onLogin }: LandingCtaProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="impact" className="relative scroll-mt-24 overflow-hidden px-4 pb-6 pt-20 sm:px-6 sm:pb-8 sm:pt-24 lg:px-10 lg:pb-10 lg:pt-28">
      <motion.div
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[var(--edunets-dark-blue)] via-[#294f7c] to-[var(--edunets-light-blue)] px-5 py-12 text-white shadow-[0_32px_90px_rgba(29,58,98,0.25)] sm:px-10 sm:py-16 lg:px-16 lg:py-20"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 36, scale: 0.985 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.14 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <motion.div
            className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--edunets-yellow)]/20 blur-3xl"
            animate={shouldReduceMotion ? undefined : { x: [0, 35, 0], y: [0, 20, 0], scale: [1, 1.16, 1] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-white/10 blur-3xl"
            animate={shouldReduceMotion ? undefined : { x: [0, -28, 0], y: [0, -18, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-[var(--edunets-yellow)]" />
              Built for O-Level momentum
            </div>
            <h2 className="mt-6 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Every learning signal leads to a clearer next step.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-white/75 sm:text-lg">
              EduNets brings students, teachers, topics and revision activity into one connected learning flow.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            {valueCards.map(({ body, icon: Icon, label }, index) => (
              <motion.div
                key={label}
                className="rounded-[1.5rem] border border-white/15 bg-white/[0.09] p-5 backdrop-blur-sm sm:p-6"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.16 + index * 0.1, duration: 0.5 }}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--edunets-yellow)] text-[var(--edunets-dark-blue)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-xl font-black">{label}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-white/72 sm:text-base">{body}</p>
              </motion.div>
            ))}
          </div>

          <div className="relative mx-auto mt-10 max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#142f53]/55 px-2 py-5 sm:px-6 sm:py-7" aria-hidden="true">
            <div className="absolute left-1/2 top-1/2 z-10 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-white/15 bg-[var(--edunets-yellow)] text-[var(--edunets-dark-blue)] shadow-[0_0_44px_rgba(255,227,143,0.32)] sm:h-28 sm:w-28">
              <motion.div
                animate={shouldReduceMotion ? undefined : { y: [0, -4, 0], rotate: [0, -3, 3, 0] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Brain className="h-7 w-7 sm:h-8 sm:w-8" />
              </motion.div>
              <span className="mt-1 text-xs font-black sm:text-sm">EduNets</span>
            </div>

            <svg viewBox="0 0 720 246" className="h-auto min-h-52 w-full overflow-visible">
              {networkNodes.map((node, index) => (
                <g key={node.label}>
                  <motion.line
                    x1={node.x}
                    y1={node.y}
                    x2="360"
                    y2="123"
                    stroke={node.color}
                    strokeOpacity="0.46"
                    strokeWidth="2"
                    strokeDasharray="5 7"
                    initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    animate={shouldReduceMotion ? undefined : { strokeDashoffset: [0, -24] }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : {
                            pathLength: { delay: 0.18 + index * 0.06, duration: 0.55 },
                            opacity: { delay: 0.18 + index * 0.06, duration: 0.4 },
                            strokeDashoffset: { duration: 2.7, repeat: Infinity, ease: 'linear' },
                          }
                    }
                  />
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
                    r="7"
                    fill={node.color}
                    initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + index * 0.06, type: 'spring', stiffness: 180 }}
                  />
                  <circle cx={node.x} cy={node.y} r="14" fill="none" stroke={node.color} strokeOpacity="0.18" />
                  <text
                    x={node.x}
                    y={node.y + (node.y < 123 ? -17 : 24)}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.76)"
                    fontSize="11"
                    fontWeight="700"
                  >
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="mx-auto mt-10 max-w-2xl text-center">
            <p className="text-sm font-bold text-white/65">Ready to build your study network?</p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <motion.button
                type="button"
                onClick={onGetStarted}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[var(--edunets-yellow)] px-8 text-base font-black text-[var(--edunets-dark-blue)] shadow-[0_14px_35px_rgba(255,227,143,0.2)] outline-none transition-colors hover:bg-[#ffdc70] focus-visible:ring-4 focus-visible:ring-white/40"
                whileHover={shouldReduceMotion ? undefined : { y: -3, scale: 1.02 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              >
                Get Started
                <ArrowRight className="h-5 w-5" />
              </motion.button>
              <motion.button
                type="button"
                onClick={onLogin}
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/30 bg-white/10 px-8 text-base font-black text-white outline-none backdrop-blur-sm transition-colors hover:bg-white/16 focus-visible:ring-4 focus-visible:ring-white/40"
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              >
                Log In
              </motion.button>
            </div>
            <p className="mt-5 text-xs font-medium text-white/50">Product screens and learning flow shown for illustration.</p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
