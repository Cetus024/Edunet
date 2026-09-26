'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAtomValue } from 'jotai';
import {
  ChevronRight,
  ChevronLeft,
  CheckSquare,
  Share2,
  BookOpen,
  Camera,
  Users,
} from 'lucide-react';
import { useNavigate } from '@/lib/navigation';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrentAccount } from '@/lib/api/me';
import { isTeachingRole } from '@/lib/roles';
import { getKnowledgeScoreColor } from '@/lib/score-color';
import TeacherDashboardPage from '@/features/teacher-dashboard';
import {
  subjectSummariesAtom,
  estimateReviewTime,
  getEffectiveScore,
  getDaysUntilReview,
  subjectsAtom,
  type TopicData,
} from '@/lib/study-data';

// Format numbers strictly to 2 significant figures (e.g. 2.089...% -> 2.1%, 6.06...% -> 6.1%, 17.4% -> 17%)
export function formatTo2SF(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  if (val <= 0) return '0%';
  if (val >= 100) return '100%';
  const num = Number(val.toPrecision(2));
  return `${num}%`;
}

/**
 * Circular progress gauge for the Overall Memory card (enlarged & prominent)
 */
export function OverallMemoryGauge({ score, size = 132 }: { score: number | null; size?: number }) {
  const radius = (size - 18) / 2;
  const circumference = 2 * Math.PI * radius;
  const displayScore = score ?? 0;
  const strokeDashoffset = score !== null ? circumference - (displayScore / 100) * circumference : circumference;
  const color = getKnowledgeScoreColor(score);
  const formattedScore = formatTo2SF(score);

  const statusLabel =
    score === null ? 'Not started' : score < 40 ? 'At risk' : score < 70 ? 'Needs review' : 'Healthy';

  return (
    <div className="relative shrink-0 flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F4EDCF"
          strokeWidth={9}
        />
        {score !== null && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color.fill}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl sm:text-3xl font-black text-[#17233A] tracking-tight">
          {formattedScore}
        </span>
        <span
          className="text-xs font-bold mt-0.5 tracking-tight"
          style={{ color: score !== null ? color.fill : '#8C9AA8' }}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

function StudentDashboard() {
  const navigate = useNavigate();
  const { data: account } = useCurrentAccount();
  const firstName = account?.user.name.split(/\s+/)[0] || 'Student';

  // Get data from study atoms
  const subjectSummaries = useAtomValue(subjectSummariesAtom);
  const subjects = useAtomValue(subjectsAtom);

  // Carousel ref and scroll handler
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const cardWidth = 340;
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -cardWidth : cardWidth,
      behavior: 'smooth',
    });
  };

  // Determine if student is a new user (no existing topic memory scores, quiz attempts, or reviews)
  const hasStudyActivity = useMemo(() => {
    return subjects
      .flatMap((subject) => subject.topics)
      .some(
        (topic) =>
          topic.memoryScore !== null ||
          (topic.quizAttempts && topic.quizAttempts > 0) ||
          topic.lastReviewedAt !== null,
      );
  }, [subjects]);


  // Overall Memory stats
  const startedSubjects = useMemo(
    () => subjectSummaries.filter((s) => s.avgScore !== null),
    [subjectSummaries],
  );
  const overallScore = useMemo(() => {
    if (startedSubjects.length === 0) return null;
    const total = startedSubjects.reduce((sum, s) => sum + (s.avgScore ?? 0), 0);
    return Math.round(total / startedSubjects.length);
  }, [startedSubjects]);

  // Topics due today count
  const dueTopicsCount = useMemo(() => {
    return subjects
      .flatMap((s) => s.topics)
      .filter((t) => {
        if (t.memoryScore === null) return false;
        const days = getDaysUntilReview(t.nextReviewAt);
        const effective = getEffectiveScore(t) ?? t.memoryScore;
        return effective < 40 || (days !== null && days <= 0);
      }).length;
  }, [subjects]);

  // Priority Queue: top 5 topics (urgent / at risk first, then next unstarted topics)
  const priorityQueue5 = useMemo(() => {
    const scoredTopics: Array<{
      topic: TopicData;
      subjectName: string;
      subjectIcon: string;
      effectiveScore: number;
      daysUntilReview: number | null;
      isReviewDue: boolean;
      subtext: string;
    }> = [];

    const unstartedTopics: Array<{
      topic: TopicData;
      subjectName: string;
      subjectIcon: string;
      effectiveScore: null;
      daysUntilReview: null;
      isReviewDue: boolean;
      subtext: string;
    }> = [];

    for (const subject of subjects) {
      subject.topics.forEach((topic, idx) => {
        const score = topic.memoryScore;
        const days = getDaysUntilReview(topic.nextReviewAt);
        if (score !== null) {
          const effectiveScore = getEffectiveScore(topic) ?? score;
          const isReviewDue = effectiveScore < 40 || (days !== null && days <= 0);
          scoredTopics.push({
            topic,
            subjectName: subject.name,
            subjectIcon: subject.icon,
            effectiveScore,
            daysUntilReview: days,
            isReviewDue,
            subtext: isReviewDue ? 'Review due today · memory dropping' : `Review due: in ${days ?? 2} days`,
          });
        } else {
          const prevTopic = idx > 0 ? subject.topics[idx - 1] : null;
          const subtext =
            idx === 0
              ? `First topic in ${subject.name}`
              : prevTopic && prevTopic.memoryScore !== null
                ? `Next topic in ${subject.name}`
                : idx === subject.topics.length - 1
                  ? `Completes your ${subject.name} set`
                  : `Next topic in ${subject.name}`;
          unstartedTopics.push({
            topic,
            subjectName: subject.name,
            subjectIcon: subject.icon,
            effectiveScore: null,
            daysUntilReview: null,
            isReviewDue: false,
            subtext,
          });
        }
      });
    }

    scoredTopics.sort((a, b) => {
      if (a.isReviewDue && !b.isReviewDue) return -1;
      if (!a.isReviewDue && b.isReviewDue) return 1;
      return a.effectiveScore - b.effectiveScore;
    });

    return [...scoredTopics, ...unstartedTopics].slice(0, 5);
  }, [subjects]);

  // Welcome headline text based on user state
  const welcomeHeadline = !hasStudyActivity
    ? `Welcome to EduNets ${firstName}, ready to start revising?`
    : `Welcome back to EduNets ${firstName}, continue where you previously left off!`;

  return (
    <div className="p-5 lg:p-10 pattern-overlay max-w-7xl mx-auto space-y-8">
      {/* ─────────────────────────────────────────────────────────────
          TOP SECTION: Study Pulse & Overall Memory (Combined Unified Card)
      ───────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-[2rem] edunets-gradient border border-border/70 p-6 sm:p-8 lg:p-10 shadow-[0_20px_60px_rgba(29,58,98,0.12)] flex flex-col md:flex-row items-center md:items-stretch justify-between gap-8"
      >
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-accent blob-soft pointer-events-none" />
        <div className="absolute -bottom-14 left-1/3 h-40 w-40 rounded-full bg-secondary blob-soft pointer-events-none" />

        {/* Left Side: Welcome Headline */}
        <div className="relative flex-1 min-w-0 flex flex-col justify-center text-center md:text-left">
          <Badge className="mb-3.5 rounded-full border-0 bg-primary text-primary-foreground px-3.5 py-1 font-bold text-xs shadow-xs w-fit mx-auto md:mx-0">
            EduNets study pulse
          </Badge>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-primary tracking-tight leading-tight max-w-2xl">
            {welcomeHeadline}
          </h1>
          <p className="text-foreground leading-relaxed mt-3 max-w-xl text-sm sm:text-base font-medium">
            Track your memory retention across subjects, test concepts with smart quizzes, and collaborate with your squad.
          </p>
        </div>

        {/* Right Side: Overall Memory Gauge & Stats (White Background Card) */}
        <div className="relative shrink-0 flex flex-col items-center justify-center text-center bg-white rounded-2xl sm:rounded-[1.5rem] p-5 sm:p-6 shadow-[0_8px_24px_rgba(29,58,98,0.06)] border border-[#1D3A62]/10 min-w-[210px] sm:min-w-[230px]">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#1D3A62]/75 block mb-2.5">
            OVERALL MEMORY
          </span>
          <div className="py-1">
            <OverallMemoryGauge score={overallScore} size={132} />
          </div>
          <div className="space-y-0.5 mt-3 text-center">
            <p className="text-xs text-[#1D3A62]/80 font-semibold">
              {startedSubjects.length} of {subjectSummaries.length} subjects started
            </p>
            <p className="text-xs text-muted-foreground font-medium">
              {dueTopicsCount === 0
                ? 'No topics due today'
                : dueTopicsCount === 1
                  ? '1 topic due today'
                  : `${dueTopicsCount} topics due today`}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────
          MIDDLE SECTION: What would you like to do? (Carousel Mode)
      ───────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-7 sm:w-3 sm:h-8 bg-secondary rounded-full -rotate-6 shrink-0" />
            <h2 className="text-2xl font-black tracking-tight text-primary">
              What would you like to do?
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs font-semibold text-muted-foreground mr-1">
              Test → See → Fix → Collab
            </span>
            <button
              type="button"
              onClick={() => scrollCarousel('left')}
              aria-label="Previous card"
              className="w-8 h-8 rounded-full border border-border/80 flex items-center justify-center bg-white hover:bg-muted/50 transition text-muted-foreground hover:text-foreground shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollCarousel('right')}
              aria-label="Next card"
              className="w-8 h-8 rounded-full border border-border/80 flex items-center justify-center bg-white hover:bg-muted/50 transition text-muted-foreground hover:text-foreground shadow-xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carousel track */}
        <div
          ref={carouselRef}
          className="flex items-stretch gap-5 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory no-scrollbar"
        >
          {/* CARD 1: Smart Quiz (Navy theme) */}
          <div className="snap-start min-w-[280px] sm:min-w-[320px] max-w-[360px] flex-1 rounded-[1.75rem] bg-[#1D3A62] text-white p-6 shadow-md flex flex-col justify-between relative overflow-hidden group">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#FFE38F] flex items-center justify-center text-[#17233A] shadow-xs">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold tracking-wider text-white/60 uppercase">
                  01 · TEST
                </span>
              </div>
              <h3 className="text-xl font-black text-white mb-2">Smart Quiz</h3>
              <p className="text-xs text-white/80 leading-relaxed mb-4">
                Check your current memory score. Questions adapt to what you know and update your scores.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => navigate('/quiz?subject=Mathematics')}
                  className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                >
                  Mathematics
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/quiz?subject=Chemistry')}
                  className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                >
                  Chemistry
                </button>
              </div>
            </div>
            <Button
              onClick={() => navigate('/quiz')}
              className="w-full rounded-xl bg-[#FFE38F] hover:bg-[#FFE38F]/90 text-[#17233A] font-black py-3 text-sm transition shadow-sm"
            >
              Test my knowledge
            </Button>
          </div>

          {/* CARD 2: Concept Web */}
          <div className="snap-start min-w-[280px] sm:min-w-[320px] max-w-[360px] flex-1 rounded-[1.75rem] border border-border/80 bg-white p-6 shadow-sm flex flex-col justify-between hover:border-[#6486B5]/40 transition group">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#6486B5]/15 flex items-center justify-center text-[#6486B5] shadow-xs">
                  <Share2 className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  02 · SEE
                </span>
              </div>
              <h3 className="text-xl font-black text-[#17233A] mb-2">Concept Web</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                See how your topics connect and where your memory is strong or fading.
              </p>
              {/* Miniature Concept Web visual */}
              <div className="h-16 w-full flex items-center justify-center my-2 rounded-xl bg-slate-50/80 dark:bg-slate-900/30 border border-slate-200/60 p-1 relative overflow-hidden">
                <svg width="100%" height="56" viewBox="0 0 220 56" className="overflow-visible">
                  <ellipse cx="110" cy="28" rx="88" ry="24" fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                  <ellipse cx="110" cy="28" rx="50" ry="15" fill="none" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="110" y1="28" x2="42" y2="18" stroke="#6486B5" strokeWidth="1.5" strokeOpacity="0.6" />
                  <line x1="110" y1="28" x2="72" y2="44" stroke="#6486B5" strokeWidth="1.5" strokeOpacity="0.6" />
                  <line x1="110" y1="28" x2="178" y2="16" stroke="#6486B5" strokeWidth="1.5" strokeOpacity="0.6" />
                  <line x1="110" y1="28" x2="152" y2="42" stroke="#6486B5" strokeWidth="1.5" strokeOpacity="0.6" />
                  <line x1="42" y1="18" x2="72" y2="44" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="2 2" />
                  <line x1="178" y1="16" x2="152" y2="42" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="2 2" />
                  <circle cx="110" cy="28" r="11" fill="#1D3A62" stroke="#FFE38F" strokeWidth="1.5" />
                  <text x="110" y="31" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#FFFFFF">MATH</text>
                  <circle cx="42" cy="18" r="8" fill="#E8735F" stroke="#FFFFFF" strokeWidth="1.5" />
                  <text x="42" y="21" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#FFFFFF">7%</text>
                  <text x="42" y="8" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#17233A">Algebra</text>
                  <circle cx="72" cy="44" r="7.5" fill="#186636" stroke="#FFFFFF" strokeWidth="1.5" />
                  <text x="72" y="46.5" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="#FFFFFF">85%</text>
                  <circle cx="178" cy="16" r="8" fill="#EAA93C" stroke="#FFFFFF" strokeWidth="1.5" />
                  <text x="178" y="18.5" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#FFFFFF">54%</text>
                  <text x="178" y="6" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#17233A">Geometry</text>
                  <circle cx="152" cy="42" r="7.5" fill="#6486B5" stroke="#FFFFFF" strokeWidth="1.5" />
                  <text x="152" y="44.5" textAnchor="middle" fontSize="5.5" fontWeight="bold" fill="#FFFFFF">68%</text>
                  <circle cx="16" cy="32" r="3" fill="#E8735F" opacity="0.6" />
                  <line x1="42" y1="18" x2="16" y2="32" stroke="#E8735F" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
                  <circle cx="204" cy="32" r="3" fill="#6486B5" opacity="0.6" />
                  <line x1="178" y1="16" x2="204" y2="32" stroke="#6486B5" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
                </svg>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/concept-web')}
              className="w-full rounded-xl border border-border/80 hover:bg-muted/40 text-[#17233A] font-bold py-3 text-sm transition"
            >
              Open Concept Web
            </Button>
          </div>

          {/* CARD 3: Revision Hub */}
          <div className="snap-start min-w-[280px] sm:min-w-[320px] max-w-[360px] flex-1 rounded-[1.75rem] border border-border/80 bg-white p-6 shadow-sm flex flex-col justify-between hover:border-[#E8735F]/40 transition group">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#FEEBE7] flex items-center justify-center text-[#E8735F] shadow-xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  03 · FIX
                </span>
              </div>
              <h3 className="text-xl font-black text-[#17233A] mb-2">Revision Hub</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Snap or paste your own notes. We&apos;ll spot the learning gaps and turn them into practice.
              </p>
              {/* Spidey giving tips visual */}
              <div className="h-16 w-full flex items-center justify-center gap-2.5 my-2 rounded-xl bg-[#FEEBE7]/70 border border-[#E8735F]/25 px-2.5 py-1.5 overflow-hidden">
                <div className="relative w-11 h-11 shrink-0">
                  <Image
                    src="/mascots/mascot6.webp"
                    alt="Spidey giving tips"
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10.5px] font-bold text-[#D95D39] leading-tight">
                    💡 &quot;Review notes to spot &amp; patch learning gaps before your next quiz!&quot;
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/capture-hub')}
              className="w-full rounded-xl border border-border/80 hover:bg-muted/40 text-[#17233A] font-bold py-3 text-sm transition"
            >
              Check learning gaps
            </Button>
          </div>

          {/* CARD 4: Study Squad */}
          <div className="snap-start min-w-[280px] sm:min-w-[320px] max-w-[360px] flex-1 rounded-[1.75rem] border border-border/80 bg-white p-6 shadow-sm flex flex-col justify-between hover:border-[#2D8A4E]/40 transition group">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#EAF5EF] flex items-center justify-center text-[#2D8A4E] shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                  04 · COLLAB
                </span>
              </div>
              <h3 className="text-xl font-black text-[#17233A] mb-2">Study Squad</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Study together with classmates, share quizzes, and rescue friends on tough topics.
              </p>
              {/* Multiple Spidey Study Squad visual */}
              <div className="h-16 w-full relative rounded-xl overflow-hidden my-2 border border-border/70 shadow-2xs bg-[#FBF8F1]">
                <Image
                  src="/branding/spidey-study-squad.jpg"
                  alt="Multiple Spideys studying together in Study Squad"
                  fill
                  className="object-cover object-center"
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/study-squad')}
              className="w-full rounded-xl border border-border/80 hover:bg-muted/40 text-[#17233A] font-bold py-3 text-sm transition"
            >
              Learn with squad
            </Button>
          </div>
        </div>
      </motion.section>

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM SECTION: Today's priority queue
      ───────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="rounded-[1.75rem] border border-border/80 bg-white p-6 lg:p-8 shadow-[0_8px_24px_rgba(29,58,98,0.06)]"
      >
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-7 sm:w-3 sm:h-8 bg-secondary rounded-full -rotate-6 shrink-0" />
            <div>
              <h2 className="text-xl lg:text-2xl font-black tracking-tight text-primary">
                Today&apos;s priority queue
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                The 5 topics to tackle next, picked from your memory scores and what you haven&apos;t started.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/concept-web')}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            See all subjects <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Priority Queue 5 Rows */}
        <div className="space-y-3">
          {priorityQueue5.map((item, index) => {
            const rank = index + 1;
            const reviewTime = item.effectiveScore !== null ? estimateReviewTime(item.effectiveScore) : 12;
            const scoreColor = item.effectiveScore !== null ? getKnowledgeScoreColor(item.effectiveScore) : null;

            const handleAction = () => {
              const scoreParam = item.effectiveScore !== null ? `&score=${item.effectiveScore}` : '';
              navigate(
                `/quiz?subject=${encodeURIComponent(item.subjectName)}&topic=${encodeURIComponent(
                  item.topic.name,
                )}${scoreParam}&mode=${item.topic.recommendedMode ?? 'mcq'}`,
              );
            };

            if (item.isReviewDue && item.effectiveScore !== null) {
              return (
                <div
                  key={item.topic.id}
                  className="flex items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-[#FFF3EE] border border-[#F0CFC4]/80 shadow-2xs transition hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-[#D95D39] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm sm:text-base text-[#17233A] truncate">
                          {item.topic.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-white font-semibold text-muted-foreground border-border/60 px-2 py-0"
                        >
                          {item.subjectName}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-[#D95D39] mt-0.5">
                        {item.subtext}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="hidden sm:block w-16 h-1.5 rounded-full bg-black/10 overflow-hidden relative">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(5, item.effectiveScore)}%`,
                            backgroundColor: scoreColor?.fill ?? '#D95D39',
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-[#17233A]">
                        {formatTo2SF(item.effectiveScore)}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium hidden xs:inline">
                        ~{reviewTime} min
                      </span>
                    </div>
                    <Button
                      onClick={handleAction}
                      className="rounded-xl bg-[#1D3A62] hover:bg-[#1D3A62]/90 text-white font-bold px-4 sm:px-5 h-9 text-xs shadow-xs transition hover:-translate-y-0.5"
                    >
                      Review now
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.topic.id}
                className="flex items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-muted/20 border border-border/60 transition hover:bg-muted/30 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-[#E5E9F0] text-[#17233A] font-bold text-sm flex items-center justify-center shrink-0">
                    {rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm sm:text-base text-[#17233A] truncate">
                        {item.topic.name}
                      </h4>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-white font-semibold text-muted-foreground border-border/60 px-2 py-0"
                      >
                        {item.subjectName}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.subtext}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                  <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                    Not started &nbsp;·&nbsp; Quiz
                  </span>
                  <Button
                    variant="outline"
                    onClick={handleAction}
                    className="rounded-xl border border-border/80 bg-white hover:bg-muted/50 text-[#17233A] font-bold px-5 sm:px-6 h-9 text-xs transition hover:-translate-y-0.5 shadow-xs"
                  >
                    Start
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

    </div>
  );
}

export default function DashboardPage() {
  const { data: account } = useCurrentAccount();
  const role = account?.profile?.role ?? null;

  if (isTeachingRole(role)) return <TeacherDashboardPage />;
  return <StudentDashboard />;
}
