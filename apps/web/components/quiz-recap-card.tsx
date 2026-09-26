'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import {
  Sparkles,
  Copy,
  Check,
  LoaderCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  extractRecapFromSession,
  cleanWhereWrongPhrasing,
  type QuizRecap,
  type AssessmentSessionResponse,
} from '@/lib/api/quiz';

export function QuizRecapCard({
  recap,
  session,
  loading = false,
}: {
  recap?: QuizRecap | null | undefined;
  session?: AssessmentSessionResponse | null | undefined;
  loading?: boolean;
  onJumpToQuestion?: (questionIndex: number) => void;
  onReviseAtRevisionHub?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // Automatically extract recap from session if backend recap is missing or empty
  const activeRecap = (recap && (recap.items?.length > 0 || recap.summary))
    ? recap
    : session
      ? extractRecapFromSession(session)
      : recap;

  if (loading && !activeRecap) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-[#1D3A62]/15 bg-gradient-to-br from-white via-[#FFFDF7] to-[var(--edunets-yellow)]/20 p-6 shadow-[0_12px_32px_rgba(29,58,98,0.06)]">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 shrink-0 animate-pulse overflow-hidden rounded-2xl bg-[#FFE38F]/60 p-1">
            <Image
              src="/branding/spidey-chat-avatar.png"
              alt="Spidey Mascot"
              width={48}
              height={48}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin text-[#1D3A62]" />
              <p className="text-sm font-black text-[#1D3A62]">
                Spidey is generating your Quiz Recap...
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Analyzing how you performed and preparing your overall revision recap.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!activeRecap) return null;

  const isMcq = activeRecap.mode === 'mcq';
  const hasWrong = activeRecap.wrongCount > 0 && activeRecap.items.length > 0;

  // Build the cohesive, copyable overall recap summary text
  const copyableSummaryText = activeRecap.typedNotesText || [
    `Quiz Recap Summary · ${activeRecap.topicName}`,
    activeRecap.mode === 'essay' && activeRecap.totalMarksObtained != null && activeRecap.totalMaximumMarks != null
      ? `Score: ${activeRecap.totalMarksObtained}/${activeRecap.totalMaximumMarks} marks`
      : `Score: ${activeRecap.correctCount}/${activeRecap.totalQuestions}`,
    '',
    activeRecap.summary,
    '',
    hasWrong
      ? `Things Scored Wrongly & Concepts to Revise:\n` +
        activeRecap.items.map((it) => `• ${it.concept}: ${cleanWhereWrongPhrasing(it.whereWrongOrMisconception)}\n  Take note: ${it.takeNoteOf}`).join('\n\n')
      : `All questions answered correctly! Full conceptual mastery demonstrated.`,
    '',
    activeRecap.keyTakeaways && activeRecap.keyTakeaways.length > 0
      ? `Key Takeaways to Remember:\n` + activeRecap.keyTakeaways.map((t) => `• ${t}`).join('\n')
      : '',
  ].filter(Boolean).join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyableSummaryText);
      setCopied(true);
      toast.success('Recap summary copied! Paste it into Revision Hub to get focus guidance.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy to clipboard. Please copy manually.');
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative w-full overflow-hidden rounded-3xl border border-[#1D3A62]/15 bg-gradient-to-br from-white via-[#FFFDF7] to-[var(--edunets-yellow)]/15 shadow-[0_14px_40px_rgba(29,58,98,0.07)]"
    >
      {/* Ambient background decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#FFE38F]/30 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-[#1D3A62]/5 blur-2xl"
      />

      {/* Header bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#1D3A62]/10 bg-white/70 px-5 py-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#FFE38F] p-1 shadow-sm">
            <Image
              src="/branding/spidey-chat-avatar.png"
              alt="Spidey"
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#1D3A62]">
                Spidey&apos;s Quiz Recap
              </span>
              <Badge
                variant="outline"
                className="gap-1 border-[#1D3A62]/20 bg-[#1D3A62]/5 text-[10px] font-bold text-[#1D3A62]"
              >
                <Sparkles className="h-3 w-3 text-[#1D3A62]" />
                Gemini Analysis
              </Badge>
              <Badge
                className={cn(
                  'text-[10px] font-bold',
                  hasWrong
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                )}
              >
                {isMcq ? (
                  hasWrong
                    ? `${activeRecap.wrongCount} Question${activeRecap.wrongCount === 1 ? '' : 's'} to Revise`
                    : 'All 10 Correct · 100%'
                ) : (
                  hasWrong
                    ? `${activeRecap.wrongCount} Question${activeRecap.wrongCount === 1 ? '' : 's'} with Lost Marks`
                    : 'Full Marks Awarded'
                )}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Overall recap summary of what to revise
            </p>
          </div>
        </div>
      </div>

      {/* Main Spidey explanation bubble */}
      <div className="relative z-10 px-5 pt-4 sm:px-6">
        <div className="relative rounded-2xl border-2 border-[#1D3A62]/15 bg-white/95 p-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFE38F] text-sm font-black shadow-xs">
              🕷️
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[11px] font-black uppercase tracking-wider text-[#1D3A62]/60">
                Spidey&apos;s Performance Analysis
              </p>
              <p className="text-sm font-bold leading-relaxed text-[#1D3A62]">
                {activeRecap.summary}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Recap Summary of things scored wrongly (copyable) */}
      <div className="relative z-10 px-5 pt-3 pb-6 sm:px-6">
        <div className="rounded-2xl border-2 border-[#1D3A62]/15 bg-white p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1D3A62]/10 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1D3A62] text-xs text-white">
                📋
              </span>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-[#1D3A62]">
                  Overall Recap Summary
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {hasWrong ? 'Summary of things scored wrongly across this quiz' : 'Full marks performance recap'}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className={cn(
                'h-8 rounded-xl font-bold text-xs gap-1.5 transition-all shadow-xs',
                copied
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-[#1D3A62]/25 text-[#1D3A62] hover:bg-[#1D3A62]/10'
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-[#1D3A62]" />
                  Copy Recap Summary
                </>
              )}
            </Button>
          </div>

          {/* Formatted summary text area */}
          <div className="rounded-xl border border-[#1D3A62]/10 bg-[#FFFCF7] p-3.5 text-xs text-[#1D3A62] space-y-2.5 leading-relaxed">
            {hasWrong ? (
              <div className="space-y-2.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-rose-800">
                  Things Scored Wrongly & Concepts to Revise:
                </p>
                <div className="space-y-2">
                  {activeRecap.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-white p-3 border border-[#1D3A62]/10 space-y-1 shadow-2xs"
                    >
                      <div className="flex items-center gap-2 font-bold text-xs text-[#1D3A62]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 text-[10px] font-black text-amber-900">
                          {idx + 1}
                        </span>
                        <span>{it.concept}</span>
                      </div>
                      <p className="text-xs text-rose-950 pl-7 font-medium">
                        {cleanWhereWrongPhrasing(it.whereWrongOrMisconception)}
                      </p>
                      <p className="text-xs text-amber-950 font-semibold pl-7 bg-amber-50/70 rounded-md py-1 px-2 border border-amber-200/60 mt-1">
                        📌 <span className="font-bold">Take note:</span> {it.takeNoteOf}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50/80 p-3.5 text-emerald-900 text-xs">
                <strong className="block font-bold text-sm">Perfect Score! 🌟</strong>
                <p className="mt-1 opacity-90">
                  Zero mistakes found across all questions. You have mastered all tested learning objectives on this topic!
                </p>
              </div>
            )}

            {activeRecap.keyTakeaways && activeRecap.keyTakeaways.length > 0 && (
              <div className="pt-2 border-t border-[#1D3A62]/10">
                <p className="text-[11px] font-black uppercase tracking-wider text-[#1D3A62]/70 mb-1">
                  Key Rules to Remember:
                </p>
                <ul className="space-y-1">
                  {activeRecap.keyTakeaways.map((takeaway, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-xs text-[#1D3A62]/85">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#1D3A62] shrink-0" />
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
