'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import {
  Sparkles,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Check,
  Target,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { QuizRecap } from '@/lib/api/quiz';
import type { FocusGuidanceResult, FocusGuidanceArea } from '@/lib/api/capture';

export function QuizRevisionGuidance({
  recap,
  focusGuidance,
  onGoToSmartQuiz,
}: {
  recap?: QuizRecap | null;
  focusGuidance?: FocusGuidanceResult | null;
  onGoToSmartQuiz?: () => void;
}) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  // Check student performance tier to adjust Spidey's motivation appropriately
  const effectiveRecap = recap || (() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('edunets_quiz_recap_revision');
      return raw ? JSON.parse(raw) as QuizRecap : null;
    } catch {
      return null;
    }
  })();

  const rawSummary = effectiveRecap?.summary || focusGuidance?.overallSummary || '';
  const isZeroScore =
    (effectiveRecap && (effectiveRecap.correctCount === 0 || effectiveRecap.percentage === 0)) ||
    /\b(scored\s*0\b|0\s*\/\s*\d+|0%)\b/i.test(rawSummary) ||
    /\b(scored\s*0\b|0\s*\/\s*\d+|0%)\b/i.test(focusGuidance?.spideyGreeting || '');

  const isLowScore =
    isZeroScore ||
    (effectiveRecap && effectiveRecap.percentage <= 40) ||
    /\b([1-3]\/10|[1-4]\/10|[0-3][0-9]%)\b/i.test(rawSummary);

  const isHighScore = Boolean(effectiveRecap && effectiveRecap.percentage >= 80);

  // Motivational supportive message matched to score
  let motivationalMessage: string;
  let encouragement: string;

  if (isZeroScore || isLowScore) {
    motivationalMessage =
      "Don't worry, learning takes time! Everyone starts somewhere, and mistakes are simply how we learn.";
    encouragement =
      "Take it step by step! Review these points, and you will definitely see improvement on your next quiz.";
  } else if (isHighScore) {
    motivationalMessage =
      focusGuidance?.spideyGreeting ||
      "Great work on your quiz! You have most of this down.";
    encouragement =
      focusGuidance?.positiveEncouragement ||
      "Awesome effort! Review these last few points and you're ready for 100%!";
  } else {
    motivationalMessage =
      focusGuidance?.spideyGreeting ||
      "You're on the right track! A few tricky spots tripped you up, but you're making steady progress.";
    encouragement =
      focusGuidance?.positiveEncouragement ||
      "You're getting closer! Review these tips, tick them off, and jump back into Smart Quiz to test yourself!";
  }

  // Combine 1 single quick tip
  const quickTip =
    focusGuidance?.quickTip ||
    (focusGuidance?.focusAreas && focusGuidance.focusAreas[0]?.tip) ||
    (focusGuidance?.focusAreas && focusGuidance.focusAreas[0]?.memoryTip) ||
    "Always read the question requirements carefully and write down your known values or formulas before answering.";

  // Overall minimum 3, maximum 10 feedbacks on what students need to focus on
  const feedbacks: string[] = (() => {
    if (focusGuidance?.feedbacks && focusGuidance.feedbacks.length > 0) {
      return focusGuidance.feedbacks.slice(0, 10);
    }
    if (focusGuidance?.focusAreas && focusGuidance.focusAreas.length > 0) {
      const list = focusGuidance.focusAreas
        .map((fa) => fa.howToImprove || fa.takeNoteOf || fa.concept)
        .filter(Boolean);
      if (list.length > 0) return list.slice(0, 10);
    }
    if (effectiveRecap?.items && effectiveRecap.items.length > 0) {
      const list = effectiveRecap.items.map((it) => {
        const advice = it.takeNoteOf || it.adviceOrCorrection;
        return advice
          ? `Review ${it.concept}: ${advice}`
          : `Review ${it.concept} — focus on key steps and definitions.`;
      });
      return list.slice(0, 10);
    }
    return [];
  })();

  const defaultPoints = [
    `Review core definitions and key formulas for ${effectiveRecap?.topicName || 'this topic'}.`,
    'Practice step-by-step problem solving on the questions you answered incorrectly.',
    'Double-check common units and condition requirements before selecting your final answer.',
  ];

  const finalFeedbacks = [...feedbacks];
  for (const dp of defaultPoints) {
    if (finalFeedbacks.length >= 3) break;
    if (!finalFeedbacks.includes(dp)) finalFeedbacks.push(dp);
  }
  const displayFeedbacks = finalFeedbacks.slice(0, 10);

  const total = displayFeedbacks.length;
  const reviewedCount = checkedItems.size;
  const progressPercent = total > 0 ? Math.round((reviewedCount / total) * 100) : 100;

  const toggleReviewed = (idx: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-4 text-studynow-dark">
      {/* Spidey Motivational Banner + 1 Quick Tip Combined */}
      <div className="flex items-start gap-3.5 rounded-2xl border border-[#6486B5]/25 bg-gradient-to-br from-[#6486B5]/10 via-[#FFE38F]/15 to-amber-500/5 p-4 shadow-xs">
        <div className="relative shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white p-1 shadow-xs border border-[#6486B5]/20">
            <Image
              src="/branding/spidey-chat-avatar.png"
              alt="Spidey"
              width={38}
              height={38}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#6486B5]">
              Spidey&apos;s Focus Guidance
            </h4>
            <Badge
              variant="outline"
              className="border-emerald-300 bg-emerald-50 text-[10px] font-bold text-emerald-800"
            >
              <Sparkles className="mr-1 h-3 w-3 text-emerald-600" />
              Supportive Coaching
            </Badge>
          </div>

          {/* Motivational supportive message */}
          <p className="text-sm font-semibold leading-snug text-[#1D3A62]">
            {motivationalMessage}
          </p>

          {/* Combined 1 Quick Tip with the motivational message */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-white/80 p-2.5 text-xs text-amber-950 font-medium shadow-2xs">
            <span className="shrink-0 text-sm">💡</span>
            <div>
              <strong className="font-bold text-amber-900">Spidey&apos;s Quick Tip: </strong>
              <span className="text-amber-950/90">{quickTip}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress tracker */}
      {total > 0 && (
        <div className="rounded-xl border border-border/80 bg-card p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-muted-foreground">Revision Progress</span>
            <span className="text-[#1D3A62]">
              {reviewedCount} of {total} points reviewed
            </span>
          </div>
          <Progress value={progressPercent} className="h-2 rounded-full" />
        </div>
      )}

      {/* Overall Feedbacks List (Min 3, Max 10) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#1D3A62]" />
            <h5 className="text-xs font-black uppercase tracking-wide text-[#1D3A62]">
              What you need to focus on ({total})
            </h5>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            Overall revision checklist
          </span>
        </div>

        {displayFeedbacks.map((fb, idx) => {
          const isDone = checkedItems.has(idx);

          return (
            <motion.div
              key={idx}
              layout
              className={cn(
                'flex items-start justify-between gap-3 rounded-2xl border p-3.5 transition-all',
                isDone
                  ? 'border-emerald-300 bg-emerald-50/40 opacity-80'
                  : 'border-[#1D3A62]/15 bg-white shadow-xs'
              )}
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1D3A62]/10 text-[11px] font-black text-[#1D3A62] mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-xs sm:text-sm font-semibold leading-relaxed text-[#1D3A62]">
                  {fb}
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                variant={isDone ? 'outline' : 'secondary'}
                onClick={() => toggleReviewed(idx)}
                className={cn(
                  'h-6 rounded-lg text-[11px] font-bold px-2.5 transition-all shrink-0',
                  isDone
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                    : 'bg-[#1D3A62]/10 hover:bg-[#1D3A62]/15 text-[#1D3A62]'
                )}
              >
                {isDone ? (
                  <>
                    <Check className="mr-1 h-3 w-3 text-emerald-700" />
                    Understood!
                  </>
                ) : (
                  'Mark as done'
                )}
              </Button>
            </motion.div>
          );
        })}
      </div>

      {/* Supportive advice closing message */}
      <div className="rounded-xl border border-[#6486B5]/20 bg-gradient-to-r from-[#6486B5]/10 via-[#FFE38F]/15 to-emerald-500/10 p-3 text-xs text-[#1D3A62]">
        <div className="flex items-center gap-1.5 font-bold mb-0.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span>Spidey&apos;s Advice</span>
        </div>
        <p className="leading-snug opacity-95 pl-5 font-medium">
          {encouragement}
        </p>
      </div>

      {/* Bottom Action Button: Back to Smart Quiz to Re-test */}
      {onGoToSmartQuiz && (
        <div className="pt-2">
          <Button
            type="button"
            onClick={onGoToSmartQuiz}
            className="w-full h-12 rounded-2xl bg-[#EAA93C] hover:bg-[#EAA93C]/90 text-studynow-dark font-black text-sm shadow-sm flex items-center justify-center transition-all"
          >
            <Sparkles className="mr-2 h-4 w-4 text-studynow-dark" />
            Back to Smart Quiz to Re-test
            <ArrowRight className="ml-2 h-4 w-4 text-studynow-dark" />
          </Button>
        </div>
      )}
    </div>
  );
}
