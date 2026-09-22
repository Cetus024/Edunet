'use client';

import type { ReactNode } from 'react';
import {
  BrainCircuit,
  Check,
  FileQuestion,
  MessageCircleQuestion,
  Mic2,
  Network,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

type FeatureCardProps = {
  children: ReactNode;
  className?: string;
  description: string;
  eyebrow: string;
  icon: typeof FileQuestion;
  index: number;
  title: string;
};

const waveform = [18, 32, 22, 46, 30, 54, 38, 26, 48, 34, 20, 40, 28, 16];

const conceptNodes = [
  { label: 'Trigonometry', x: 140, y: 72, tone: '#FFE38F' },
  { label: 'Angles', x: 50, y: 34, tone: '#FFFFFF' },
  { label: 'Sine', x: 244, y: 27, tone: '#A9C3E6' },
  { label: 'Graphs', x: 252, y: 113, tone: '#E8735F' },
  { label: 'Triangles', x: 58, y: 122, tone: '#FFFFFF' },
] as const;

const conceptLinks = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 4],
  [2, 3],
] as const;

function FeatureCard({
  children,
  className = '',
  description,
  eyebrow,
  icon: Icon,
  index,
  title,
}: FeatureCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.article
      className={`group relative overflow-hidden rounded-[2rem] border border-border/80 bg-white p-5 shadow-[0_18px_55px_rgba(29,58,98,0.09)] sm:p-7 ${className}`}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 34, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay: index * 0.07, duration: 0.55, ease: 'easeOut' }}
      whileHover={shouldReduceMotion ? undefined : { y: -5 }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[var(--edunets-yellow)]/20 blur-3xl transition-opacity group-hover:opacity-90" />
      <div className="relative flex h-full flex-col">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--edunets-dark-blue)] text-white shadow-[0_10px_24px_rgba(29,58,98,0.2)]">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--edunets-coral)]">{eyebrow}</p>
            <h3 className="mt-1 text-2xl font-black text-[var(--edunets-ink)]">{title}</h3>
            <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>
        </div>
        <div className="mt-auto">{children}</div>
      </div>
    </motion.article>
  );
}

function QuizPreview() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="rounded-[1.5rem] border border-border bg-[var(--edunets-cream)]/70 p-4" aria-hidden="true">
      <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--edunets-dark-blue)]/70">
        <span className="rounded-full bg-white px-3 py-1.5">Trigonometry</span>
        <span>2 of 5</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--edunets-dark-blue)]/10">
        <motion.div
          className="h-full rounded-full bg-[var(--edunets-coral)]"
          style={shouldReduceMotion ? { width: '40%' } : undefined}
          initial={shouldReduceMotion ? false : { width: '18%' }}
          whileInView={shouldReduceMotion ? undefined : { width: '40%' }}
          viewport={{ once: true }}
          transition={{ delay: 0.25, duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <p className="mt-4 text-base font-black leading-snug text-[var(--edunets-ink)] sm:text-lg">
        What is the exact value of cos 60°?
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-bold text-[var(--edunets-ink)]">
        {['√3 / 2', '1 / 2', '√2 / 2', '1'].map((answer) => (
          <div
            key={answer}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
              answer === '1 / 2'
                ? 'border-[var(--edunets-dark-blue)] bg-[var(--edunets-dark-blue)] text-white'
                : 'border-border bg-white'
            }`}
          >
            {answer === '1 / 2' && <Check className="h-4 w-4" />}
            {answer}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConceptWebPreview() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[var(--edunets-dark-blue)] to-[var(--edunets-light-blue)] p-3" aria-hidden="true">
      <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.13em] text-white/75">
        Live concept map
      </div>
      <svg viewBox="0 0 300 150" className="mt-5 h-auto w-full overflow-visible">
        {conceptLinks.map(([from, to], index) => (
          <motion.line
            key={`${from}-${to}`}
            x1={conceptNodes[from].x}
            y1={conceptNodes[from].y}
            x2={conceptNodes[to].x}
            y2={conceptNodes[to].y}
            stroke="rgba(255,255,255,0.38)"
            strokeWidth="1.5"
            strokeDasharray="4 5"
            initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + index * 0.08, duration: 0.45 }}
          />
        ))}
        {conceptNodes.map((node, index) => (
          <g key={node.label}>
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={index === 0 ? 9 : 6}
              fill={node.tone}
              initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + index * 0.08, type: 'spring', stiffness: 180 }}
            />
            <text
              x={node.x}
              y={node.y + (index === 0 ? 23 : 18)}
              textAnchor="middle"
              fill="rgba(255,255,255,0.88)"
              fontSize={index === 0 ? 9 : 8}
              fontWeight="700"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function CapturePreview() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="rounded-[1.5rem] border border-border bg-[var(--edunets-cream)]/65 p-4" aria-hidden="true">
      <div className="flex items-center gap-3">
        <motion.div
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--edunets-coral)] text-white"
          animate={shouldReduceMotion ? undefined : { boxShadow: ['0 0 0 0 rgba(232,115,95,0.32)', '0 0 0 9px rgba(232,115,95,0)', '0 0 0 0 rgba(232,115,95,0)'] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
        >
          <Mic2 className="h-5 w-5" />
        </motion.div>
        <div>
          <p className="text-sm font-black text-[var(--edunets-ink)]">Live capture</p>
          <p className="text-xs font-bold text-[var(--edunets-coral)]">Recording · 02:18</p>
        </div>
      </div>
      <div className="mt-4 flex h-14 items-center justify-center gap-1 rounded-xl bg-white px-3">
        {waveform.map((height, index) => (
          <motion.span
            key={`${height}-${index}`}
            className="w-1.5 rounded-full bg-[var(--edunets-light-blue)]"
            style={{ height }}
            animate={shouldReduceMotion ? undefined : { scaleY: [0.55, 1, 0.68] }}
            transition={{ duration: 0.85, repeat: Infinity, delay: index * 0.05, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <p className="mt-3 rounded-xl bg-white px-3 py-2.5 text-xs font-medium leading-relaxed text-muted-foreground">
        “Energy is transferred through each level of the food chain…”
      </p>
    </div>
  );
}

function SquadPreview() {
  return (
    <div className="rounded-[1.5rem] border border-border bg-gradient-to-r from-[#eff5fc] to-[var(--edunets-cream)] p-4" aria-hidden="true">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--edunets-light-blue)]">Rescue room</p>
          <p className="mt-1 font-black text-[var(--edunets-ink)]">Cell Division Sprint</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[var(--edunets-coral)]">12 min</span>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <div className="flex -space-x-2">
          {[
            ['JL', '#1D3A62'],
            ['MK', '#E8735F'],
            ['SA', '#6486B5'],
            ['+2', '#FFE38F'],
          ].map(([initials, color]) => (
            <span
              key={initials}
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[10px] font-black"
              style={{ backgroundColor: color, color: color === '#FFE38F' ? '#1D3A62' : '#FFFFFF' }}
            >
              {initials}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--edunets-dark-blue)]">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Studying now
        </div>
      </div>
    </div>
  );
}

function AskTeacherPreview() {
  return (
    <div className="grid gap-3 rounded-[1.5rem] border border-border bg-[var(--edunets-cream)]/55 p-4 sm:grid-cols-[0.85fr_1.15fr]" aria-hidden="true">
      <div className="rounded-2xl bg-white p-4">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em] text-[var(--edunets-coral)]">
          <Sparkles className="h-4 w-4" />
          Topic context
        </div>
        <p className="mt-3 font-black text-[var(--edunets-ink)]">Electrolysis</p>
        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-[var(--edunets-coral)]" />
          Memory score needs attention
        </div>
      </div>
      <div className="space-y-2 rounded-2xl bg-white p-4">
        <div className="mr-8 rounded-2xl rounded-bl-md bg-[#eef4fb] px-3 py-2.5 text-xs font-medium text-[var(--edunets-ink)]">
          Why do ions move to different electrodes?
        </div>
        <div className="ml-8 rounded-2xl rounded-br-md bg-[var(--edunets-dark-blue)] px-3 py-2.5 text-xs font-medium text-white">
          Let’s connect charge, attraction and the electrode names.
        </div>
      </div>
    </div>
  );
}

export function FeatureShowcase() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="features" className="relative scroll-mt-24 overflow-hidden px-4 py-24 sm:px-6 sm:py-28 lg:px-10 lg:py-32">
      <div className="pointer-events-none absolute left-1/2 top-8 -z-10 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-[var(--edunets-light-blue)]/15 blur-3xl" />
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="mx-auto mb-12 max-w-3xl text-center sm:mb-16"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--edunets-light-blue)]/25 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--edunets-dark-blue)] shadow-sm">
            <BrainCircuit className="h-4 w-4 text-[var(--edunets-coral)]" />
            Everything works together
          </div>
          <h2 className="mt-6 text-4xl font-black leading-tight text-[var(--edunets-ink)] sm:text-5xl">
            One study network. Five ways to move forward.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
            Capture what was taught, see how ideas connect, practise the right topic, and reach the right people when you need support.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          <FeatureCard
            className="md:col-span-7"
            description="Build a focused set of O-Level-style questions for the subject and topic you choose, then review each explanation."
            eyebrow="Targeted practice"
            icon={FileQuestion}
            index={0}
            title="Smart Quiz"
          >
            <QuizPreview />
          </FeatureCard>

          <FeatureCard
            className="md:col-span-5"
            description="Turn separate chapters into a visual map, so strong links and topics that need another look are easier to spot."
            eyebrow="Connected understanding"
            icon={Network}
            index={1}
            title="Concept Web"
          >
            <ConceptWebPreview />
          </FeatureCard>

          <FeatureCard
            className="md:col-span-5"
            description="Record a learning moment, follow the live transcript, and keep the captured content ready for the next step."
            eyebrow="From lesson to notes"
            icon={Mic2}
            index={2}
            title="Capture Hub"
          >
            <CapturePreview />
          </FeatureCard>

          <FeatureCard
            className="md:col-span-7"
            description="Bring classmates into a focused rescue room and make a difficult topic feel less like a solo task."
            eyebrow="Learn together"
            icon={UsersRound}
            index={3}
            title="Study Squad"
          >
            <SquadPreview />
          </FeatureCard>

          <FeatureCard
            className="md:col-span-12"
            description="Share a question with its topic context already attached, helping teachers understand where support is needed."
            eyebrow="Help with context"
            icon={MessageCircleQuestion}
            index={4}
            title="Ask Teacher"
          >
            <AskTeacherPreview />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
