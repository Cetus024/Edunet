'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Copy,
  Check,
  LoaderCircle,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  extractRecapFromSession,
  type QuizRecap,
  type AssessmentSessionResponse,
} from '@/lib/api/quiz';

export function QuizRecapDialog({
  open,
  onOpenChange,
  recap,
  session,
  loading = false,
  onReviseAtRevisionHub,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recap?: QuizRecap | null | undefined;
  session?: AssessmentSessionResponse | null | undefined;
  loading?: boolean;
  onReviseAtRevisionHub?: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  // Automatically extract all questions/concepts the student scored wrongly from the session
  // if backend recap is not yet loaded, failed, or has empty items.
  const activeRecap = (recap && (recap.items?.length > 0 || recap.summary))
    ? recap
    : session
      ? extractRecapFromSession(session)
      : recap;

  const hasWrong = Boolean(activeRecap && activeRecap.wrongCount > 0 && activeRecap.items.length > 0);

  // Formatted copyable text
  const copyableSummaryText = activeRecap
    ? activeRecap.typedNotesText || [
        `Quiz Recap Summary · ${activeRecap.topicName}`,
        activeRecap.mode === 'essay' && activeRecap.totalMarksObtained != null && activeRecap.totalMaximumMarks != null
          ? `Score: ${activeRecap.totalMarksObtained}/${activeRecap.totalMaximumMarks} marks`
          : `Score: ${activeRecap.correctCount}/${activeRecap.totalQuestions}`,
        '',
        activeRecap.summary,
        '',
        hasWrong
          ? `Things Scored Wrongly & Concepts to Revise:\n` +
            activeRecap.items
              .map(
                (it) =>
                  `• Q${it.questionNumber} (${it.concept}): ${it.whereWrongOrMisconception}\n  Take note: ${it.takeNoteOf}`
              )
              .join('\n\n')
          : `All questions answered correctly! Full conceptual mastery demonstrated.`,
        '',
        activeRecap.keyTakeaways && activeRecap.keyTakeaways.length > 0
          ? `Key Rules to Remember:\n` + activeRecap.keyTakeaways.map((t) => `• ${t}`).join('\n')
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const handleCopy = async () => {
    if (!copyableSummaryText) return;
    try {
      await navigator.clipboard.writeText(copyableSummaryText);
      setCopied(true);
      toast.success('Recap summary copied! Paste it into Revision Hub to get focus guidance.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy to clipboard. Please copy manually.');
    }
  };

  const handleRevise = () => {
    if (!activeRecap) return;
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('edunets_quiz_recap_revision', JSON.stringify(activeRecap));
        navigator.clipboard.writeText(copyableSummaryText).catch(() => {});
      }
    } catch {
      // storage unavailable
    }

    onOpenChange(false);

    if (onReviseAtRevisionHub) {
      onReviseAtRevisionHub();
      return;
    }

    const query = new URLSearchParams();
    if (activeRecap.subjectId) query.set('subject', activeRecap.subjectId);
    if (activeRecap.topicName) query.set('topic', activeRecap.topicName);
    query.set('recap', 'true');
    router.push(`/capture-hub?${query.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl p-5 sm:p-7 border-2 border-[#1D3A62]/15 shadow-2xl">
        <DialogHeader className="space-y-2 pb-3 border-b border-[#1D3A62]/10">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFE38F] p-1.5 shadow-xs border border-[#1D3A62]/15">
              <Image
                src="/branding/spidey-chat-avatar.png"
                alt="Spidey Mascot"
                width={44}
                height={44}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg font-black text-[#1D3A62]">
                  Spidey&apos;s Quiz Recap
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="gap-1 border-[#1D3A62]/20 bg-[#1D3A62]/5 text-[10px] font-bold text-[#1D3A62]"
                >
                  <Sparkles className="h-3 w-3 text-[#1D3A62]" />
                  Gemini Analysis
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Review what was answered wrongly, copy your recap, and revise on Revision Hub!
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!activeRecap && loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <LoaderCircle className="h-8 w-8 animate-spin text-[#1D3A62]" />
            <p className="text-sm font-bold text-[#1D3A62]">
              Spidey is generating your Quiz Recap...
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Analyzing where you answered wrongly and summarizing your revision points.
            </p>
          </div>
        ) : !activeRecap ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No recap data is available for this assessment session.
          </div>
        ) : (
          <div className="space-y-4 pt-1 text-[#1D3A62]">
            {/* Spidey Performance Speech Bubble */}
            <div className="rounded-2xl border-2 border-[#1D3A62]/15 bg-gradient-to-br from-[#FFE38F]/20 via-white to-amber-500/5 p-4 shadow-xs">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFE38F] text-base font-black shadow-xs">
                  🕷️
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#1D3A62]/60">
                    Spidey&apos;s Performance Recap
                  </p>
                  <p className="text-sm font-bold leading-relaxed text-[#1D3A62]">
                    {activeRecap.summary}
                  </p>
                </div>
              </div>
            </div>

            {/* Overall Recap Box of things scored wrongly (copyable) */}
            <div className="rounded-2xl border-2 border-[#1D3A62]/15 bg-white p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1D3A62]/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1D3A62] text-xs text-white">
                    📋
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#1D3A62]">
                      Recap of Where You Answered Wrongly
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      {hasWrong
                        ? `${activeRecap.items.length} question${activeRecap.items.length === 1 ? '' : 's'} to review`
                        : 'Full score recap'}
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

              {/* Items scored wrongly */}
              <div className="rounded-xl border border-[#1D3A62]/10 bg-[#FFFCF7] p-3.5 text-xs text-[#1D3A62] space-y-2.5 leading-relaxed">
                {hasWrong ? (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                      Questions Answered Wrongly & Concepts to Revise:
                    </p>
                    <div className="space-y-2">
                      {activeRecap.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl bg-white p-3 border border-[#1D3A62]/10 space-y-1.5 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 font-bold text-xs text-[#1D3A62]">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-100 text-[10px] font-black text-rose-900">
                              Q{it.questionNumber}
                            </span>
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-950"
                            >
                              {it.concept}
                            </Badge>
                          </div>
                          <p className="text-xs text-rose-950 font-medium pl-7">
                            {it.whereWrongOrMisconception}
                          </p>
                          <p className="text-xs text-amber-950 font-semibold pl-7 bg-amber-50/70 rounded-md py-1 px-2 border border-amber-200/60 flex items-center gap-1.5">
                            <Lightbulb className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                            <span>
                              <strong className="font-bold">Take note:</strong> {it.takeNoteOf}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-50/80 p-3.5 text-emerald-900 text-xs">
                    <strong className="block font-bold text-sm">Perfect Score! 🌟</strong>
                    <p className="mt-1 opacity-90">
                      Zero mistakes found across all questions. You answered every question correctly!
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

            {/* Bottom Actions banner */}
            <div className="rounded-2xl border border-[#6486B5]/25 bg-gradient-to-r from-[#6486B5]/10 via-[#FFE38F]/20 to-[#6486B5]/10 p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-center sm:text-left">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1D3A62] text-white">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#1D3A62]">
                    Copy and paste to revise on Revision Hub
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Get positive, targeted feedback on which ones to focus on first.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  onClick={handleRevise}
                  className="flex-1 sm:flex-none h-10 rounded-xl bg-[#1D3A62] text-white hover:bg-[#1D3A62]/90 font-bold text-xs px-4 shadow-sm"
                >
                  <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                  Revise at Revision Hub
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-10 rounded-xl text-xs font-bold px-3 border-[#1D3A62]/20"
                >
                  Review Questions
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
