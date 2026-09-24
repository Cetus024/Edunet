'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Sparkles } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { formatStudentFacingText } from '@/lib/study-notes';

type EvaluationNextStepsProps = {
  percentage: number;
  summary: string;
  improvements: string[];
};

function cheerForProgress(done: number, total: number): string {
  if (total === 0) return 'You are already in a strong place — keep going.';
  if (done === 0) return 'Tick each tip as you try it. Small steps still count.';
  if (done >= total) return 'Amazing — you worked through every tip. Proud of you!';
  if (done >= Math.ceil(total / 2)) return 'Nice momentum — you are halfway there.';
  return 'Great start — keep ticking as you go.';
}

export function EvaluationNextSteps({
  percentage,
  summary,
  improvements,
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
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-[#6486B5] text-lg font-black text-[#6486B5]">
          {percentage}%
        </div>
        <p className="text-sm font-semibold leading-snug text-studynow-dark">
          {formatStudentFacingText(summary)}
        </p>
      </div>

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
    </div>
  );
}
