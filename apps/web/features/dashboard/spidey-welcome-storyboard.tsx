'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Share2,
  CalendarClock,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  X,
  RotateCcw,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MascotVisual } from '@/features/mascot/mascot-visual';
import { useNavigate } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export const STORYBOARD_STORAGE_KEY = 'edunets_storyboard_seen_v1';
export const GUIDE_COLLAPSED_STORAGE_KEY = 'edunets_homepage_guide_collapsed_v1';

export type StoryboardStep = {
  id: string;
  stepNumber: string;
  badge: string;
  badgeColor: string;
  mascotScene: 'welcome' | 'study' | 'insight' | 'question' | 'success';
  title: string;
  summary: string;
  highlights: {
    icon: typeof Brain;
    iconColor: string;
    title: string;
    description: string;
  }[];
  primaryActionLabel: string;
  primaryActionHref?: string;
  crucialWarning?: string;
};

export const STORYBOARD_STEPS: StoryboardStep[] = [
  {
    id: 'welcome',
    stepNumber: 'Welcome',
    badge: 'Meet Spidey',
    badgeColor: 'border-amber-300 bg-amber-50 text-amber-950',
    mascotScene: 'welcome',
    title: 'Welcome to EduNets!',
    summary:
      "Hi there! I'm Spidey, your AI study companion. I'm here to guide you through secondary school syllabuses (O-Level / IGCSE) with adaptive testing, visual knowledge webs, and memory science so you never forget what you study.",
    highlights: [
      {
        icon: Sparkles,
        iconColor: 'text-amber-600 bg-amber-100',
        title: 'Adaptive Learning for Your Syllabus',
        description: 'Complete coverage of core subjects, topics, and sub-topics.',
      },
      {
        icon: Brain,
        iconColor: 'text-[#1D3A62] bg-[#1D3A62]/10',
        title: 'Spaced-Repetition Memory Science',
        description: 'Track how well concepts stick and beat the forgetting curve.',
      },
      {
        icon: Lightbulb,
        iconColor: 'text-emerald-700 bg-emerald-100',
        title: 'Empathetic AI Feedback',
        description: 'Instant corrections, encouragement, and actionable study tips.',
      },
    ],
    primaryActionLabel: 'Start Tour',
  },
  {
    id: 'quiz',
    stepNumber: 'Step 1 of 4',
    badge: 'Where to Start',
    badgeColor: 'border-sky-300 bg-sky-50 text-sky-950',
    mascotScene: 'study',
    title: 'Start by Testing Your Knowledge in Smart Quiz',
    summary:
      'Begin your journey by heading to Smart Quiz! You can select any subject (Chemistry, Physics, Biology, Math, and more), pick a topic, and even zoom in to granular sub-topics (like Kinematics, Mole Calculations, or Quadratic Graphs).',
    highlights: [
      {
        icon: Brain,
        iconColor: 'text-sky-700 bg-sky-100',
        title: 'Granular Sub-Topic Selection',
        description: 'Test specific sub-concepts so you can pinpoint exact weak areas.',
      },
      {
        icon: CheckCircle2,
        iconColor: 'text-emerald-700 bg-emerald-100',
        title: 'MCQ & Essay Question Modes',
        description: 'Practice instant-graded MCQs or full subjective essays with marking schemes.',
      },
      {
        icon: Sparkles,
        iconColor: 'text-[#1D3A62] bg-[#1D3A62]/10',
        title: 'Builds Your Initial Memory Score',
        description: 'Every completed quiz initializes and updates your concept mastery.',
      },
    ],
    primaryActionLabel: 'Next: Concept Web',
    primaryActionHref: '/quiz',
  },
  {
    id: 'concept-web',
    stepNumber: 'Step 2 of 4',
    badge: 'Visual Mastery',
    badgeColor: 'border-indigo-300 bg-indigo-50 text-indigo-950',
    mascotScene: 'insight',
    title: 'View Your Memory Score on the Concept Web',
    summary:
      'Once you test yourself, explore Concept Web to see an interactive visual network of all your syllabus concepts! Each node displays your live Memory Score (0–100%) so you can immediately see what you have mastered.',
    highlights: [
      {
        icon: Share2,
        iconColor: 'text-indigo-700 bg-indigo-100',
        title: 'Interactive Knowledge Graph',
        description: 'See how fundamental principles connect to advanced problem solving.',
      },
      {
        icon: Sparkles,
        iconColor: 'text-emerald-700 bg-emerald-100',
        title: 'Color-Coded Mastery Scores',
        description: 'Green indicates full mastery (80%+), blue is steady progress, and red is at risk.',
      },
      {
        icon: Brain,
        iconColor: 'text-amber-700 bg-amber-100',
        title: 'Direct 1-Click Practice',
        description: 'Click any node to inspect concept details and launch focused review quizzes.',
      },
    ],
    primaryActionLabel: 'Next: Crucial Rule',
    primaryActionHref: '/concept-web',
  },
  {
    id: 'review-date',
    stepNumber: 'Step 3 of 4',
    badge: 'Crucial Memory Rule',
    badgeColor: 'border-rose-300 bg-rose-50 text-rose-950',
    mascotScene: 'question',
    title: 'Watch Your Next Review Date! ⏳',
    summary:
      "Here is the most important secret to long-term memory: your memory score will drop over time if you don't review! Our spaced repetition algorithm tracks memory decay and calculates your exact Next Review Date.",
    crucialWarning:
      'Crucial: Check your next review date regularly on the Dashboard and Concept Web. If a topic passes its review date without revision, its memory score decays into the At Risk zone!',
    highlights: [
      {
        icon: CalendarClock,
        iconColor: 'text-rose-700 bg-rose-100',
        title: 'Calculated Next Review Dates',
        description: 'Each topic reminds you exactly when to review to maximize retention.',
      },
      {
        icon: AlertTriangle,
        iconColor: 'text-amber-700 bg-amber-100',
        title: 'Beat the Forgetting Curve',
        description: 'Reviewing right when retention begins to fade locks concepts into permanent memory.',
      },
      {
        icon: RotateCcw,
        iconColor: 'text-emerald-700 bg-emerald-100',
        title: 'Quick 5-Minute Boost',
        description: 'Taking a quick refresher quiz immediately restores your memory score to 100%.',
      },
    ],
    primaryActionLabel: 'Next: Revision Hub',
  },
  {
    id: 'revision-hub',
    stepNumber: 'Step 4 of 4',
    badge: 'Mistakes & Quick Revision',
    badgeColor: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    mascotScene: 'success',
    title: 'Revise Mistakes & Quick Revision in Revision Hub',
    summary:
      "Whenever you finish a Smart Quiz, you can copy your quiz recap and paste it into Revision Hub to get Spidey's focused guidance on what to improve! You can also use Revision Hub anytime for quick revisions with instant syllabus notes and smart flashcards.",
    highlights: [
      {
        icon: BookOpen,
        iconColor: 'text-emerald-700 bg-emerald-100',
        title: 'Overall Focus Guidance',
        description: 'Get 3 to 10 clear focus points and 1 quick tip on your quiz mistakes.',
      },
      {
        icon: Sparkles,
        iconColor: 'text-amber-700 bg-amber-100',
        title: 'Interactive Flashcards',
        description: 'Generate high-yield flip flashcards for rapid memorization on the go.',
      },
      {
        icon: CheckCircle2,
        iconColor: 'text-[#1D3A62] bg-[#1D3A62]/10',
        title: 'Syllabus-Grounded Topic Notes',
        description: 'Generate comprehensive notes and evaluate your own handwritten notes.',
      },
    ],
    primaryActionLabel: '🚀 Start Smart Quiz Now!',
    primaryActionHref: '/quiz',
  },
];

/**
 * 1x Storyboard Dialog Modal for first-time onboarding or on-demand tour
 */
export function SpideyWelcomeStoryboardModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  const step = STORYBOARD_STEPS[currentStepIndex] || STORYBOARD_STEPS[0]!;
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === STORYBOARD_STEPS.length - 1;

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORYBOARD_STORAGE_KEY, 'true');
      } catch {}
    }
    onOpenChange(false);
  };

  const handleNext = () => {
    if (isLast) {
      handleClose();
      navigate('/quiz');
    } else {
      setCurrentStepIndex((prev) => Math.min(STORYBOARD_STEPS.length - 1, prev + 1));
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden rounded-[2rem] border-2 border-[#1D3A62]/15 bg-gradient-to-br from-white via-[#FFFDF7] to-amber-50/20 p-0 shadow-[0_24px_70px_rgba(29,58,98,0.18)]">
        {/* Top Header Bar */}
        <div className="relative z-10 flex items-center justify-between border-b border-[#1D3A62]/10 bg-white/80 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFE38F] p-1 shadow-xs border border-[#1D3A62]/10">
              <Image
                src="/branding/spidey-chat-avatar.png"
                alt="Spidey"
                width={36}
                height={36}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <DialogTitle className="text-sm font-black text-[#1D3A62]">
                Spidey&apos;s EduNets Storyboard Guide
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {step.stepNumber} · How to ace your syllabus with EduNets
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('text-[11px] font-bold px-2.5 py-0.5', step.badgeColor)}
            >
              {step.badge}
            </Badge>
          </div>
        </div>

        {/* Storyboard Content with Slide Transitions */}
        <div className="relative min-h-[380px] p-6 sm:p-8">
          {/* Ambient blob */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#FFE38F]/35 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[#6486B5]/15 blur-3xl"
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
              className="grid gap-6 md:grid-cols-[180px_minmax(0,1fr)] items-center"
            >
              {/* Mascot visual column */}
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative flex h-36 w-36 sm:h-40 sm:w-40 items-center justify-center rounded-3xl bg-gradient-to-br from-white via-amber-50 to-[#FFE38F]/30 p-2 shadow-[0_12px_28px_rgba(29,58,98,0.08)] border border-[#1D3A62]/10">
                  <MascotVisual scene={step.mascotScene} className="h-28 w-28 sm:h-32 sm:w-32" />
                </div>
                <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#1D3A62]/08 px-3 py-1 text-[11px] font-bold text-[#1D3A62]">
                  🕷️ Spidey
                </span>
              </div>

              {/* Text & highlights column */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-[#1D3A62]">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm font-medium leading-relaxed text-[#1D3A62]/85">
                    {step.summary}
                  </p>
                </div>

                {/* Crucial warning callout for review date */}
                {step.crucialWarning && (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-start gap-2.5 rounded-2xl border-2 border-rose-300 bg-rose-50/90 p-3 text-xs text-rose-950 shadow-xs"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <strong className="font-bold text-rose-900">Take Note: </strong>
                      <span className="font-semibold">{step.crucialWarning}</span>
                    </div>
                  </motion.div>
                )}

                {/* Highlights List */}
                <div className="space-y-2">
                  {step.highlights.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-xl border border-[#1D3A62]/10 bg-white/90 p-2.5 shadow-2xs"
                      >
                        <div
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                            item.iconColor
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[#1D3A62]">{item.title}</p>
                          <p className="text-[11px] font-medium text-muted-foreground leading-snug">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#1D3A62]/10 bg-white/90 px-6 py-4">
          {/* Step indicator dots & skip toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {STORYBOARD_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStepIndex(idx)}
                  className={cn(
                    'h-2.5 rounded-full transition-all duration-300',
                    idx === currentStepIndex
                      ? 'w-7 bg-[#1D3A62]'
                      : 'w-2.5 bg-[#1D3A62]/25 hover:bg-[#1D3A62]/50'
                  )}
                  aria-label={`Go to ${s.stepNumber}`}
                />
              ))}
            </div>
            <label className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-[#1D3A62]/30 text-[#1D3A62] focus:ring-0"
              />
              <span>Don&apos;t show on startup</span>
            </label>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="h-9 rounded-xl border-[#1D3A62]/20 font-bold text-xs"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className={cn(
                'h-9 rounded-xl font-bold text-xs px-4 shadow-sm transition-all',
                isLast
                  ? 'bg-[#EAA93C] text-studynow-dark hover:bg-[#EAA93C]/90 font-black'
                  : 'bg-[#1D3A62] text-white hover:bg-[#1D3A62]/90'
              )}
            >
              {isLast ? (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Start Smart Quiz Now!
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Animated Spidey Quick-Start Guide banner on the Homepage (for new users)
 */
export function SpideyHomepageGuideBanner({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUIDE_COLLAPSED_STORAGE_KEY);
      if (stored === 'true') setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(GUIDE_COLLAPSED_STORAGE_KEY, String(next));
    } catch {}
  };

  if (collapsed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/70 bg-gradient-to-r from-amber-50/90 via-white to-sky-50/80 px-4 py-2.5 text-xs text-[#1D3A62] shadow-xs"
      >
        <div className="flex items-center gap-2.5 font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#FFE38F] text-sm shadow-2xs">
            🕷️
          </span>
          <span className="text-xs font-black">Spidey&apos;s Quick Guide:</span>
          <span className="hidden sm:inline text-muted-foreground font-medium">
            1. Smart Quiz → 2. Concept Web → 3. Next Review Date → 4. Revision Hub
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={toggleCollapse}
            className="h-7 rounded-lg text-[11px] font-bold text-[#1D3A62] hover:bg-[#1D3A62]/10"
          >
            Show Guide
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative mb-10 overflow-hidden rounded-[2rem] border-2 border-amber-300/80 bg-gradient-to-br from-white via-amber-50/40 to-sky-50/50 p-6 sm:p-7 shadow-[0_16px_45px_rgba(29,58,98,0.09)]"
    >
      {/* Decorative ambient blur */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#FFE38F]/40 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-[#6486B5]/15 blur-2xl"
      />

      {/* Top Banner Row */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1D3A62]/10 pb-5">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="relative flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#FFE38F] p-1.5 shadow-sm border border-[#1D3A62]/10">
            <Image
              src="/branding/spidey-chat-avatar.png"
              alt="Spidey"
              width={48}
              height={48}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-0 bg-[#1D3A62] text-white text-[10px] font-bold px-2.5 py-0.5">
                <Sparkles className="mr-1 h-3 w-3 text-amber-300" />
                Spidey&apos;s Getting Started Guide
              </Badge>
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-950"
              >
                New User Onboarding
              </Badge>
            </div>
            <h3 className="mt-1 text-base sm:text-lg font-black tracking-tight text-[#1D3A62]">
              How to ace your syllabus with EduNets in 4 simple steps
            </h3>
            <p className="mt-0.5 text-xs text-[#1D3A62]/75 font-medium">
              Follow this study loop to build permanent memory and master every exam topic.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleCollapse}
            className="h-8 w-8 rounded-xl p-0 text-[#1D3A62]/60 hover:text-[#1D3A62] hover:bg-[#1D3A62]/10"
            title="Minimize guide"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          {onDismiss && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-8 rounded-xl px-2.5 text-[11px] font-bold text-[#1D3A62]/60 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1"
              title="Dismiss guide"
            >
              <X className="h-3.5 w-3.5" />
              <span>Dismiss</span>
            </Button>
          )}
        </div>
      </div>

      {/* 4 Step Cards Grid */}
      <div className="relative z-10 mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Step 1: Smart Quiz */}
        <div
          onClick={() => navigate('/quiz')}
          className="group relative flex flex-col justify-between rounded-2xl border-2 border-sky-200/80 bg-white/95 p-4 shadow-2xs hover:border-sky-400 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-800">
                <Brain className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                Step 1 · Start Here
              </span>
            </div>
            <div>
              <h4 className="text-sm font-black text-[#1D3A62] group-hover:text-sky-900 transition-colors">
                1. Test Your Knowledge
              </h4>
              <p className="mt-1 text-xs font-medium text-[#1D3A62]/80 leading-relaxed">
                Start by testing on specific subjects, topics, and even granular sub-topics with MCQ or Essay.
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex items-center text-xs font-bold text-sky-700 group-hover:translate-x-1 transition-transform">
            <span>Start Smart Quiz</span>
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>
        </div>

        {/* Step 2: Concept Web */}
        <div
          onClick={() => navigate('/concept-web')}
          className="group relative flex flex-col justify-between rounded-2xl border-2 border-indigo-200/80 bg-white/95 p-4 shadow-2xs hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-800">
                <Share2 className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                Step 2 · Knowledge Map
              </span>
            </div>
            <div>
              <h4 className="text-sm font-black text-[#1D3A62] group-hover:text-indigo-900 transition-colors">
                2. View Memory Score
              </h4>
              <p className="mt-1 text-xs font-medium text-[#1D3A62]/80 leading-relaxed">
                Open Concept Web to see connected syllabus nodes and track your live Memory Score (0–100%).
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex items-center text-xs font-bold text-indigo-700 group-hover:translate-x-1 transition-transform">
            <span>Explore Concept Web</span>
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>
        </div>

        {/* Step 3: Next Review Date (Crucial Warning) */}
        <div
          onClick={() => navigate('/dashboard')}
          className="group relative flex flex-col justify-between rounded-2xl border-2 border-rose-300 bg-rose-50/70 p-4 shadow-2xs hover:border-rose-400 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-800">
                <CalendarClock className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-900 bg-rose-100/90 px-2 py-0.5 rounded-full border border-rose-300">
                Step 3 · Crucial Rule!
              </span>
            </div>
            <div>
              <h4 className="text-sm font-black text-rose-950 group-hover:text-rose-900 transition-colors">
                3. Watch Next Review Date
              </h4>
              <p className="mt-1 text-xs font-semibold text-rose-950/85 leading-relaxed">
                ⚠️ Take note: your memory score drops if you don&apos;t review! Review on or before your Next Review Date.
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex items-center text-xs font-bold text-rose-800 group-hover:translate-x-1 transition-transform">
            <span>View Due Topics</span>
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>
        </div>

        {/* Step 4: Revision Hub */}
        <div
          onClick={() => navigate('/capture-hub')}
          className="group relative flex flex-col justify-between rounded-2xl border-2 border-emerald-200/80 bg-white/95 p-4 shadow-2xs hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <BookOpen className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Step 4 · Polish
              </span>
            </div>
            <div>
              <h4 className="text-sm font-black text-[#1D3A62] group-hover:text-emerald-900 transition-colors">
                4. Revise in Revision Hub
              </h4>
              <p className="mt-1 text-xs font-medium text-[#1D3A62]/80 leading-relaxed">
                Revise quiz mistakes with Spidey&apos;s focused guidance, or do quick revisions with flashcards & notes.
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex items-center text-xs font-bold text-emerald-700 group-hover:translate-x-1 transition-transform">
            <span>Open Revision Hub</span>
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </motion.section>
  );
}
