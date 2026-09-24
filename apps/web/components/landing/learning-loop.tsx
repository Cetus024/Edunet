'use client';

import { AudioLines, BookOpenCheck, Network, RefreshCcw } from 'lucide-react';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { useRef } from 'react';

const loopStages = [
  {
    number: '01',
    title: 'Capture',
    icon: AudioLines,
    color: 'var(--edunets-coral)',
    copy: 'Turn a lesson or spoken explanation into study-ready content while the ideas are still fresh.',
    flow: 'Lesson → clear notes',
  },
  {
    number: '02',
    title: 'Map',
    icon: Network,
    color: 'var(--edunets-light-blue)',
    copy: 'Connect each idea to its subject, topic, and related concepts so knowledge becomes easier to navigate.',
    flow: 'Notes → concept network',
  },
  {
    number: '03',
    title: 'Practice',
    icon: BookOpenCheck,
    color: 'var(--edunets-dark-blue)',
    copy: 'Generate focused O-Level-style practice around the topic that needs attention right now.',
    flow: 'Weak link → focused quiz',
  },
  {
    number: '04',
    title: 'Recover',
    icon: RefreshCcw,
    color: 'var(--edunets-yellow)',
    copy: 'Feed every review result back into the memory map and keep the next revision step relevant.',
    flow: 'Review → stronger memory',
  },
] as const;

export function LearningLoop() {
  const sectionRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.78', 'end 0.3'],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 85, damping: 24, mass: 0.28 });

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      aria-labelledby="learning-loop-title"
      className="relative scroll-mt-24 overflow-hidden bg-[var(--edunets-dark-blue)] px-4 py-24 text-white sm:px-6 sm:py-28 lg:px-10 lg:py-32"
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 16% 15%, rgba(255,227,143,0.75), transparent 24%), radial-gradient(circle at 86% 82%, rgba(100,134,181,0.85), transparent 28%)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--edunets-yellow)]">One connected learning loop</p>
          <h2 id="learning-loop-title" className="mt-5 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            Capture. Map. Practice. Recover.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-relaxed text-white/65 sm:text-lg">
            Every step informs the next, turning scattered study activity into a continuous picture of what you know and what to do next.
          </p>
        </motion.div>

        <div className="relative mt-16 hidden lg:block">
          <div className="absolute left-[12.5%] right-[12.5%] top-8 h-1 rounded-full bg-white/12" aria-hidden="true">
            <motion.div
              className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--edunets-coral)] via-[var(--edunets-yellow)] to-white"
              style={{ scaleX: shouldReduceMotion ? 1 : progress }}
            />
          </div>

          <div className="grid grid-cols-4 gap-5">
            {loopStages.map(({ number, title, icon: Icon, color, copy, flow }, index) => (
              <motion.article
                key={title}
                className="relative pt-20"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.48, delay: index * 0.08, ease: 'easeOut' }}
              >
                <div
                  className="absolute left-1/2 top-0 z-10 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-2xl border-4 border-[var(--edunets-dark-blue)] shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
                  style={{ backgroundColor: color, color: index === 3 ? 'var(--edunets-dark-blue)' : '#ffffff' }}
                >
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </div>

                <div className="h-full rounded-[1.75rem] border border-white/12 bg-white/[0.08] p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Step {number}</span>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                  </div>
                  <h3 className="mt-5 text-2xl font-black">{title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-white/65">{copy}</p>
                  <div className="mt-6 rounded-xl bg-black/15 px-3 py-2 text-xs font-black text-white/80">{flow}</div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>

        <div className="relative mt-14 space-y-5 pl-14 lg:hidden">
          <div className="absolute bottom-8 left-[1.18rem] top-8 w-1 rounded-full bg-white/12" aria-hidden="true">
            <motion.div
              className="h-full origin-top rounded-full bg-gradient-to-b from-[var(--edunets-coral)] via-[var(--edunets-yellow)] to-white"
              style={{ scaleY: shouldReduceMotion ? 1 : progress }}
            />
          </div>

          {loopStages.map(({ number, title, icon: Icon, color, copy, flow }, index) => (
            <motion.article
              key={title}
              className="relative rounded-[1.75rem] border border-white/12 bg-white/[0.08] p-6 backdrop-blur-sm"
              initial={shouldReduceMotion ? false : { opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.04, ease: 'easeOut' }}
            >
              <div
                className="absolute -left-[3.65rem] top-6 flex h-10 w-10 items-center justify-center rounded-xl border-4 border-[var(--edunets-dark-blue)] shadow-lg"
                style={{ backgroundColor: color, color: index === 3 ? 'var(--edunets-dark-blue)' : '#ffffff' }}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Step {number}</p>
              <h3 className="mt-2 text-2xl font-black">{title}</h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-white/65">{copy}</p>
              <div className="mt-5 rounded-xl bg-black/15 px-3 py-2 text-xs font-black text-white/80">{flow}</div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
