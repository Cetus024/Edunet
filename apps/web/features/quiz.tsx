'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAtom } from 'jotai';
import { resolveCurriculumTopic } from '@/lib/curriculum';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, BookOpen, Brain, CalendarClock, CheckCircle2, ChevronDown, Eye, EyeOff, FileText, ImageIcon, Inbox, LoaderCircle, RotateCcw, Sparkles, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { TeacherQuizReview } from '@/components/teacher-quiz-review';
import { ExamOptionsImage, ExamQuestionStem } from '@/components/exam-question-stem';
import { ExamKatexText } from '@/components/exam-katex-text';
import {
  ExamStructuredAnswerSheet,
  parseStructuredAnswers,
  serializeStructuredAnswers,
  structuredAnswersComplete,
  type StructuredAnswersMap,
} from '@/components/exam-structured-answer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

import { RoughNotation } from 'react-rough-notation';

import { useMascotFeedback } from '@/features/mascot';
import { QuizIntro } from '@/features/quiz-intro';
import { QuizRecapCard } from '@/components/quiz-recap-card';
import {
  abandonAssessment,
  completeAssessmentFeedback,
  extractRecapFromSession,
  finishAssessment,
  generateQuizSet,
  getQuizOptions,
  getQuizRecap,
  submitAssessmentAnswer,
  type AssessmentMode,
  type AssessmentSessionResponse,
  type EssayMarkCode,
  type EssayMarkPoint,
  type EssayPartFeedback,
  type QuizRecap,
} from '@/lib/api/quiz';
import { useCurrentAccount } from '@/lib/api/me';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { isTeachingRole } from '@/lib/roles';
import { getKnowledgeScoreColor } from '@/lib/score-color';
import { formatModelNumber, formatModelPercent, formatPercentageValue } from '@/lib/knowledge-number-format';
import { rescueNudgeLogsAtom, subjectsAtom, type RescueNudgeLog } from '@/lib/study-data';
import { cn } from '@/lib/utils';

type QuizState = 'setup' | 'active' | 'results';

type HoverSelectOption = { value: string; label: string };

const HOVER_EASE = [0.22, 1, 0.36, 1] as const;
const HOVER_CLOSE_MS = 140;

function SetupPanel({ subjectName, topicId, subtopicId, mode, loading, onSubject, onTopic, onSubtopic, onMode, onStart }: {
  subjectName: string;
  topicId: string;
  subtopicId: string;
  mode: AssessmentMode;
  loading: boolean;
  onSubject: (value: string) => void;
  onTopic: (value: string) => void;
  onSubtopic: (value: string) => void;
  onMode: (value: AssessmentMode) => void;
  onStart: () => void;
}) {
  const [subjects] = useAtom(subjectsAtom);
  const subject = subjects.find((entry) => entry.name === subjectName);
  const topic = subject?.topics.find((entry) => entry.id === topicId);
  const hasSubtopics = Boolean(topic && topic.subtopics.length > 0);
  const { data: options } = useQuery({
    queryKey: ['quiz-options', subject?.id, topicId, subtopicId],
    queryFn: () => getQuizOptions(subject!.id, topicId, subtopicId || undefined),
    enabled: Boolean(subject?.id && topicId),
  });
  const available = options?.modes[mode].available !== false;

  const subjectOptions = subjects.map((entry) => ({ value: entry.name, label: entry.name }));
  const topicOptions = (subject?.topics ?? []).map((entry) => ({
    value: entry.id,
    label: `${entry.syllabusCode} · ${entry.name}`,
  }));
  const subtopicOptions: HoverSelectOption[] = [
    { value: '', label: 'All subtopics' },
    ...(topic?.subtopics ?? []).map((entry) => ({
      value: entry.id,
      label: `${entry.syllabusCode} · ${entry.name}`,
    })),
  ];

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center gap-3 lg:gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1D3A62]/10 lg:h-12 lg:w-12">
          <Brain className="h-5 w-5 text-[#1D3A62] lg:h-6 lg:w-6" />
        </span>
        <div>
          <h2 className="text-xl font-black tracking-tight lg:text-2xl">Smart Assessment</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Choose a topic, subtopic and evidence mode</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 lg:mt-6 lg:gap-5">
        <div className="space-y-3.5 lg:space-y-4">
          <HoverSelect
            label="Subject"
            placeholder="Select subject"
            value={subjectName}
            options={subjectOptions}
            onChange={onSubject}
          />

          <motion.div
            layout
            className={cn('grid gap-3', hasSubtopics ? 'sm:grid-cols-2' : 'grid-cols-1')}
            transition={{ duration: 0.28, ease: HOVER_EASE }}
          >
            <HoverSelect
              label="Topic"
              placeholder="Select topic"
              value={topicId}
              options={topicOptions}
              onChange={onTopic}
              disabled={!subject}
            />

            <AnimatePresence initial={false} mode="popLayout">
              {hasSubtopics && (
                <motion.div
                  key="subtopic-select"
                  initial={{ opacity: 0, x: -10, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -8, scale: 0.98 }}
                  transition={{ duration: 0.24, ease: HOVER_EASE }}
                >
                  <HoverSelect
                    label="Subtopic"
                    placeholder="All subtopics"
                    value={subtopicId}
                    options={subtopicOptions}
                    onChange={onSubtopic}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <div>
            <span className="text-sm font-black uppercase tracking-wide text-muted-foreground">Assessment mode</span>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {([
                ['mcq', 'MCQ', '10 questions'],
                ['essay', 'Essay', '5 x 10 marks'],
              ] as const).map(([id, label, detail]) => {
                const selected = mode === id;
                return (
                  <motion.button
                    key={id}
                    type="button"
                    onClick={() => onMode(id)}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className={`relative overflow-hidden rounded-2xl border-2 px-4 py-3.5 text-left lg:px-5 lg:py-4 ${selected ? 'border-[#1D3A62] bg-[#1D3A62]/5 shadow-[0_6px_16px_rgba(29,58,98,0.18)]' : 'border-border bg-card hover:border-[#1D3A62]/40'}`}
                  >
                    {selected && (
                      <motion.span
                        layoutId="mode-glow"
                        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-[#1D3A62]/12 via-transparent to-[#FFE38F]/25"
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                      />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-base lg:text-lg">{label}</strong>
                      <AnimatePresence>
                        {selected && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.6 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                          >
                            <CheckCircle2 className="h-5 w-5 text-[#1D3A62]" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <span className="mt-1 block text-sm text-muted-foreground">{detail}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {topic && (
              <motion.div
                key="topic-stats"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.22, ease: HOVER_EASE }}
                className="rounded-2xl bg-muted/25 px-3.5 py-3 text-sm"
              >
                <div className="flex justify-between">
                  <span>Concept Memory</span>
                  <strong>{topic.memoryScore === null ? 'Not Started' : formatPercentageValue(topic.memoryScore)}</strong>
                </div>
                <div className="mt-1.5 flex justify-between">
                  <span>Recommended</span>
                  <strong>{topic.recommendedMode?.toUpperCase() ?? 'Either mode'}</strong>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div whileHover={{ scale: available && subject && topicId ? 1.01 : 1 }} whileTap={{ scale: available && subject && topicId ? 0.98 : 1 }} className="shrink-0 pt-3 sm:pt-4">
          <Button
            className="h-12 w-full rounded-2xl bg-[#1D3A62] text-base font-bold text-white hover:bg-[#1D3A62]/90 lg:h-14 lg:text-lg"
            disabled={!subject || !topicId || loading || !available}
            onClick={onStart}
          >
            {loading ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : null}
            Start the quiz
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function HoverSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: HoverSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = options.find((entry) => entry.value === value);
  const display = selected?.label || placeholder;

  const clearClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const show = () => {
    if (disabled) return;
    clearClose();
    setOpen(true);
  };

  const hideSoon = () => {
    clearClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  };

  useEffect(() => () => clearClose(), []);

  return (
    <div
      className="block space-y-2"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onFocus={show}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          hideSoon();
        }
      }}
    >
      <span className="text-sm font-black uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="relative">
        <motion.button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          whileHover={disabled ? undefined : { y: -1 }}
          transition={{ duration: 0.15, ease: HOVER_EASE }}
          className={cn(
            'border-input flex h-12 w-full items-center justify-between gap-2 rounded-xl border bg-transparent px-4 py-3 text-left text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:h-14 lg:rounded-2xl lg:px-5 lg:text-lg',
            disabled && 'cursor-not-allowed opacity-50',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="min-w-0 truncate">{display}</span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2, ease: HOVER_EASE }}
            className="inline-flex"
          >
            <ChevronDown className="size-5 shrink-0 opacity-50" />
          </motion.span>
        </motion.button>

        <AnimatePresence>
          {open && !disabled && (
            <motion.ul
              key={`${label}-menu`}
              role="listbox"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: HOVER_EASE }}
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-64 origin-top overflow-y-auto rounded-2xl border bg-popover p-2 text-popover-foreground shadow-[0_16px_40px_rgba(29,58,98,0.16)]"
            >
              {options.map((entry, index) => {
                const isSelected = entry.value === value;
                return (
                  <motion.li
                    key={entry.value || `${label}-empty`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 + index * 0.025, duration: 0.18, ease: HOVER_EASE }}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        'flex w-full items-center rounded-xl px-3.5 py-3 text-left text-base outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                        isSelected && 'bg-[#1D3A62]/8 text-[#1D3A62]',
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onChange(entry.value);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                      <AnimatePresence>
                        {isSelected && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                          >
                            <CheckCircle2 className="ml-2 h-4 w-4 shrink-0" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PulseBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-[#1D3A62]/10',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.35s_infinite]',
        'before:bg-gradient-to-r before:from-transparent before:via-white/55 before:to-transparent',
        className,
      )}
    />
  );
}

/** YouTube-style shimmer that mirrors the live QuestionPanel + available-questions panel. */
function QuestionSessionSkeleton({ mode, total = 10 }: { mode: AssessmentMode; total?: number }) {
  const gridCount = Math.min(Math.max(total, 5), 12);
  return (
    <div className="relative flex min-h-0 w-full flex-1" aria-busy="true" aria-label="Loading quiz session">
      <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-[min(1200px,100%)] flex-1 flex-col px-2 sm:px-4 lg:pr-[7.75rem]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1D3A62]/12 pb-3">
          <PulseBar className="h-7 w-52 sm:w-64 lg:h-8" />
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <PulseBar className="hidden h-4 w-24 sm:block" />
            <PulseBar className="h-9 w-9 rounded-lg" />
          </div>
        </div>
        <PulseBar className="mt-2 h-1.5 w-full shrink-0 rounded-full" />

        <div className="mt-3 flex min-h-0 flex-1 flex-col sm:mt-4">
          {mode === 'mcq' ? (
            <div className="flex min-h-0 w-full flex-col justify-start gap-3 lg:gap-4">
              <div className="mx-auto w-full rounded-2xl border border-white/80 bg-[#FBF5F5] px-6 py-[calc(1rem+50px)] shadow-[0_18px_48px_rgba(29,58,98,0.14)] sm:px-8 sm:py-[calc(1.25rem+50px)] lg:px-10">
                <PulseBar className="mx-auto h-3.5 w-56 rounded-full sm:h-4 sm:w-64" />
                <div className="mt-3 space-y-3 sm:mt-3.5">
                  <PulseBar className="mx-auto h-6 w-full max-w-2xl" />
                  <PulseBar className="mx-auto h-6 w-[82%] max-w-xl" />
                  <PulseBar className="mx-auto h-6 w-[64%] max-w-lg" />
                </div>
              </div>
              <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:gap-4">
                {['A', 'B', 'C', 'D'].map((label) => (
                  <div
                    key={label}
                    className="flex min-h-[5rem] items-center gap-4 rounded-2xl border-2 border-transparent bg-white/75 px-5 py-4 lg:min-h-[5.5rem] lg:gap-5 lg:px-6"
                  >
                    <PulseBar className="h-10 w-10 shrink-0 rounded-lg lg:h-11 lg:w-11" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <PulseBar className="h-4 w-full" />
                      <PulseBar className="h-4 w-2/3" />
                    </div>
                    <PulseBar className="ml-auto h-7 w-7 shrink-0 rounded-md" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex shrink-0 items-center justify-between gap-3">
                <PulseBar className="h-10 w-[7.5rem] rounded-xl" />
                <PulseBar className="h-10 w-24 rounded-xl" />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 w-full flex-col justify-start gap-3">
              <div className="mx-auto w-full rounded-2xl border border-white/80 bg-[#FBF5F5] px-6 py-[calc(1rem+50px)] shadow-[0_18px_48px_rgba(29,58,98,0.14)] sm:px-8 sm:py-[calc(1.25rem+50px)]">
                <PulseBar className="mx-auto h-3.5 w-48 rounded-full sm:h-4 sm:w-56" />
                <div className="mt-3 space-y-3">
                  <PulseBar className="mx-auto h-6 w-full max-w-2xl" />
                  <PulseBar className="mx-auto h-6 w-[88%] max-w-xl" />
                  <PulseBar className="mx-auto h-6 w-[70%] max-w-lg" />
                </div>
              </div>
              <PulseBar className="min-h-36 w-full rounded-2xl" />
              <div className="mt-4 flex shrink-0 items-center justify-between gap-3">
                <PulseBar className="h-10 w-[7.5rem] rounded-xl" />
                <PulseBar className="h-10 w-28 rounded-xl" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-center sm:hidden">
          <div className="flex w-[5.5rem] flex-col gap-2">
            <PulseBar className="mx-auto h-2.5 w-14 rounded-sm" />
            <PulseBar className="mx-auto h-2.5 w-12 rounded-sm" />
            <div className="grid grid-cols-2 gap-1.5">
              {Array.from({ length: Math.min(gridCount, 6) }, (_, i) => (
                <PulseBar key={i} className="h-9 w-9 rounded-md" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="absolute right-0 top-0 hidden pt-1 sm:block">
        <div className="flex w-[5.5rem] flex-col gap-2 lg:w-[6rem]">
          <PulseBar className="mx-auto h-2.5 w-14 rounded-sm" />
          <PulseBar className="mx-auto h-2.5 w-12 rounded-sm" />
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: gridCount }, (_, i) => (
              <PulseBar key={i} className="h-9 w-9 rounded-md lg:h-10 lg:w-10" />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function AvailableQuestionsNav({
  total,
  current,
  answeredIndexes,
  onJump,
}: {
  total: number;
  current: number;
  answeredIndexes: Set<number>;
  onJump: (index: number) => void;
}) {
  return (
    <nav
      aria-label="Available questions"
      className="flex w-[5.5rem] shrink-0 flex-col gap-2 lg:w-[6rem]"
    >
      <p className="text-center text-[10px] font-black uppercase leading-tight tracking-[0.08em] text-[#1D3A62]/55">
        Available
        <span className="block">questions</span>
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {Array.from({ length: total }, (_, i) => {
          const answered = answeredIndexes.has(i);
          const active = i === current;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Question ${i + 1}${answered ? ', answered' : ''}${active ? ', current' : ''}`}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md border-2 text-sm font-black transition-colors duration-200 lg:h-10 lg:w-10 lg:text-base',
                active && 'border-[#1D3A62] bg-[#1D3A62] text-white',
                !active && answered && 'border-[var(--edunets-yellow)] bg-[var(--edunets-yellow)] text-[#1D3A62]',
                !active && !answered && 'border-[#1D3A62]/20 bg-white/90 text-[#1D3A62] hover:border-[#1D3A62]/45 hover:bg-[var(--edunets-yellow)]/50',
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Short plain stems stay centered; longer / image stems expand with justify. */
const SHORT_STEM_CHARS = 140;

function stemAlignForQuestion(question: {
  text: string;
  stemBlocks?: AssessmentSessionResponse['questions'][number]['stemBlocks'];
}): 'start' | 'center' {
  const blocks = question.stemBlocks;
  if (blocks?.some((block) => block.type === 'image')) return 'start';
  const plain = (blocks && blocks.length > 0
    ? blocks.map((block) => {
      if (block.type === 'text') return block.value;
      if (block.type === 'math') return block.latex;
      return '';
    }).join(' ')
    : question.text).trim();
  return plain.length <= SHORT_STEM_CHARS ? 'center' : 'start';
}

function QuestionNavButtons({
  canAdvance,
  busy,
  isFirst,
  isLast,
  mode,
  onPrevious,
  onAdvance,
}: {
  canAdvance: boolean;
  busy: boolean;
  isFirst: boolean;
  isLast: boolean;
  mode: AssessmentMode;
  onPrevious: () => void;
  onAdvance: () => void;
}) {
  return (
    <div className="mt-4 flex shrink-0 items-center justify-between gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isFirst || busy}
        onClick={onPrevious}
        className="h-10 shrink-0 rounded-xl border-[#1D3A62]/25 bg-white/80 px-4 text-sm font-bold text-[#1D3A62] hover:bg-white disabled:opacity-45"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Previous
      </Button>
      <Button
        disabled={!canAdvance || busy}
        onClick={onAdvance}
        className="h-10 shrink-0 rounded-xl bg-[#1D3A62] px-4 text-sm font-bold text-white hover:bg-[#1D3A62]/90 disabled:opacity-45"
      >
        {busy && <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />}
        {isLast ? (mode === 'essay' ? 'Finish & AI mark' : 'Finish') : 'Next'}
        <ArrowRight className="ml-1.5 h-4 w-4" />
      </Button>
    </div>
  );
}

function McqOptionBody({ text }: { text: string }) {
  // Table-mode bank options arrive as "col: value · col: value" — display as clean mini columns
  const parts = text.split(/\s·\s/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return (
      <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 py-0.5">
        {parts.map((part) => {
          const colon = part.indexOf(':');
          if (colon > 0 && colon < part.length - 1) {
            const heading = part.slice(0, colon).trim();
            const value = part.slice(colon + 1).trim();
            return (
              <div key={part} className="flex flex-col">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#1D3A62]/55">{heading}</span>
                <ExamKatexText text={value} className="text-inherit font-semibold text-base lg:text-lg" />
              </div>
            );
          }
          return <ExamKatexText key={part} text={part} className="text-inherit font-semibold" />;
        })}
      </div>
    );
  }
  return <ExamKatexText text={text} className="text-inherit font-semibold" />;
}

function QuestionPanel({
  session,
  index,
  answerText,
  answeredIndexes,
  busy,
  onAnswerText,
  onAdvance,
  onPrevious,
  onJump,
  onAbandon,
  abandoning,
}: {
  session: AssessmentSessionResponse;
  index: number;
  answerText: string;
  answeredIndexes: Set<number>;
  busy: boolean;
  onAnswerText: (value: string) => void;
  onAdvance: () => void;
  onPrevious: () => void;
  onJump: (index: number) => void;
  onAbandon: () => void;
  abandoning: boolean;
}) {
  const question = session.questions[index]!;
  const selectedOption = answerText === '' ? -1 : Number(answerText);
  const isFirst = index === 0;
  const isLast = index === session.questions.length - 1;
  const hasStructuredParts = Boolean(question.structuredParts && question.structuredParts.length > 0);
  const structuredAnswers: StructuredAnswersMap = hasStructuredParts
    ? parseStructuredAnswers(answerText)
    : {};
  const essayReady = hasStructuredParts
    ? structuredAnswersComplete(question.structuredParts, answerText)
    : answerText.trim().length > 0;
  const canAdvance = session.mode === 'mcq'
    ? answerText !== ''
    : essayReady;
  const stemAlign = stemAlignForQuestion(question);
  const topicLabel = question.subtopic
    ? `${question.subtopic.syllabusCode} · ${question.subtopic.name}`
    : question.topic;
  const modeLabel = session.mode === 'mcq' ? 'Multiple Choice Question' : 'Essay Question';

  return (
    <div className="relative flex w-full flex-1">
      <div className="mx-auto flex min-w-0 w-full max-w-[min(1200px,100%)] flex-1 flex-col px-2 sm:px-4 lg:pr-[7.75rem]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#1D3A62]/12 pb-3">
          <div className="min-w-0">
            <p className="truncate text-xl font-black tracking-tight text-[#1D3A62] lg:text-2xl">{topicLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden text-sm font-bold text-muted-foreground sm:inline">{session.session.answered}/{session.session.total} answered</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
              onClick={onAbandon}
              disabled={abandoning}
              aria-label="Abandon quiz"
              title="Abandon quiz"
            >
              {abandoning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="mt-2 h-1.5 shrink-0 overflow-hidden rounded-full bg-[#1D3A62]/10">
          <motion.div className="h-full rounded-full bg-[#1D3A62]" animate={{ width: `${((index + 1) / session.questions.length) * 100}%` }} transition={{ type: 'spring', stiffness: 200, damping: 26 }} />
        </div>

        <div className="mt-3 flex flex-1 flex-col sm:mt-4">
          {session.mode === 'mcq' ? (
            <div className="flex w-full flex-col justify-start gap-3 pb-6 lg:gap-4">
              <motion.div
                key={`stem-${question.questionKey}`}
                initial={{ opacity: 0, y: 8, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="mx-auto w-full shrink-0 rounded-2xl border border-white/80 bg-[#FBF5F5] px-6 py-6 shadow-[0_18px_48px_rgba(29,58,98,0.14)] sm:px-8 sm:py-8 lg:px-10"
              >
                <p className="text-center text-xs font-black uppercase tracking-[0.12em] text-[#1D3A62]/55 sm:text-sm">
                  {modeLabel} · Question {index + 1} of {session.questions.length}
                </p>
                <div className="mt-3 sm:mt-3.5">
                  <ExamQuestionStem
                    text={question.text}
                    stemBlocks={question.stemBlocks}
                    size="lg"
                    align={stemAlign}
                  />
                  {question.optionsImageUrl ? (
                    <ExamOptionsImage url={question.optionsImageUrl} />
                  ) : null}
                </div>
              </motion.div>
              <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5 lg:gap-4">
                {question.options?.map((option, optionIndex) => {
                  const selected = selectedOption === optionIndex;
                  const label = String.fromCharCode(65 + optionIndex);
                  const showOptionText = !question.optionsImageUrl;
                  return (
                    <motion.button
                      type="button"
                      key={`${label}-${option}`}
                      disabled={busy}
                      onClick={() => onAnswerText(String(optionIndex))}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                      aria-pressed={selected}
                      className={cn(
                        'group relative flex min-h-[5rem] items-center gap-4 overflow-hidden rounded-2xl border-2 px-5 py-4 text-left outline-none transition-all lg:min-h-[5.5rem] lg:gap-5 lg:px-6',
                        selected
                          ? 'border-[var(--edunets-dark-blue)] bg-[var(--edunets-yellow)] shadow-[0_12px_32px_rgba(255,227,143,0.55)]'
                          : 'border-transparent bg-white/75 hover:border-[var(--edunets-yellow)]/80 hover:bg-[var(--edunets-cream)] hover:shadow-[0_8px_22px_rgba(255,227,143,0.35)]',
                        busy && 'pointer-events-none opacity-60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-black tracking-wide transition-all duration-200 lg:h-11 lg:w-11 lg:text-lg',
                          selected
                            ? 'bg-[var(--edunets-dark-blue)] text-[var(--edunets-yellow)]'
                            : 'bg-[var(--edunets-yellow)]/55 text-[var(--edunets-dark-blue)] group-hover:bg-[var(--edunets-yellow)]',
                        )}
                      >
                        {label}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 flex-1 text-lg font-semibold leading-snug lg:text-xl',
                          'text-[var(--edunets-ink)]',
                        )}
                      >
                        {showOptionText
                          ? <McqOptionBody text={option} />
                          : <span className="text-muted-foreground">Option {label}</span>}
                      </span>
                      <span
                        className={cn(
                          'ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-all',
                          selected
                            ? 'border-[var(--edunets-dark-blue)] bg-[var(--edunets-dark-blue)] text-[var(--edunets-yellow)]'
                            : 'border-[#1D3A62]/15 bg-white/80 group-hover:border-[var(--edunets-dark-blue)]/40',
                        )}
                        aria-hidden
                      >
                        {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              <QuestionNavButtons
                canAdvance={canAdvance}
                busy={busy}
                isFirst={isFirst}
                isLast={isLast}
                mode={session.mode}
                onPrevious={onPrevious}
                onAdvance={onAdvance}
              />
            </div>
          ) : (
            <div className="flex w-full flex-col justify-start gap-3 pb-6">
              {hasStructuredParts ? (
                <motion.div
                  key={`stem-${question.questionKey}`}
                  initial={{ opacity: 0, y: 8, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="w-full rounded-2xl border border-white/80 bg-[#FBF5F5] px-6 py-5 shadow-[0_18px_48px_rgba(29,58,98,0.14)] lg:px-8 lg:py-6"
                >
                  <p className="mb-3 text-center text-xs font-black uppercase tracking-[0.12em] text-[#1D3A62]/55 sm:text-sm">
                    {modeLabel} · Question {index + 1} of {session.questions.length}
                  </p>
                  <ExamStructuredAnswerSheet
                    text={question.text}
                    stemBlocks={question.stemBlocks}
                    parts={question.structuredParts}
                    maxMarks={question.maxMarks}
                    answers={structuredAnswers}
                    disabled={busy}
                    onAnswersChange={(next) => onAnswerText(serializeStructuredAnswers(next))}
                  />
                </motion.div>
              ) : (
                <>
                  <motion.div
                    key={`stem-${question.questionKey}`}
                    initial={{ opacity: 0, y: 8, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    className="mx-auto w-full rounded-2xl border border-white/80 bg-[#FBF5F5] px-6 py-6 shadow-[0_18px_48px_rgba(29,58,98,0.14)] sm:px-8 sm:py-8"
                  >
                    <p className="text-center text-xs font-black uppercase tracking-[0.12em] text-[#1D3A62]/55 sm:text-sm">
                      {modeLabel} · Question {index + 1} of {session.questions.length}
                    </p>
                    <div className="mt-3">
                      <ExamQuestionStem text={question.text} stemBlocks={question.stemBlocks} size="lg" align={stemAlign} />
                    </div>
                  </motion.div>
                  <Textarea
                    value={answerText}
                    onChange={(event) => onAnswerText(event.target.value)}
                    disabled={busy}
                    rows={6}
                    placeholder="Write your Essay response..."
                    className="min-h-36 rounded-2xl border border-white/60 bg-white/60 px-5 text-base shadow-none lg:text-lg"
                  />
                </>
              )}
              <QuestionNavButtons
                canAdvance={canAdvance}
                busy={busy}
                isFirst={isFirst}
                isLast={isLast}
                mode={session.mode}
                onPrevious={onPrevious}
                onAdvance={onAdvance}
              />
            </div>
          )}
        </div>

        <div className="mt-3 flex justify-center sm:hidden">
          <AvailableQuestionsNav
            total={session.questions.length}
            current={index}
            answeredIndexes={answeredIndexes}
            onJump={onJump}
          />
        </div>
      </div>

      <aside className="sticky top-20 hidden h-fit shrink-0 pt-1 sm:block">
        <AvailableQuestionsNav
          total={session.questions.length}
          current={index}
          answeredIndexes={answeredIndexes}
          onJump={onJump}
        />
      </aside>
    </div>
  );
}

function formatMarkScheme(value: string | number): string {
  if (typeof value === 'number') return String(value);
  return value.trim();
}

/** Singapore O-Level style band from percentage. */
function oLevelGrade(percent: number): string {
  if (percent >= 75) return 'A1';
  if (percent >= 70) return 'A2';
  if (percent >= 65) return 'B3';
  if (percent >= 60) return 'B4';
  if (percent >= 55) return 'C5';
  if (percent >= 50) return 'C6';
  if (percent >= 45) return 'D7';
  if (percent >= 40) return 'E8';
  return 'F9';
}

function markCodeOf(point: EssayMarkPoint): EssayMarkCode {
  if (point.code === 'B' || point.code === 'M' || point.code === 'A') return point.code;
  const letter = point.id.trim().charAt(0).toUpperCase();
  if (letter === 'M' || letter === 'A' || letter === 'B') return letter;
  return 'B';
}

function markCodeLabel(code: EssayMarkCode): string {
  if (code === 'M') return 'Method';
  if (code === 'A') return 'Accuracy';
  return 'Independent';
}

function markCodeChipClass(code: EssayMarkCode, earned: boolean): string {
  if (!earned) return 'bg-[#1D3A62]/08 text-[#1D3A62]/55';
  if (code === 'M') return 'bg-amber-100 text-amber-900';
  if (code === 'A') return 'bg-emerald-100 text-emerald-900';
  return 'bg-[var(--edunets-yellow)]/80 text-[#1D3A62]';
}

function markCodeBadgeClass(code: EssayMarkCode): string {
  if (code === 'M') return 'bg-amber-700 text-white';
  if (code === 'A') return 'bg-emerald-700 text-white';
  return 'bg-[#1D3A62] text-white';
}

function essayVerdictLabel(answer: AssessmentSessionResponse['answers'][number]): string {
  const feedback = answer.gradingFeedback;
  const marks = answer.marksObtained ?? 0;
  const sense = feedback?.senseBonus?.awarded ?? 0;
  if (answer.isCorrect === true) return 'Full marks';
  if (marks <= 0) return 'No marks';
  if (sense > 0 && (feedback?.markPoints?.every((point) => !point.earned) ?? marks === sense)) {
    return 'Sense credit';
  }
  return 'Partial';
}

function MarkScoreHero({
  obtained,
  maximum,
  grade,
  compact = false,
}: {
  obtained: number;
  maximum: number;
  grade: string;
  compact?: boolean;
}) {
  const percent = maximum > 0 ? Math.min(100, (obtained / maximum) * 100) : 0;
  const radius = compact ? 52 : 54;
  const view = compact ? 128 : 128;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const segments = Math.max(1, Math.round(maximum));
  const cx = view / 2;

  return (
    <div
      className={cn(
        'relative mx-auto flex w-full flex-col items-center overflow-visible',
        compact
          ? 'h-full justify-center gap-4 rounded-[1.5rem] border border-white/90 bg-gradient-to-br from-white via-[#FFFDF8] to-[var(--edunets-yellow)]/35 px-4 py-5 shadow-[0_12px_32px_rgba(29,58,98,0.1),inset_0_1px_0_rgba(255,255,255,0.95)]'
          : 'max-w-md gap-3 rounded-3xl border border-[#1D3A62]/12 bg-gradient-to-br from-[#1D3A62]/[0.06] via-white to-[var(--edunets-yellow)]/30 px-5 py-6 shadow-[0_12px_36px_rgba(29,58,98,0.08)]',
      )}
    >
      {compact ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-3 h-10 rounded-full bg-gradient-to-r from-transparent via-white/90 to-transparent opacity-80"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 top-10 h-24 w-24 rounded-full bg-[var(--edunets-yellow)]/50 blur-2xl"
          />
        </>
      ) : null}

      <div className={cn('relative z-[1]', compact ? 'h-32 w-32' : 'h-36 w-36')}>
        <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${view} ${view}`} aria-hidden>
          <circle cx={cx} cy={cx} r={radius} fill="none" stroke="rgba(29,58,98,0.12)" strokeWidth={compact ? 9 : 10} />
          <motion.circle
            cx={cx}
            cy={cx}
            r={radius}
            fill="none"
            stroke="#1D3A62"
            strokeWidth={compact ? 9 : 10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="flex items-baseline gap-0.5 font-black tabular-nums text-[#1D3A62]">
            <span className={cn('leading-none', compact ? 'text-[2.15rem]' : 'text-4xl')}>{formatModelNumber(obtained)}</span>
            <span className="text-sm font-bold text-[#1D3A62]/55">/{formatModelNumber(maximum)}</span>
          </p>
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#1D3A62]/55">marks</p>
        </div>
      </div>

      <div className="relative z-[1] flex max-w-full flex-wrap items-center justify-center gap-1.5 px-1">
        {Array.from({ length: Math.min(segments, 12) }, (_, index) => {
          const filled = index < Math.floor(obtained) || (index < obtained && obtained % 1 !== 0 && index === Math.floor(obtained));
          const partial = !Number.isInteger(obtained) && index === Math.floor(obtained);
          return (
            <span
              key={`mark-seg-${index}`}
              className={cn(
                'h-2 rounded-full transition',
                compact ? 'w-3.5' : 'h-2.5 w-6',
                filled || partial ? 'bg-[var(--edunets-yellow)] shadow-[inset_0_0_0_1px_rgba(29,58,98,0.2)]' : 'bg-[#1D3A62]/12',
                partial && 'opacity-70',
              )}
              title={`Mark ${index + 1}`}
            />
          );
        })}
      </div>

      <div className="relative z-[1] flex w-full items-center justify-center px-1">
        <span className="inline-flex max-w-full items-center rounded-full bg-[#1D3A62] px-3 py-1 text-sm font-black text-[var(--edunets-yellow)]">
          Grade {grade}
          <span className="ml-1.5 font-semibold tabular-nums text-white/85">{Math.round(percent)}%</span>
        </span>
      </div>
    </div>
  );
}

function SchemeInkSentence({
  text,
  show,
  earned,
}: {
  text: string;
  show: boolean;
  earned: boolean;
}) {
  return (
    <RoughNotation
      type={earned ? 'highlight' : 'underline'}
      color={earned ? 'rgba(255, 227, 143, 0.85)' : 'rgba(244, 63, 94, 0.55)'}
      show={show}
      animate
      animationDuration={900}
      multiline
      padding={6}
      strokeWidth={earned ? 1 : 2}
      customElement="div"
    >
      <div className="rounded-lg px-1 py-0.5">
        <ExamKatexText
          text={text}
          className="text-sm font-semibold leading-relaxed !text-left text-[#1D3A62] whitespace-pre-wrap [&_p]:!text-left"
        />
      </div>
    </RoughNotation>
  );
}

function MarkSchemeInkPanel({
  questionKey,
  partKey,
  markPoints,
  fallbackText,
  schemeText,
}: {
  questionKey: string;
  partKey: string;
  markPoints: EssayMarkPoint[];
  fallbackText: string;
  schemeText: string;
}) {
  const points = markPoints.length > 0
    ? markPoints
    : fallbackText
      ? [{
          id: 'S1',
          code: 'B' as const,
          earned: true,
          marks: 0,
          dependsOn: null,
          partLabel: partKey || null,
          schemeSentence: fallbackText,
          analysis: '',
        }]
      : [];

  const [activeIndex, setActiveIndex] = useState(0);
  const [inked, setInked] = useState<Set<number>>(() => new Set());
  const safeIndex = Math.min(activeIndex, Math.max(0, points.length - 1));
  const active = points[safeIndex] ?? null;

  useEffect(() => {
    setActiveIndex(0);
    setInked(new Set());
  }, [questionKey, partKey, points.length]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      setInked((current) => {
        if (current.has(safeIndex)) return current;
        const next = new Set(current);
        next.add(safeIndex);
        return next;
      });
    }, 40);
    return () => window.clearTimeout(timer);
  }, [active, safeIndex]);

  if (points.length === 0) return null;

  const code = active ? markCodeOf(active) : 'B';
  const sentence = active?.schemeSentence.trim() || fallbackText;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {points.map((point, index) => {
          const selected = index === safeIndex;
          const seen = inked.has(index);
          return (
            <button
              key={`${questionKey}-${partKey}-ink-${point.id}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide transition',
                selected
                  ? point.earned
                    ? 'bg-[#1D3A62] text-[var(--edunets-yellow)] ring-2 ring-[#1D3A62]/20'
                    : 'bg-rose-600 text-white ring-2 ring-rose-200'
                  : point.earned
                    ? 'bg-[#1D3A62]/10 text-[#1D3A62] hover:bg-[#1D3A62]/15'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100',
                seen && !selected && 'opacity-80',
              )}
              aria-pressed={selected}
            >
              {point.earned ? <CheckCircle2 className="h-3 w-3" /> : <span aria-hidden>–</span>}
              {point.id}
            </button>
          );
        })}
      </div>

      {active ? (
        <motion.div
          key={`${questionKey}-${partKey}-active-${active.id}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="rounded-2xl border border-[#1D3A62]/10 bg-gradient-to-br from-white to-[#F7FAFF] px-3.5 py-3.5"
        >
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide',
                markCodeChipClass(code, active.earned),
              )}
            >
              {code} · {active.earned ? 'earned' : 'missed'}
            </span>
            <span className="text-[11px] font-semibold text-[#1D3A62]/45">
              {safeIndex + 1} / {points.length} · tap another code to ink it
            </span>
          </div>

          {sentence ? (
            <SchemeInkSentence
              text={sentence}
              show={inked.has(safeIndex)}
              earned={active.earned}
            />
          ) : null}

          {active.analysis ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {active.analysis}
            </p>
          ) : null}
        </motion.div>
      ) : null}

      {points.length > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-[#1D3A62]"
            disabled={safeIndex <= 0}
            onClick={() => setActiveIndex((value) => Math.max(0, value - 1))}
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Prev mark
          </Button>
          <div className="flex items-center gap-1">
            {points.map((point, index) => (
              <span
                key={`${questionKey}-${partKey}-dot-${point.id}`}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  index === safeIndex ? 'w-4 bg-[#1D3A62]' : inked.has(index) ? 'w-1.5 bg-[#1D3A62]/35' : 'w-1.5 bg-[#1D3A62]/15',
                )}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-[#1D3A62]"
            disabled={safeIndex >= points.length - 1}
            onClick={() => setActiveIndex((value) => Math.min(points.length - 1, value + 1))}
          >
            Next mark
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}

      {schemeText && schemeText !== fallbackText && schemeText !== sentence ? (
        <details className="rounded-xl border border-[#1D3A62]/08 bg-white/70 px-3 py-2">
          <summary className="cursor-pointer list-none text-[11px] font-bold text-[#1D3A62]/70 [&::-webkit-details-marker]:hidden">
            Full bank scheme
          </summary>
          <div className="mt-2">
            <ExamKatexText
              text={schemeText}
              className="text-sm font-medium leading-relaxed !text-left whitespace-pre-wrap [&_p]:!text-left"
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function EssayMarkingOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FBF5F5]/95 px-6 text-center backdrop-blur-[2px]">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1D3A62]/10">
        <LoaderCircle className="h-7 w-7 animate-spin text-[#1D3A62]" />
      </span>
      <p className="mt-4 text-lg font-black text-[#1D3A62]">Checking against the marking scheme…</p>
      <div className="mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-[#1D3A62]/10">
        <motion.div
          className="h-full w-2/5 rounded-full bg-gradient-to-r from-[#1D3A62]/35 via-[#1D3A62] to-[#1D3A62]/35"
          initial={{ x: '-120%' }}
          animate={{ x: '280%' }}
          transition={{ duration: 1.35, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Marked point by point · usually 5–15 seconds</p>
    </div>
  );
}

function normalizePartKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/^(?:part\s+)/i, '')
    .replace(/^[(\[]|[)\]]$/g, '');
}

/** Split bank guide lines like `(a) [1 mark] …` into a map keyed by part label. */
function parseSchemeByPart(scheme: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!scheme.trim()) return map;

  const lines = scheme.split(/\n/);
  let current: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!current) return;
    const text = buffer.join('\n').trim();
    if (text) map.set(current, text);
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const match = /^\(([a-zA-Z0-9.ivx]+)\)\s*(?:\[\d+\s*marks?\]\s*)?(.*)$/i.exec(line.trim());
    if (match) {
      flush();
      current = normalizePartKey(match[1]!);
      buffer = match[2] ? [match[2]] : [];
      continue;
    }
    if (current) buffer.push(line);
  }
  flush();

  if (map.size === 0 && scheme.trim()) {
    map.set('', scheme.trim());
  }
  return map;
}

function flattenStructuredParts(
  parts: AssessmentSessionResponse['questions'][number]['structuredParts'],
): Array<{ label: string; marks: number | null; prompt: string }> {
  if (!parts?.length) return [];
  const out: Array<{ label: string; marks: number | null; prompt: string }> = [];
  const walk = (nodes: NonNullable<typeof parts>) => {
    for (const node of nodes) {
      out.push({ label: node.label, marks: node.marks, prompt: node.prompt });
      if (node.children?.length) walk(node.children);
    }
  };
  walk(parts);
  return out;
}

function partVerdictMeta(verdict: EssayPartFeedback['verdict'] | 'pending') {
  if (verdict === 'correct') {
    return {
      label: 'Correct',
      className: 'bg-emerald-100 text-emerald-800',
      Icon: CheckCircle2,
    };
  }
  if (verdict === 'partial') {
    return {
      label: 'Partial',
      className: 'bg-amber-100 text-amber-900',
      Icon: Sparkles,
    };
  }
  if (verdict === 'sense') {
    return {
      label: 'Sense credit',
      className: 'bg-[#1D3A62]/10 text-[#1D3A62]',
      Icon: Brain,
    };
  }
  if (verdict === 'incorrect') {
    return {
      label: 'Incorrect',
      className: 'bg-rose-100 text-rose-800',
      Icon: XCircle,
    };
  }
  return {
    label: 'Marked',
    className: 'bg-[#1D3A62]/10 text-[#1D3A62]',
    Icon: Sparkles,
  };
}

type ReviewPartRow = {
  key: string;
  displayLabel: string;
  prompt: string | null;
  maxMarks: number | null;
  studentText: string;
  studentImage: string | null;
  schemeText: string;
  /** Model answer the student can aim for (from scheme sentences / bank guide). */
  correctAnswerText: string;
  verdict: EssayPartFeedback['verdict'] | 'pending';
  marksObtained: number | null;
  explanation: string;
  markPoints: EssayMarkPoint[];
};

function EssayPartReview({
  questionKey,
  part,
}: {
  questionKey: string;
  part: ReviewPartRow;
}) {
  const [schemeOpen, setSchemeOpen] = useState(false);
  const verdict = partVerdictMeta(part.verdict);
  const VerdictIcon = verdict.Icon;
  const hasScheme = Boolean(part.schemeText) || Boolean(part.correctAnswerText) || part.markPoints.length > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#1D3A62]/12 bg-[#FBF8F4]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1D3A62]/10 bg-white/70 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-[#1D3A62] px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">
            Part {part.displayLabel}
          </span>
          {part.maxMarks != null ? (
            <span className="text-[11px] font-semibold text-[#1D3A62]/55">
              {formatModelNumber(part.maxMarks)} mark{part.maxMarks === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
        {part.marksObtained != null && part.maxMarks != null ? (
          <span className="text-sm font-black tabular-nums text-[#1D3A62]">
            {formatModelNumber(part.marksObtained)}/{formatModelNumber(part.maxMarks)}
          </span>
        ) : null}
      </header>

      <div className="space-y-3 px-3 py-3">
        {part.prompt ? (
          <p className="text-[12px] leading-snug text-muted-foreground">{part.prompt}</p>
        ) : null}

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#1D3A62]/55">
            Your answer
          </p>
          <div className="mt-1.5 rounded-xl border border-[#1D3A62]/10 bg-white px-3 py-2.5">
            {part.studentText ? (
              <ExamKatexText
                text={part.studentText}
                className="text-sm leading-relaxed !text-left [&_p]:!text-left"
              />
            ) : (
              <p className="text-sm italic text-muted-foreground">No written answer</p>
            )}
            {part.studentImage ? (
              <details className="mt-2 group">
                <summary className="cursor-pointer list-none text-[11px] font-bold text-[#1D3A62]/70 [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Your sketch — tap to expand
                  </span>
                </summary>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={part.studentImage}
                  alt={`Your sketch for part ${part.displayLabel}`}
                  className="mt-2 max-h-48 w-full rounded-md border border-border object-contain"
                />
              </details>
            ) : null}
          </div>
        </div>

        {hasScheme ? (
          <div
            className={cn(
              'rounded-xl px-2.5 py-2 transition',
              schemeOpen
                ? 'border border-[#1D3A62]/12 bg-white'
                : 'border border-dashed border-[#1D3A62]/25 bg-[#F7FAFF] hover:border-[#1D3A62]/40 hover:bg-[#EEF4FF]',
            )}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 text-left"
              onClick={() => setSchemeOpen((value) => !value)}
              aria-expanded={schemeOpen}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-black text-[#1D3A62]">
                  {schemeOpen ? <EyeOff className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0" />}
                  {schemeOpen ? 'Hide mark scheme' : 'Reveal mark scheme'}
                </span>
                {!schemeOpen ? (
                  <span className="pl-6 text-[11px] font-medium text-[#1D3A62]/65">
                    Ink each mark point — earned vs missed
                  </span>
                ) : null}
              </span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-[#1D3A62]/55 transition', schemeOpen && 'rotate-180')} />
            </button>

            {schemeOpen ? (
              <div className="mt-3 space-y-3 border-t border-[#1D3A62]/10 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black',
                    verdict.className,
                  )}
                  >
                    <VerdictIcon className="h-3.5 w-3.5" />
                    {verdict.label}
                  </span>
                  {part.marksObtained != null ? (
                    <span className="text-sm font-black tabular-nums text-[#1D3A62]">
                      {part.marksObtained > 0 ? '+' : ''}
                      {formatModelNumber(part.marksObtained)}
                      {part.maxMarks != null ? ` / ${formatModelNumber(part.maxMarks)}` : ''} points
                    </span>
                  ) : null}
                </div>

                <MarkSchemeInkPanel
                  questionKey={questionKey}
                  partKey={part.key}
                  markPoints={part.markPoints}
                  fallbackText={part.correctAnswerText || part.schemeText}
                  schemeText={part.schemeText}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EssayReviewCard({
  questionIndex,
  question,
  answer,
  attachSlot,
}: {
  questionIndex: number;
  question: AssessmentSessionResponse['questions'][number];
  answer: AssessmentSessionResponse['answers'][number];
  /** Optional slot for a future single attachment action (one photo / file per question). */
  attachSlot?: ReactNode;
}) {
  const obtained = answer.marksObtained ?? 0;
  const maximum = answer.maximumMarks ?? question.maxMarks ?? 0;
  const scheme = formatMarkScheme(answer.correctAnswer);
  const schemeByPart = parseSchemeByPart(scheme);
  const studentMap = typeof answer.submittedAnswer === 'string'
    ? parseStructuredAnswers(answer.submittedAnswer)
    : {};
  const feedback = answer.gradingFeedback ?? null;
  const markPoints = feedback?.markPoints ?? [];
  const senseBonus = feedback?.senseBonus;
  const label = essayVerdictLabel(answer);
  const structuredFlat = flattenStructuredParts(question.structuredParts);
  const stemImageCount = (question.stemBlocks ?? []).filter((block) => block.type === 'image').length;
  const [figuresOpen, setFiguresOpen] = useState(stemImageCount > 0);

  const reviewParts = (() => {
    const order: string[] = [];
    const seen = new Set<string>();
    const push = (raw: string) => {
      const key = normalizePartKey(raw);
      if (!key || seen.has(key)) return;
      seen.add(key);
      order.push(key);
    };

    for (const part of structuredFlat) push(part.label);
    for (const key of Object.keys(studentMap)) push(key);
    for (const part of feedback?.parts ?? []) push(part.label);

    if (order.length === 0) order.push('');

    return order.map((key): ReviewPartRow => {
      const meta = structuredFlat.find((part) => normalizePartKey(part.label) === key);
      const studentEntry = Object.entries(studentMap).find(
        ([labelKey]) => normalizePartKey(labelKey) === key,
      );
      const partFeedback = (feedback?.parts ?? []).find(
        (entry) => normalizePartKey(entry.label) === key,
      );
      const partMarks = markPoints.filter((point) => {
        if (!point.partLabel) return order.length === 1;
        return normalizePartKey(point.partLabel) === key;
      });
      const schemeText = key
        ? (schemeByPart.get(key) || (schemeByPart.size <= 1 ? scheme : ''))
        : scheme;
      const fromMarkPoints = partMarks
        .map((point) => point.schemeSentence.trim())
        .filter(Boolean);
      const correctAnswerText = fromMarkPoints.length > 0
        ? Array.from(new Set(fromMarkPoints)).join('\n')
        : schemeText;

      let verdict: ReviewPartRow['verdict'] = partFeedback?.verdict ?? 'pending';
      let marksObtained = partFeedback?.marksObtained ?? null;
      let maxMarks = partFeedback?.maximumMarks ?? meta?.marks ?? null;

      if (marksObtained == null && partMarks.length > 0) {
        marksObtained = partMarks.reduce((sum, point) => sum + (point.earned ? point.marks : 0), 0);
      }
      if (maxMarks == null && partMarks.length > 0) {
        maxMarks = partMarks.reduce((sum, point) => sum + point.marks, 0);
      }
      if (verdict === 'pending' && marksObtained != null && maxMarks != null) {
        if (marksObtained <= 0) verdict = 'incorrect';
        else if (marksObtained >= maxMarks) verdict = 'correct';
        else verdict = 'partial';
      }

      return {
        key: key || 'answer',
        displayLabel: meta?.label || studentEntry?.[0] || partFeedback?.label || (key || 'answer'),
        prompt: meta?.prompt || null,
        maxMarks,
        studentText: studentEntry?.[1]?.text?.trim() || '',
        studentImage: studentEntry?.[1]?.imageDataUrl || null,
        schemeText,
        correctAnswerText,
        verdict,
        marksObtained,
        explanation: partFeedback?.feedback || '',
        markPoints: partMarks,
      };
    });
  })();

  const orphanMarks = markPoints.filter((point) => {
    if (!point.partLabel) return reviewParts.length > 1;
    return !reviewParts.some((part) => normalizePartKey(point.partLabel || '') === normalizePartKey(part.key));
  });

  return (
    <article className="w-full overflow-hidden rounded-3xl border border-[#1D3A62]/12 bg-white shadow-[0_8px_24px_rgba(29,58,98,0.06)]">
      <header className="flex w-full items-center gap-3 border-b border-[#1D3A62]/10 bg-white px-5 py-5 sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1D3A62]/10 text-sm font-black text-[#1D3A62]">
          Q{questionIndex + 1}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          <Badge className="shrink-0 bg-[#1D3A62]/10 text-[#1D3A62]">{label}</Badge>
          <span className="shrink-0 whitespace-nowrap text-sm font-black tabular-nums text-[#1D3A62]">
            {formatModelNumber(obtained)}/{formatModelNumber(maximum)}
          </span>
          <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
            {reviewParts.length} part{reviewParts.length === 1 ? '' : 's'}
          </span>
        </div>
        {attachSlot ? <div className="shrink-0">{attachSlot}</div> : null}
      </header>

      <div className="w-full space-y-4 px-5 py-5 sm:px-6">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#1D3A62]/55">
              Question
            </p>
            {stemImageCount > 0 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#1D3A62]/70"
                onClick={() => setFiguresOpen((value) => !value)}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                {figuresOpen ? 'Hide figures' : `Show figures (${stemImageCount})`}
              </button>
            ) : null}
          </div>
          <div className="mt-2">
            {figuresOpen || stemImageCount === 0 ? (
              <ExamQuestionStem
                text={question.text}
                stemBlocks={question.stemBlocks}
                size="md"
                align="start"
              />
            ) : (
              <ExamKatexText
                text={question.text}
                className="text-sm font-medium leading-relaxed !text-left [&_p]:!text-left"
              />
            )}
          </div>
        </div>

        {feedback?.summary ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{feedback.summary}</p>
        ) : null}

        <div className="space-y-3">
          {reviewParts.map((part) => (
            <EssayPartReview
              key={`${question.questionKey}-part-${part.key}`}
              questionKey={question.questionKey}
              part={part}
            />
          ))}
        </div>

        {orphanMarks.length > 0 ? (
          <div className="rounded-2xl border border-[#1D3A62]/10 bg-white px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#1D3A62]/55">
              Other scheme points
            </p>
            <ul className="mt-2 space-y-2">
              {orphanMarks.map((point) => (
                <li key={`${question.questionKey}-orphan-${point.id}`} className="text-sm text-muted-foreground">
                  <span className="font-black text-[#1D3A62]">{point.id}</span>
                  {point.earned ? ' ✓' : ' ·'}
                  {' — '}
                  {point.analysis}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {senseBonus && senseBonus.awarded > 0 ? (
          <div className="rounded-2xl border border-[#1D3A62]/15 bg-gradient-to-r from-[#1D3A62]/5 to-[var(--edunets-yellow)]/30 px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#1D3A62]">
              Sense credit · +{formatModelNumber(senseBonus.awarded)}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[#1D3A62]/85">
              {senseBonus.reason || 'Relevant O-Level reasoning even though scheme points were missed.'}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function EssayQuestionNavGrid({
  session,
  activeIndex,
  onSelect,
}: {
  session: AssessmentSessionResponse;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {session.questions.map((question, questionIndex) => {
        const answer = session.answers.find((entry) => entry.questionIndex === questionIndex);
        const obtained = answer?.marksObtained ?? 0;
        const maximum = answer?.maximumMarks ?? question.maxMarks ?? 0;
        const ratio = maximum > 0 ? obtained / maximum : 0;
        const active = questionIndex === activeIndex;
        const tone = !answer
          ? 'border-[#1D3A62]/20 bg-transparent text-[#1D3A62]/45'
          : ratio >= 1
            ? 'border-emerald-300/80 bg-emerald-50/80 text-emerald-800'
            : ratio <= 0
              ? 'border-rose-200/80 bg-rose-50/70 text-rose-800'
              : 'border-amber-200/80 bg-amber-50/70 text-amber-900';
        return (
          <button
            key={question.questionKey}
            type="button"
            onClick={() => onSelect(questionIndex)}
            className={cn(
              // border-2 always — active must NOT use outer ring/shadow (parent overflow clips it)
              'flex h-11 min-w-[3.25rem] flex-col items-center justify-center rounded-2xl border-2 px-2.5 text-[11px] font-black transition',
              active
                ? 'border-[#1D3A62] bg-[#1D3A62]/10 text-[#1D3A62]'
                : cn(tone, 'hover:border-[#1D3A62]/45'),
            )}
            aria-current={active ? 'true' : undefined}
            title={`Question ${questionIndex + 1}`}
          >
            <span>Q{questionIndex + 1}</span>
            {answer ? (
              <span className="text-[9px] font-semibold tabular-nums opacity-80">
                {formatModelNumber(obtained)}/{formatModelNumber(maximum)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ExaminerCodeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#1D3A62]/45">Codes</span>
      {([
        { code: 'B' as const, blurb: 'Independent' },
        { code: 'M' as const, blurb: 'Method' },
        { code: 'A' as const, blurb: 'Accuracy' },
      ]).map((item) => (
        <span key={item.code} className="inline-flex items-center gap-1.5">
          <span className={cn(
            'rounded px-1 py-0.5 text-[10px] font-black',
            markCodeBadgeClass(item.code),
          )}
          >
            {item.code}
          </span>
          {item.blurb}
        </span>
      ))}
    </div>
  );
}

function EssayResultsPanel({
  session,
  busy,
  obtained,
  maximum,
  grade,
  calculation,
  modeMemory,
  conceptScore,
  reminder,
  color,
  onCompleteFeedback,
  onRetake,
  onConceptWeb,
}: {
  session: AssessmentSessionResponse;
  busy: boolean;
  obtained: number;
  maximum: number;
  grade: string;
  calculation: NonNullable<AssessmentSessionResponse['model']['calculation']>;
  modeMemory: AssessmentSessionResponse['concept']['modes'][AssessmentMode] | null | undefined;
  conceptScore: number | null;
  reminder: string;
  color: { background: string };
  onCompleteFeedback: () => void;
  onRetake: () => void;
  onConceptWeb: () => void;
}) {
  const navigate = useNavigate();
  const [reviewIndex, setReviewIndex] = useState(0);
  const { data: fetchedRecap, isLoading: recapLoading } = useQuery({
    queryKey: ['quiz-recap', session.submissionId],
    queryFn: () => getQuizRecap(session.submissionId),
    enabled: Boolean(session.submissionId && !session.recap),
    staleTime: Infinity,
  });
  const activeRecap = (session.recap && (session.recap.items?.length > 0 || session.recap.summary))
    ? session.recap
    : (fetchedRecap && (fetchedRecap.items?.length > 0 || fetchedRecap.summary))
      ? fetchedRecap
      : extractRecapFromSession(session);
  const total = session.questions.length;
  const safeIndex = Math.min(Math.max(0, reviewIndex), Math.max(0, total - 1));
  const question = session.questions[safeIndex];
  const answer = session.answers.find((entry) => entry.questionIndex === safeIndex) ?? null;
  const remaining = Math.max(0, total - safeIndex - 1);

  return (
    <div className="relative isolate grid w-full gap-6 max-lg:auto-rows-auto lg:grid-cols-[minmax(280px,0.34fr)_minmax(0,0.66fr)] lg:gap-8 xl:gap-10">
      {/* Summary rail */}
      <aside className="relative z-0 min-w-0 lg:sticky lg:top-20 lg:h-fit">
        <div className="relative flex flex-col overflow-hidden rounded-[2rem] border border-[#1D3A62]/10 bg-gradient-to-b from-white via-[#FFFCF7] to-[var(--edunets-yellow)]/25 shadow-[0_18px_48px_rgba(29,58,98,0.08)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#1D3A62]/[0.06] blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-[var(--edunets-yellow)]/40 blur-2xl"
          />

          <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-x-visible p-5 sm:p-6">
            <div className="shrink-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1D3A62]/45">
                {session.feedbackStatus === 'completed' ? 'Corrections done' : 'Essay marked'}
              </p>
              <h2 className="mt-1 text-[1.75rem] font-black leading-tight tracking-tight text-[#1D3A62]">
                Your result
              </h2>
              <p className="mt-2 text-sm text-[#1D3A62]/65">
                Reviewing Q{safeIndex + 1}
                {remaining > 0
                  ? ` · ${remaining} more to go`
                  : total > 1
                    ? ' · last question'
                    : ''}
              </p>
            </div>

            <div className="min-h-[200px] min-w-0 flex-1 overflow-visible">
              <MarkScoreHero obtained={obtained} maximum={maximum} grade={grade} compact />
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2">
              {[
                ['Mastery', formatModelPercent(calculation.currentMastery)],
                ['Mode', modeMemory ? formatPercentageValue(modeMemory.memoryScore) : '—'],
                ['Concept', conceptScore === null ? '—' : formatPercentageValue(conceptScore)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[#1D3A62]/08 bg-white/75 px-2.5 py-3 text-center"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#1D3A62]/40">{label}</p>
                  <p className="mt-1 text-sm font-black tabular-nums text-[#1D3A62]">{value}</p>
                </div>
              ))}
            </div>

            <div
              className="shrink-0 rounded-2xl border border-[#1D3A62]/08 px-3.5 py-3"
              style={{ backgroundColor: color.background }}
            >
              <div className="flex gap-2.5">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                <p className="text-sm font-semibold leading-snug text-[#1D3A62]">
                  {reminder}
                  <span className="font-normal text-[#1D3A62]/70">
                    {' '}· start with {session.concept.recommendedMode?.toUpperCase() ?? 'ESSAY'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <p className="text-center text-xs font-semibold text-[#1D3A62]/75">
                Copy and paste to revise on Revision Hub
              </p>
              <Button
                type="button"
                className="h-11 w-full rounded-full bg-[#1D3A62] text-white hover:bg-[#1D3A62]/90 font-bold shadow-sm"
                onClick={() => {
                  if (activeRecap) {
                    try {
                      sessionStorage.setItem('edunets_quiz_recap_revision', JSON.stringify(activeRecap));
                    } catch {}
                  }
                  const query = new URLSearchParams();
                  const targetSubject = activeRecap?.subjectId || session.subjectId;
                  const targetTopic = activeRecap?.topicName || session.topicId;
                  if (targetSubject) query.set('subject', targetSubject);
                  if (targetTopic) query.set('topic', targetTopic);
                  navigate(query.toString() ? `/capture-hub?${query.toString()}` : '/capture-hub');
                }}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Revision Hub
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" className="h-10 flex-1 rounded-full text-[#1D3A62]" onClick={onRetake}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  New
                </Button>
                <Button type="button" variant="ghost" className="h-10 flex-1 rounded-full text-[#1D3A62]" onClick={onConceptWeb}>
                  Concept Web
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Question review */}
      <section className="relative z-10 min-w-0 space-y-5 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1D3A62]/45">
              Review
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Question {safeIndex + 1} of {total}
            </p>
          </div>
          <ExaminerCodeLegend />
        </div>

        <EssayQuestionNavGrid
          session={session}
          activeIndex={safeIndex}
          onSelect={setReviewIndex}
        />

        {question && answer ? (
          <EssayReviewCard
            key={question.questionKey}
            questionIndex={safeIndex}
            question={question}
            answer={answer}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-[#1D3A62]/20 px-4 py-6 text-center text-sm text-muted-foreground">
            No answer recorded for this question.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={safeIndex <= 0}
            onClick={() => setReviewIndex((value) => Math.max(0, value - 1))}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#1D3A62] text-white hover:bg-[#1D3A62]/90"
            disabled={safeIndex >= total - 1}
            onClick={() => setReviewIndex((value) => Math.min(total - 1, value + 1))}
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <QuizRecapCard
          recap={activeRecap}
          session={session}
          loading={recapLoading && !activeRecap}
          onJumpToQuestion={setReviewIndex}
        />
      </section>
    </div>
  );
}

function McqReviewCard({
  question,
  questionIndex,
  answer,
}: {
  question: AssessmentSessionResponse['questions'][number];
  questionIndex: number;
  answer: NonNullable<AssessmentSessionResponse['answers'][number]>;
}) {
  return (
    <div
      className={cn(
        'floaty-card group flex flex-col gap-2 rounded-2xl border p-5 text-sm transition-all hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(29,58,98,0.12)]',
        answer.isCorrect ? 'border-emerald-200/60 bg-emerald-50/40' : 'border-rose-200/60 bg-rose-50/40'
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-transform group-hover:scale-110',
            answer.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'
          )}
        >
          {answer.isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-[#1D3A62]">Q{questionIndex + 1}.</p>
          <div className="mt-1">
            <ExamKatexText text={question.text} className="leading-relaxed text-[#1D3A62]/90" />
          </div>

          {question.options && question.options.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {question.options.map((opt, i) => {
                const isSelected = answer.submittedAnswer === i;
                const isCorrect = answer.correctAnswer === i;

                let ringClass = 'border-transparent bg-[#1D3A62]/[0.03] text-[#1D3A62]/70';
                if (isSelected && isCorrect) {
                  ringClass = 'border-emerald-500/50 bg-emerald-50 text-emerald-900 shadow-sm';
                } else if (isSelected && !isCorrect) {
                  ringClass = 'border-rose-400/50 bg-rose-50 text-rose-900 shadow-sm';
                } else if (isCorrect) {
                  ringClass = 'border-emerald-500/50 bg-emerald-50 text-emerald-900';
                }

                return (
                  <div key={i} className={cn("relative flex items-center gap-3 rounded-xl border p-3 text-sm transition-all", ringClass)}>
                    <div className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      isSelected || isCorrect ? (isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white') : 'bg-[#1D3A62]/10 text-[#1D3A62]'
                    )}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <div className="flex-1 min-w-0 pr-16">
                      <ExamKatexText text={opt} />
                    </div>
                    {isSelected && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-wider opacity-60">
                        You Chose
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultsPanel({ session, busy, onCompleteFeedback, onRetake, onConceptWeb }: {
  session: AssessmentSessionResponse;
  busy: boolean;
  onCompleteFeedback: () => void;
  onRetake: () => void;
  onConceptWeb: () => void;
}) {
  const navigate = useNavigate();
  const [reviewIndex, setReviewIndex] = useState(0);
  const { data: fetchedRecap, isLoading: recapLoading } = useQuery({
    queryKey: ['quiz-recap', session.submissionId],
    queryFn: () => getQuizRecap(session.submissionId),
    enabled: Boolean(session.submissionId && !session.recap),
    staleTime: Infinity,
  });
  const activeRecap = (session.recap && (session.recap.items?.length > 0 || session.recap.summary))
    ? session.recap
    : (fetchedRecap && (fetchedRecap.items?.length > 0 || fetchedRecap.summary))
      ? fetchedRecap
      : extractRecapFromSession(session);
  const calculation = session.model.calculation!;
  const conceptScore = session.concept.conceptMemoryScore;
  const modeMemory = session.concept.modes[session.mode];
  const color = getKnowledgeScoreColor(conceptScore);
  const days = session.concept.nextReviewAt
    ? Math.max(0, Math.ceil((new Date(session.concept.nextReviewAt).getTime() - Date.now()) / 86_400_000))
    : 0;
  const reminder = session.concept.reviewNow || days === 0 ? 'Review today' : days === 1 ? 'Review tomorrow' : `Review in ${days} days`;

  const obtained = session.mode === 'mcq'
    ? session.session.correct
    : session.session.marksObtained;
  const maximum = session.mode === 'mcq'
    ? session.session.total
    : session.session.maximumMarks;
  const percent = maximum > 0 ? (obtained / maximum) * 100 : 0;
  const grade = oLevelGrade(percent);

  if (session.mode === 'essay') {
    return (
      <EssayResultsPanel
        session={session}
        busy={busy}
        obtained={obtained}
        maximum={maximum}
        grade={grade}
        calculation={calculation}
        modeMemory={modeMemory}
        conceptScore={conceptScore}
        reminder={reminder}
        color={color}
        onCompleteFeedback={onCompleteFeedback}
        onRetake={onRetake}
        onConceptWeb={onConceptWeb}
      />
    );
  }

  const total = session.questions.length;
  const safeIndex = Math.min(Math.max(0, reviewIndex), Math.max(0, total - 1));
  const question = session.questions[safeIndex];
  const answer = session.answers.find((entry) => entry.questionIndex === safeIndex) ?? null;
  const remaining = Math.max(0, total - safeIndex - 1);

  return (
    <div className="relative isolate grid w-full gap-6 max-lg:auto-rows-auto lg:grid-cols-[minmax(280px,0.34fr)_minmax(0,0.66fr)] lg:gap-8 xl:gap-10">
      <aside className="relative z-0 min-w-0 lg:sticky lg:top-20 lg:h-fit">
        <div className="relative flex flex-col overflow-hidden rounded-[2rem] border border-[#1D3A62]/10 bg-gradient-to-b from-white via-[#FFFCF7] to-[var(--edunets-yellow)]/25 shadow-[0_18px_48px_rgba(29,58,98,0.08)]">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#1D3A62]/[0.06] blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-[var(--edunets-yellow)]/40 blur-2xl" />

          <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-x-visible p-5 sm:p-6">
            <div className="shrink-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1D3A62]/45">
                {session.feedbackStatus === 'completed' ? 'Corrections done' : 'Assessment complete'}
              </p>
              <h2 className="mt-1 text-[1.75rem] font-black leading-tight tracking-tight text-[#1D3A62]">
                MCQ result
              </h2>
              <p className="mt-2 text-sm text-[#1D3A62]/65">
                Reviewing Q{safeIndex + 1}
                {remaining > 0
                  ? ` · ${remaining} more to go`
                  : total > 1
                    ? ' · last question'
                    : ''}
              </p>
            </div>

            <div className="min-h-[200px] min-w-0 flex-1 overflow-visible">
              <MarkScoreHero obtained={obtained} maximum={maximum} grade={grade} compact />
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2">
              {[
                ['Mastery', formatModelPercent(calculation.currentMastery)],
                ['Mode', modeMemory ? formatPercentageValue(modeMemory.memoryScore) : '—'],
                ['Concept', conceptScore === null ? '—' : formatPercentageValue(conceptScore)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[#1D3A62]/08 bg-white/75 px-2.5 py-3 text-center">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#1D3A62]/40">{label}</p>
                  <p className="mt-1 text-sm font-black tabular-nums text-[#1D3A62]">{value}</p>
                </div>
              ))}
            </div>

            <div className="shrink-0 rounded-2xl border border-[#1D3A62]/08 px-3.5 py-3" style={{ backgroundColor: color.background }}>
              <div className="flex gap-2.5">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
                <p className="text-sm font-semibold leading-snug text-[#1D3A62]">
                  {reminder}
                  <span className="font-normal text-[#1D3A62]/70">
                    {' '}· start with {session.concept.recommendedMode?.toUpperCase() ?? session.mode.toUpperCase()}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <p className="text-center text-xs font-semibold text-[#1D3A62]/75">
                Copy and paste to revise on Revision Hub
              </p>
              <Button
                type="button"
                className="h-11 w-full rounded-full bg-[#1D3A62] text-white hover:bg-[#1D3A62]/90 font-bold shadow-sm"
                onClick={() => {
                  if (activeRecap) {
                    try {
                      sessionStorage.setItem('edunets_quiz_recap_revision', JSON.stringify(activeRecap));
                    } catch {}
                  }
                  const query = new URLSearchParams();
                  const targetSubject = activeRecap?.subjectId || session.subjectId;
                  const targetTopic = activeRecap?.topicName || session.topicId;
                  if (targetSubject) query.set('subject', targetSubject);
                  if (targetTopic) query.set('topic', targetTopic);
                  navigate(query.toString() ? `/capture-hub?${query.toString()}` : '/capture-hub');
                }}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Revision Hub
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" className="h-10 flex-1 rounded-full text-[#1D3A62]" onClick={onRetake}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  New
                </Button>
                <Button type="button" variant="ghost" className="h-10 flex-1 rounded-full text-[#1D3A62]" onClick={onConceptWeb}>
                  Concept Web
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <section className="relative z-10 min-w-0 space-y-5 pb-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1D3A62]/45">
            Review
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Question {safeIndex + 1} of {total}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {session.questions.map((q, qIndex) => {
            const a = session.answers.find((entry) => entry.questionIndex === qIndex);
            const active = qIndex === safeIndex;
            const tone = !a
              ? 'border-[#1D3A62]/20 bg-transparent text-[#1D3A62]/45'
              : a.isCorrect
                ? 'border-emerald-300/80 bg-emerald-50/80 text-emerald-800'
                : 'border-rose-200/80 bg-rose-50/70 text-rose-800';
            return (
              <button
                key={q.questionKey}
                type="button"
                onClick={() => setReviewIndex(qIndex)}
                className={cn(
                  'flex h-9 min-w-[2.5rem] items-center justify-center rounded-xl border-2 px-2.5 text-[11px] font-black transition',
                  active
                    ? 'border-[#1D3A62] bg-[#1D3A62]/10 text-[#1D3A62]'
                    : cn(tone, 'hover:border-[#1D3A62]/45'),
                )}
                aria-current={active ? 'true' : undefined}
                title={`Question ${qIndex + 1}`}
              >
                Q{qIndex + 1}
              </button>
            );
          })}
        </div>

        {question && answer ? (
          <McqReviewCard
            key={question.questionKey}
            question={question}
            questionIndex={safeIndex}
            answer={answer}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-[#1D3A62]/20 px-4 py-6 text-center text-sm text-muted-foreground">
            No answer recorded for this question.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={safeIndex <= 0}
            onClick={() => setReviewIndex((value) => Math.max(0, value - 1))}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#1D3A62] text-white hover:bg-[#1D3A62]/90"
            disabled={safeIndex >= total - 1}
            onClick={() => setReviewIndex((value) => Math.min(total - 1, value + 1))}
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <QuizRecapCard
          recap={activeRecap}
          session={session}
          loading={recapLoading && !activeRecap}
          onJumpToQuestion={setReviewIndex}
        />
      </section>
    </div>
  );
}


export default function QuizPage() {
  const { data: account } = useCurrentAccount();
  return isTeachingRole(account?.profile?.role) ? <TeacherQuizReview /> : <StudentQuizPage />;
}

const QUIZ_PROGRESS_STORAGE_KEY = 'edunets_smart_quiz_progress';

type StoredQuizProgress = {
  submissionId: string;
  session: AssessmentSessionResponse | null;
  state: QuizState;
  index: number;
  answerDrafts: Record<number, string>;
  answerText: string;
  subjectName: string;
  topicId: string;
  subtopicId: string;
  mode: AssessmentMode;
  introDone: boolean;
  activeRescueId: string | null;
};

function getStoredQuizProgress(): StoredQuizProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(QUIZ_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredQuizProgress;
    if (parsed && parsed.session && parsed.session.status !== 'abandoned') {
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function StudentQuizPage() {
  const { notify } = useMascotFeedback();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subjects] = useAtom(subjectsAtom);
  const [, setRescueLogs] = useAtom(rescueNudgeLogsAtom);
  const autoStarted = useRef(false);

  // Lazy initialize from sessionStorage if an active quiz exists
  const [initialProgress] = useState(() => getStoredQuizProgress());

  const [subjectName, setSubjectName] = useState(() => initialProgress?.subjectName ?? '');
  const [topicId, setTopicId] = useState(() => initialProgress?.topicId ?? '');
  const [subtopicId, setSubtopicId] = useState(() => initialProgress?.subtopicId ?? '');
  const [mode, setMode] = useState<AssessmentMode>(() => initialProgress?.mode ?? 'mcq');
  const [state, setState] = useState<QuizState>(() => initialProgress?.state ?? 'setup');
  const [session, setSession] = useState<AssessmentSessionResponse | null>(() => initialProgress?.session ?? null);
  const [index, setIndex] = useState(() => initialProgress?.index ?? 0);
  const [answerText, setAnswerText] = useState(() => initialProgress?.answerText ?? '');
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>(() => initialProgress?.answerDrafts ?? {});
  const [busy, setBusy] = useState(false);
  const [marking, setMarking] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [activeRescueId, setActiveRescueId] = useState<string | null>(() => initialProgress?.activeRescueId ?? null);
  // Deep links (e.g. a rescue nudge) jump straight into an active session, so
  // the hype intro would only get in the way — skip it for those.
  const [introDone, setIntroDone] = useState(() => initialProgress?.introDone ?? Boolean(
    searchParams.get('subject') && searchParams.get('topic'),
  ));

  const subject = subjects.find((entry) => entry.name === subjectName);

  // Keep active progress saved in sessionStorage so moving between features never loses work
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (session && state !== 'setup') {
      const data: StoredQuizProgress = {
        submissionId: session.submissionId,
        session,
        state,
        index,
        answerDrafts,
        answerText,
        subjectName,
        topicId,
        subtopicId,
        mode,
        introDone,
        activeRescueId,
      };
      sessionStorage.setItem(QUIZ_PROGRESS_STORAGE_KEY, JSON.stringify(data));
    } else if (state === 'setup' && !session) {
      sessionStorage.removeItem(QUIZ_PROGRESS_STORAGE_KEY);
    }
  }, [session, state, index, answerDrafts, answerText, subjectName, topicId, subtopicId, mode, introDone, activeRescueId]);

  const activate = useCallback(async (selectedTopicId: string, selectedMode: AssessmentMode, selectedSubtopicId: string) => {
    setBusy(true);
    try {
      const response = await generateQuizSet({
        submissionId: crypto.randomUUID(),
        topicId: selectedTopicId,
        mode: selectedMode,
        ...(selectedSubtopicId ? { subtopicId: selectedSubtopicId } : {}),
      });
      setSession(response);
      setMode(response.mode);
      setTopicId(response.topicId);
      const startIndex = response.status === 'completed'
        ? response.questions.length - 1
        : Math.min(response.session.answered, response.questions.length - 1);
      setIndex(startIndex);
      const drafts: Record<number, string> = {};
      for (const answer of response.answers) {
        drafts[answer.questionIndex] = String(answer.submittedAnswer);
      }
      setAnswerDrafts(drafts);
      setAnswerText(drafts[startIndex] ?? '');
      setState(response.status === 'completed' ? 'results' : 'active');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Assessment could not be loaded.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    const requestedSubject = searchParams.get('subject');
    const requestedTopic = searchParams.get('topic');
    if (!requestedSubject || !requestedTopic || autoStarted.current) return;
    const resolvedTopic = resolveCurriculumTopic(requestedTopic);
    const matchedSubject = subjects.find((entry) => (
      entry.name.toLowerCase() === requestedSubject.toLowerCase()
      || entry.id.toLowerCase() === requestedSubject.toLowerCase()
    )) ?? subjects.find((entry) => entry.topics.some((topic) => topic.id === resolvedTopic?.id));
    const matchedTopic = matchedSubject?.topics.find((entry) => (
      entry.id === requestedTopic
      || entry.name.toLowerCase() === requestedTopic.toLowerCase()
      || entry.id === resolvedTopic?.id
    ));
    if (!matchedSubject || !matchedTopic) return;
    const requestedMode: AssessmentMode = searchParams.get('mode') === 'essay' ? 'essay' : (matchedTopic.recommendedMode ?? 'mcq');

    // If we already have a restored active session for this topic and mode, keep it!
    if (session && session.topicId === matchedTopic.id && session.mode === requestedMode && session.status !== 'abandoned') {
      autoStarted.current = true;
      setSearchParams(new URLSearchParams(), { replace: true });
      return;
    }

    autoStarted.current = true;
    // Flip busy immediately so "Quiz me on this" shows the session shimmer
    // before the network round-trip returns — YouTube-style handoff.
    setBusy(true);
    setSubjectName(matchedSubject.name); setTopicId(matchedTopic.id); setMode(requestedMode);
    setActiveRescueId(searchParams.get('rescueId'));
    setSearchParams(new URLSearchParams(), { replace: true });
    void activate(matchedTopic.id, requestedMode, '');
  }, [activate, searchParams, setSearchParams, session, subjects]);

  const restoreAnswerForIndex = useCallback((targetIndex: number, drafts: Record<number, string>, nextSession: AssessmentSessionResponse | null) => {
    if (drafts[targetIndex] !== undefined) return drafts[targetIndex]!;
    const saved = nextSession?.answers.find((entry) => entry.questionIndex === targetIndex);
    return saved ? String(saved.submittedAnswer) : '';
  }, []);

  /** Save the current answer to the server without leaving the question (no full-page busy). */
  const persistAnswerSilent = useCallback(async (
    questionIndex: number,
    text: string,
    currentSession: AssessmentSessionResponse,
  ): Promise<AssessmentSessionResponse> => {
    if (text === '') return currentSession;
    const nextAnswer = currentSession.mode === 'mcq' ? Number(text) : text;
    if (currentSession.mode === 'mcq' && Number.isNaN(nextAnswer as number)) return currentSession;
    const existing = currentSession.answers.find((entry) => entry.questionIndex === questionIndex);
    if (existing !== undefined && String(existing.submittedAnswer) === String(nextAnswer)) {
      return currentSession;
    }
    const response = await submitAssessmentAnswer(currentSession.submissionId, {
      questionKey: currentSession.questions[questionIndex]!.questionKey,
      questionIndex,
      answer: nextAnswer,
      ...(currentSession.mode === 'essay' ? { marksObtained: 0 } : {}),
    });
    setSession(response);
    return response;
  }, []);

  const updateAnswerText = useCallback((value: string) => {
    setAnswerText(value);
    setAnswerDrafts((prev) => ({ ...prev, [index]: value }));
  }, [index]);

  /** MCQ: update draft and immediately persist so free jumps keep the answer. */
  const selectMcqAnswer = useCallback(async (value: string) => {
    setAnswerText(value);
    setAnswerDrafts((prev) => ({ ...prev, [index]: value }));
    if (!session) return;
    try {
      await persistAnswerSilent(index, value, session);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Answer could not be saved.');
    }
  }, [index, persistAnswerSilent, session]);

  const jumpTo = useCallback(async (targetIndex: number) => {
    if (!session || targetIndex === index || targetIndex < 0 || targetIndex >= session.questions.length) return;
    let nextSession = session;
    try {
      nextSession = await persistAnswerSilent(index, answerText, session);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Answer could not be saved.');
      return;
    }
    setAnswerDrafts((prev) => {
      const next = { ...prev, [index]: answerText };
      setAnswerText(restoreAnswerForIndex(targetIndex, next, nextSession));
      return next;
    });
    setIndex(targetIndex);
  }, [answerText, index, persistAnswerSilent, restoreAnswerForIndex, session]);

  const goPrevious = useCallback(() => {
    void jumpTo(index - 1);
  }, [index, jumpTo]);

  // Submitting an answer and moving on used to be two separate steps (Submit,
  // read the reveal, then Next) — now it's one "Next question" click that
  // submits silently and advances immediately; correctness is only shown in
  // the results recap, never mid-quiz.
  const advance = async () => {
    if (!session) return;
    const existing = session.answers.find((entry) => entry.questionIndex === index);
    const nextAnswer = session.mode === 'mcq' ? Number(answerText) : answerText;
    const unchanged = existing !== undefined && String(existing.submittedAnswer) === String(nextAnswer);
    const isLast = index === session.questions.length - 1;

    // Already submitted this answer — jump locally without a network round-trip.
    if (unchanged && !isLast) {
      const nextIndex = index + 1;
      setAnswerDrafts((prev) => {
        const next = { ...prev, [index]: answerText };
        setAnswerText(restoreAnswerForIndex(nextIndex, next, session));
        return next;
      });
      setIndex(nextIndex);
      return;
    }

    setBusy(true);
    try {
      const response = await submitAssessmentAnswer(session.submissionId, {
        questionKey: session.questions[index]!.questionKey,
        questionIndex: index,
        answer: nextAnswer,
        // Self-mark UI removed — API still requires marksObtained for essay.
        ...(session.mode === 'essay' ? { marksObtained: 0 } : {}),
      });
      setSession(response);
      setAnswerDrafts((prev) => ({ ...prev, [index]: answerText }));
      if (!isLast) {
        const nextIndex = index + 1;
        setIndex(nextIndex);
        setAnswerText(restoreAnswerForIndex(nextIndex, { ...answerDrafts, [index]: answerText }, response));
        return;
      }
      if (session.mode === 'essay') setMarking(true);
      const finished = await finishAssessment(response.submissionId);
      setSession(finished); setState('results');
      await queryClient.invalidateQueries({ queryKey: ['study-state'] });
      notify({ type: 'quizFinished', score: finished.mode === 'mcq' ? finished.session.correct : finished.session.marksObtained, total: finished.mode === 'mcq' ? finished.session.total : finished.session.maximumMarks });
      if (finished.mode === 'essay') {
        toast.success('Marked against the answer key.');
      }
      if (activeRescueId) {
        setRescueLogs((logs: RescueNudgeLog[]) => logs.map((log) => log.id === activeRescueId ? { ...log, pendingRescue: false, rescueStatus: 'completed', resolvedAt: Date.now() } : log));
        setActiveRescueId(null);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Answer could not be saved.'); }
    finally { setMarking(false); setBusy(false); }
  };

  const answeredIndexes = (() => {
    const set = new Set<number>();
    for (const entry of session?.answers ?? []) set.add(entry.questionIndex);
    for (const [key, value] of Object.entries(answerDrafts)) {
      if (value !== '') set.add(Number(key));
    }
    if (answerText !== '') set.add(index);
    return set;
  })();

  const onPanelAnswerText = session?.mode === 'mcq'
    ? (value: string) => { void selectMcqAnswer(value); }
    : updateAnswerText;

  const completeFeedback = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const completed = await completeAssessmentFeedback(session.submissionId);
      setSession(completed);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(QUIZ_PROGRESS_STORAGE_KEY);
      }
      await queryClient.invalidateQueries({ queryKey: ['study-state'] });
      toast.success('Corrections completed. Your learning progress has been updated.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Corrections could not be completed.'); }
    finally { setBusy(false); }
  };

  const abandon = async () => {
    if (!session) return;
    setAbandoning(true);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(QUIZ_PROGRESS_STORAGE_KEY);
      }
      await abandonAssessment(session.submissionId);
      setSession(null); setAnswerDrafts({}); setAnswerText(''); setIndex(0); setState('setup');
    }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Assessment could not be abandoned.'); }
    finally { setAbandoning(false); }
  };

  const retake = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(QUIZ_PROGRESS_STORAGE_KEY);
    }
    setSession(null); setAnswerDrafts({}); setAnswerText(''); setIndex(0); setState('setup');
  };
  const conceptWeb = () => navigate(`/concept-web?${new URLSearchParams({ subject: subject?.id ?? '', topic: topicId }).toString()}`);

  const whitecardFrame = 'w-[min(1180px,94vw)]';
  const whitecardSurface =
    'relative flex min-h-[520px] flex-col overflow-hidden border-0 bg-[#FBF5F5] shadow-[0_24px_60px_rgba(29,58,98,0.14)] rounded-[clamp(1.75rem,6vw,72px)]';
  const inQuizStage = state === 'active' || state === 'results' || marking || (busy && (state === 'setup' || state === 'active'));

  if (!inQuizStage) {
    return (
      <div className="pattern-overlay flex min-h-[calc(100dvh-4.25rem)] items-start justify-center px-4 pb-12 pt-5 sm:px-5 sm:pt-6 lg:px-8 lg:pt-7">
        <div className={whitecardFrame}>
          <Card className={`${whitecardSurface}`}>
            <CardContent className="flex flex-col p-6 sm:p-8 lg:px-12 lg:py-9">
              <SetupPanel
                subjectName={subjectName}
                topicId={topicId}
                subtopicId={subtopicId}
                mode={mode}
                loading={busy}
                onSubject={(value) => { setSubjectName(value); setTopicId(''); setSubtopicId(''); }}
                onTopic={(value) => { setTopicId(value); setSubtopicId(''); }}
                onSubtopic={setSubtopicId}
                onMode={setMode}
                onStart={() => void activate(topicId, mode, subtopicId)}
              />
            </CardContent>
            {!introDone && <QuizIntro onComplete={() => setIntroDone(true)} />}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="pattern-overlay min-h-[calc(100dvh-4.25rem)] max-lg:min-h-[calc(100dvh-4.25rem-5.5rem)] pb-12">
      <div className={`mx-auto flex w-full flex-col px-3 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-4 ${state === 'results' ? 'max-w-[min(1560px,98vw)]' : 'max-w-[min(1480px,100vw)]'}`}>
        <AnimatePresence mode="wait">
          {marking && (
            <motion.div
              key="essay-marking"
              className="relative flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-[28px] border border-neutral-200 bg-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <EssayMarkingOverlay />
            </motion.div>
          )}

          {busy && !marking && (state === 'setup' || state === 'active') && (
            <motion.div
              key="session-loading"
              className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <QuestionSessionSkeleton mode={mode} total={session?.questions.length ?? (mode === 'essay' ? 5 : 10)} />
            </motion.div>
          )}

          {state === 'active' && session && !busy && !marking && (
            <motion.div
              key={`question-${index}`}
              className="flex w-full flex-1 flex-col"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
            >
              <QuestionPanel
                session={session}
                index={index}
                answerText={answerText}
                answeredIndexes={answeredIndexes}
                busy={busy}
                onAnswerText={onPanelAnswerText}
                onAdvance={() => void advance()}
                onPrevious={goPrevious}
                onJump={(target) => { void jumpTo(target); }}
                onAbandon={() => void abandon()}
                abandoning={abandoning}
              />
            </motion.div>
          )}

          {state === 'results' && session && (
            <motion.div
              key="results"
              className="flex w-full flex-1 flex-col pb-8"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              <div className="w-full">
                <ResultsPanel session={session} busy={busy} onCompleteFeedback={() => void completeFeedback()} onRetake={retake} onConceptWeb={conceptWeb} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
