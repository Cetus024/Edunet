'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { AlertCircle, ArrowRight, BookOpen, Check, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { formatStudentFacingText } from '@/lib/study-notes';

type EvaluationNextStepsProps = {
  percentage?: number;
  summary: string;
  improvements: string[];
  incorrect?: { point: string; quote: string; correction: string }[];
  correct?: { point: string; quote: string }[];
  missing?: string[];
  onGoToSmartQuiz?: () => void;
  topicName?: string;
  subjectName?: string;
};

function cheerForProgress(done: number, total: number): string {
  if (total === 0) return 'You are already in a strong place — keep going.';
  if (done === 0) return 'Tick each tip as you try it. Small steps still count.';
  if (done >= total) return 'Amazing — you worked through every tip. Proud of you!';
  if (done >= Math.ceil(total / 2)) return 'Nice momentum — you are halfway there.';
  return 'Great start — keep ticking as you go.';
}

export function EvaluationNextSteps({
  summary,
  improvements,
  incorrect = [],
  correct = [],
  missing = [],
  onGoToSmartQuiz,
  topicName,
  subjectName,
}: EvaluationNextStepsProps) {
  const steps = useMemo(
    () => improvements.map((step) => formatStudentFacingText(step)).filter(Boolean),
    [improvements],
  );
  const [checked, setChecked] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setChecked(new Set());
  }, [steps.join('\0')]);

  const done = checked.size;
  const total = steps.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Feedback Overview */}
      <div className="flex items-start gap-3.5 rounded-2xl border border-[#6486B5]/25 bg-[#6486B5]/10 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#6486B5] text-white shadow-xs">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-black uppercase tracking-wider text-[#6486B5]">Feedback</h4>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-studynow-dark">
            {formatStudentFacingText(summary)}
          </p>
        </div>
      </div>

      {/* Where in your notes to improve (specific quotes and corrections) */}
      {incorrect.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-black uppercase tracking-wide text-amber-800">
              Where your notes can be improved ({incorrect.length})
            </p>
          </div>
          <div className="space-y-2">
            {incorrect.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-amber-300/80 bg-amber-50/70 p-3.5 text-xs shadow-2xs space-y-2"
              >
                {item.quote ? (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                      In your notes:
                    </span>
                    <blockquote className="mt-1 rounded-lg border-l-3 border-amber-500 bg-amber-100/70 py-1.5 px-3 font-medium italic text-amber-950">
                      &ldquo;{item.quote}&rdquo;
                    </blockquote>
                  </div>
                ) : null}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                    How to improve:
                  </span>
                  <p className="mt-0.5 text-xs font-semibold leading-relaxed text-studynow-dark">
                    {formatStudentFacingText(item.correction || item.point)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing topics/concepts from syllabus */}
      {missing.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/15 text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
              Key concepts to add to notes ({missing.length})
            </p>
          </div>
          <ul className="space-y-1.5 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            {missing.map((gap, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span className="leading-snug">{formatStudentFacingText(gap)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What the student's notes got right */}
      {correct.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700">
              <Check className="h-3.5 w-3.5" />
            </span>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-800">
              What your notes got right ({correct.length})
            </p>
          </div>
          <div className="space-y-1.5">
            {correct.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-900"
              >
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{item.point}</p>
                  {item.quote && (
                    <p className="mt-0.5 text-[11px] italic text-emerald-800/80">
                      Matched: &ldquo;{item.quote}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {total > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#6486B5]">
              <Sparkles className="h-3.5 w-3.5" />
              Your next steps
            </p>
            <span className="text-xs text-muted-foreground">
              {done}/{total} done
            </span>
          </div>
          <Progress value={progress} className="h-2 bg-[#6486B5]/15" />
          <p className="text-xs font-medium text-muted-foreground">{cheerForProgress(done, total)}</p>
          <ul className="space-y-2">
            {steps.map((step, index) => {
              const isDone = checked.has(index);
              return (
                <motion.li
                  key={`${index}-${step.slice(0, 24)}`}
                  layout
                  className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                    isDone
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-[#6486B5]/30 bg-[#6486B5]/5'
                  }`}
                >
                  <Checkbox
                    checked={isDone}
                    onCheckedChange={() => toggle(index)}
                    className="mt-0.5 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                    aria-label={`Mark done: ${step}`}
                  />
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    className={`flex-1 text-left text-sm leading-relaxed ${
                      isDone ? 'text-emerald-900 line-through decoration-emerald-600/60' : 'text-studynow-dark'
                    }`}
                  >
                    {step}
                  </button>
                  {isDone && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
                </motion.li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          You are covering this topic well — keep practising so it stays fresh.
        </p>
      )}

      {/* Spidey's Suggestion: Test knowledge again in Smart Quiz */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-[#EAA93C]/40 bg-gradient-to-br from-[#EAA93C]/10 via-[#6486B5]/10 to-amber-500/5 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-[#EAA93C]/30 p-1">
              <Image
                src="/branding/spidey-chat-avatar.png"
                alt="Spidey"
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#EAA93C] text-[10px] font-black text-white shadow-xs">
              AI
            </span>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#6486B5]">Spidey suggests</span>
              <span className="inline-flex items-center rounded-full bg-[#EAA93C]/20 px-2 py-0.5 text-[10px] font-bold text-[#b47a1f]">
                Smart Quiz
              </span>
            </div>
            <p className="text-sm font-semibold leading-relaxed text-studynow-dark">
              {topicName
                ? `You've checked where your notes can be improved on ${topicName}. Now test your knowledge again with real exam questions in Smart Quiz!`
                : "Now that you've reviewed where your notes can be improved, test your knowledge again in Smart Quiz to lock in what you've learned!"}
            </p>
            {onGoToSmartQuiz && (
              <div className="pt-1">
                <Button
                  type="button"
                  onClick={onGoToSmartQuiz}
                  className="w-full sm:w-auto h-11 rounded-xl bg-[#EAA93C] hover:bg-[#EAA93C]/90 text-studynow-dark font-bold text-sm px-6 shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Back to Smart Quiz
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
