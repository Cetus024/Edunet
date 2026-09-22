'use client';

import { AlertTriangle, Brain, Clock3, Link2, Sparkles, TrendingUp } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { useRef } from 'react';

const storyStages = [
  {
    number: '01',
    eyebrow: 'Notice the change',
    title: 'Memory fades quietly.',
    copy: 'A topic can feel secure after class, then become harder to recall as the days pass. EduNets makes that change visible before revision becomes a rush.',
  },
  {
    number: '02',
    eyebrow: 'Locate the weak link',
    title: 'Find what needs attention.',
    copy: 'Instead of treating an entire subject as weak, the concept network points to the exact connection that is starting to slip.',
  },
  {
    number: '03',
    eyebrow: 'Take the next step',
    title: 'Recover with focused review.',
    copy: 'A short, targeted review turns the weak concept into a clear action—so every minute has a purpose and the memory map can update.',
  },
] as const;

type StageVisualProps = {
  stage: number;
};

function StageVisual({ stage }: StageVisualProps) {
  if (stage === 0) {
    return (
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--edunets-light-blue)]">
              Memory score
            </p>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-5xl font-black tracking-tight text-[var(--edunets-dark-blue)] sm:text-6xl">
                78%
              </span>
              <span className="pb-2 text-lg font-black text-[var(--edunets-coral)]">→ 28%</span>
            </div>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--edunets-coral)]/12 text-[var(--edunets-coral)]">
            <TrendingUp className="h-6 w-6 rotate-180" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-8 rounded-[1.5rem] bg-[var(--edunets-cream)] p-5">
          <div className="flex h-32 items-end gap-2" aria-hidden="true">
            {[84, 78, 68, 57, 44, 28].map((height, index) => (
              <div key={height} className="flex h-full flex-1 items-end">
                <div
                  className={`w-full rounded-t-xl ${index > 3 ? 'bg-[var(--edunets-coral)]' : 'bg-[var(--edunets-light-blue)]'}`}
                  style={{ height: `${height}%`, opacity: 0.48 + index * 0.08 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[10px] font-black uppercase tracking-[0.14em] text-foreground/45">
            <span>After class</span>
            <span>Revision due</span>
          </div>
        </div>

        <p className="mt-5 flex items-center gap-2 text-xs font-bold text-foreground/55">
          <AlertTriangle className="h-4 w-4 text-[var(--edunets-coral)]" aria-hidden="true" />
          A timely signal, not another last-minute surprise.
        </p>
      </div>
    );
  }

  if (stage === 1) {
    return (
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--edunets-light-blue)]">
              Concept network
            </p>
            <h3 className="mt-3 text-3xl font-black text-[var(--edunets-dark-blue)]">One weak link, clearly marked.</h3>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--edunets-yellow)] text-[var(--edunets-dark-blue)]">
            <Link2 className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>

        <div className="relative mt-8 min-h-56 overflow-hidden rounded-[1.75rem] bg-[#F6ECDC]">
          {/* eslint-disable-next-line @next/next/no-img-element -- a real
              product screenshot, not an optimizable local asset pipeline
              candidate; plain <img> avoids next/image's build-time layout
              requirements for a purely decorative marketing panel. */}
          <img
            src="/marketing/concept-web-screenshot.png"
            alt="A real EduNets Concept Web: Physics topics colour-coded by mastery, with Energy marked weak in red."
            className="h-full w-full object-cover object-[50%_20%]"
          />
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[var(--edunets-coral)]/25 bg-[var(--edunets-coral)]/[0.07] p-4">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--edunets-coral)]" />
          <p className="text-sm font-bold text-[var(--edunets-dark-blue)]">Priority found: Energy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--edunets-light-blue)]">
            Targeted recovery
          </p>
          <div className="mt-3 flex items-baseline gap-2 text-[var(--edunets-dark-blue)]">
            <span className="text-6xl font-black tracking-tight">12</span>
            <span className="text-xl font-black">minutes</span>
          </div>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--edunets-yellow)] text-[var(--edunets-dark-blue)]">
          <Clock3 className="h-6 w-6" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {['Recall the key idea', 'Practise the weak connection', 'Refresh the memory map'].map((item, index) => (
          <div key={item} className="flex items-center gap-3 rounded-2xl border border-border bg-[var(--edunets-cream)]/55 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--edunets-dark-blue)] text-xs font-black text-white">
              {index + 1}
            </span>
            <span className="text-sm font-bold text-[var(--edunets-dark-blue)]">{item}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-full bg-border/70">
        <div className="h-3 w-[78%] rounded-full bg-gradient-to-r from-[var(--edunets-coral)] via-[var(--edunets-yellow)] to-[var(--edunets-light-blue)]" />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-black uppercase tracking-[0.12em]">
        <span className="text-[var(--edunets-coral)]">Weak</span>
        <span className="text-[var(--edunets-dark-blue)]">Recovery in progress</span>
      </div>
    </div>
  );
}

export function MemoryStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const storyTrackRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: storyTrackRef,
    offset: ['start start', 'end end'],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.25 });

  const firstOpacity = useTransform(progress, [0, 0.29, 0.42], [1, 1, 0]);
  const firstY = useTransform(progress, [0.29, 0.42], [0, -28]);
  const secondOpacity = useTransform(progress, [0.24, 0.38, 0.64, 0.76], [0, 1, 1, 0]);
  const secondY = useTransform(progress, [0.24, 0.38, 0.64, 0.76], [28, 0, 0, -28]);
  const thirdOpacity = useTransform(progress, [0.61, 0.77, 1], [0, 1, 1]);
  const thirdY = useTransform(progress, [0.61, 0.77], [28, 0]);
  const progressScale = useTransform(progress, [0.05, 0.95], [0, 1]);

  const desktopPanels = [
    { opacity: firstOpacity, y: firstY },
    { opacity: secondOpacity, y: secondY },
    { opacity: thirdOpacity, y: thirdY },
  ] as const;

  return (
    <section
      id="why"
      ref={sectionRef}
      aria-labelledby="memory-story-title"
      className="relative scroll-mt-24 px-4 py-24 sm:px-6 sm:py-28 lg:px-10 lg:py-32"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 top-40 h-96 w-96 rounded-full bg-[var(--edunets-yellow)]/35 blur-3xl" />
        <div className="absolute -right-44 bottom-32 h-96 w-96 rounded-full bg-[var(--edunets-light-blue)]/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl">
        <motion.div
          className="max-w-3xl"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--edunets-yellow)] bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--edunets-dark-blue)] shadow-sm backdrop-blur-sm">
            <Sparkles className="h-4 w-4 text-[var(--edunets-coral)]" aria-hidden="true" />
            Illustrative product scenario
          </div>
          <h2 id="memory-story-title" className="mt-6 text-4xl font-black leading-tight text-[var(--edunets-dark-blue)] sm:text-5xl lg:text-6xl">
            Revision starts before the panic does.
          </h2>
          <p className="mt-5 max-w-2xl text-base font-medium leading-relaxed text-foreground/65 sm:text-lg">
            EduNets turns a fading memory into a visible signal, a precise weak point, and one manageable next action.
          </p>
        </motion.div>

        <div className="mt-14 space-y-6 lg:hidden">
          {storyStages.map((stage, index) => (
            <motion.article
              key={stage.title}
              className="overflow-hidden rounded-[2rem] border border-border bg-white p-6 shadow-[0_18px_50px_rgba(29,58,98,0.10)] sm:p-8"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <div className="mb-7 flex items-center gap-3">
                <span className="text-xs font-black text-[var(--edunets-coral)]">{stage.number}</span>
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-black uppercase tracking-[0.14em] text-foreground/45">{stage.eyebrow}</span>
              </div>
              <h3 className="text-2xl font-black text-[var(--edunets-dark-blue)]">{stage.title}</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-foreground/65">{stage.copy}</p>
              <div className="mt-7 rounded-[1.5rem] border border-border bg-white p-5">
                <StageVisual stage={index} />
              </div>
            </motion.article>
          ))}
          <p className="text-center text-xs font-bold text-foreground/45">
            The scores and timing above demonstrate the product flow; they are illustrative, not measured learning outcomes.
          </p>
        </div>

        <div ref={storyTrackRef} className="mt-20 hidden items-start gap-16 lg:grid lg:grid-cols-[1.12fr_0.88fr]">
          <div className="sticky top-20 h-[calc(100svh-6rem)] max-h-[46rem]" aria-hidden="true">
            <div className="relative h-full overflow-hidden rounded-[2.5rem] border border-border bg-white p-8 shadow-[0_28px_80px_rgba(29,58,98,0.14)] xl:p-10">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-border/60">
                <motion.div
                  className="h-full origin-left bg-gradient-to-r from-[var(--edunets-coral)] via-[var(--edunets-yellow)] to-[var(--edunets-light-blue)]"
                  style={{ scaleX: shouldReduceMotion ? 1 : progressScale }}
                />
              </div>
              <div className="absolute inset-8 top-10 xl:inset-10 xl:top-12">
                {desktopPanels.map((panel, index) => (
                  <motion.div
                    key={storyStages[index].title}
                    className="absolute inset-0"
                    style={shouldReduceMotion ? { opacity: index === 2 ? 1 : 0 } : panel}
                  >
                    <StageVisual stage={index} />
                  </motion.div>
                ))}
              </div>
              <div className="absolute bottom-5 left-8 right-8 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-foreground/40 xl:left-10 xl:right-10">
                <span>Illustrative flow</span>
                <span>Not a measured outcome</span>
              </div>
            </div>
          </div>

          <div>
            {storyStages.map((stage, index) => (
              <motion.article
                key={stage.title}
                className="flex min-h-[62vh] items-center py-12"
                initial={shouldReduceMotion ? false : { opacity: 0.35, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ amount: 0.55 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                <div>
                  <div className="flex items-center gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--edunets-dark-blue)] text-sm font-black text-white">
                      {stage.number}
                    </span>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--edunets-coral)]">{stage.eyebrow}</p>
                  </div>
                  <h3 className="mt-7 text-3xl font-black leading-tight text-[var(--edunets-dark-blue)] xl:text-4xl">{stage.title}</h3>
                  <p className="mt-5 text-base font-medium leading-relaxed text-foreground/65 xl:text-lg">{stage.copy}</p>
                  {index === 2 && (
                    <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--edunets-yellow)]/55 px-4 py-2 text-sm font-black text-[var(--edunets-dark-blue)]">
                      <Brain className="h-4 w-4" aria-hidden="true" />
                      One clear action at a time
                    </div>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
