'use client';

import { useMemo, useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import {
  ChevronRight,
  Clock,
  Inbox,
  Calendar,
  Share2,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from '@/lib/navigation';
import { motion } from 'motion/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrentAccount } from '@/lib/api/me';
import { isTeachingRole } from '@/lib/roles';
import { getKnowledgeScoreColor } from '@/lib/score-color';
import { useSubjectName, useTranslation, type TranslationKey } from '@/lib/i18n';
import TeacherDashboardPage from '@/features/teacher-dashboard';
import {
  subjectSummariesAtom,
  priorityQueueAtom,
  estimateReviewTime,
  getEffectiveScore,
  getDaysUntilReview,
  atRiskTopicsAtom,
  subjectsAtom,
  type SubjectSummary,
  type PriorityQueueItem,
  type TopicData,
} from '@/lib/study-data';
import {
  SpideyWelcomeStoryboardModal,
  SpideyHomepageGuideBanner,
  STORYBOARD_STORAGE_KEY,
} from '@/features/dashboard/spidey-welcome-storyboard';

// Format numbers strictly to 2 significant figures (e.g. 2.089...% -> 2.1%, 6.06...% -> 6.1%, 17.4% -> 17%)
export function formatTo2SF(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  if (val <= 0) return '0%';
  if (val >= 100) return '100%';
  const num = Number(val.toPrecision(2));
  return `${num}%`;
}

// Compute friendly reminder for when the next review is due
export function getNextReviewReminder(topic: TopicData, effectiveScore: number | null) {
  const days = getDaysUntilReview(topic.nextReviewAt);
  if (effectiveScore === null) {
    return { label: 'Not started', isUrgent: false, days: null };
  }
  if (days === null) {
    if (effectiveScore < 40) {
      return { label: 'Review Due: Today ⚠️', isUrgent: true, days: 0 };
    }
    return { label: 'Review Due: in 2 days', isUrgent: false, days: 2 };
  }
  if (days <= 0) {
    return { label: 'Review Due: Today ⚠️', isUrgent: true, days: 0 };
  }
  if (days === 1) {
    return { label: 'Review Due: Tomorrow', isUrgent: false, days: 1 };
  }
  return { label: `Review Due: in ${days} days`, isUrgent: false, days };
}

// Get greeting based on time of day
function getGreetingKey(): TranslationKey {
  const hour = new Date().getHours();
  if (hour < 12) return 'dashboard.greeting.morning';
  if (hour < 17) return 'dashboard.greeting.afternoon';
  return 'dashboard.greeting.evening';
}

// At-risk topic info for priority queue
export interface AtRiskTopicInfo {
  topic: TopicData;
  subjectName: string;
  subjectIcon: string;
  effectiveScore: number;
}

/**
 * Circular gauge uses continuous score scale and renders score in 2 s.f.
 */
export function CircularGauge({ score, size = 80 }: { score: number | null; size?: number }) {
  const { t } = useTranslation();
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const displayScore = score ?? 0;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;
  const color = getKnowledgeScoreColor(score);
  const formattedScore = formatTo2SF(score);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color.background}
          strokeWidth={8}
        />
        {score !== null && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color.fill}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {score !== null ? (
          <motion.span
            className="text-lg lg:text-xl font-black"
            style={{ color: color.fill }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            {formattedScore}
          </motion.span>
        ) : (
          <motion.span
            className="text-[9px] font-bold text-muted-foreground text-center px-1 leading-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {t('dashboard.notStarted')}
          </motion.span>
        )}
      </div>
    </div>
  );
}

/**
 * Concise Subject Memory Health Card (Stacked Layout):
 * - Header: subject name, status badge, Concept Web button
 * - Body: LEFT center hub with bigger gauge → SVG bezier branches → RIGHT compact topic rows
 * - Sorted stacked: most at-risk first (ascending avgScore)
 */
export function MemoryHealthSubjectBranchCard({
  subject,
  index,
}: {
  subject: SubjectSummary;
  index: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const avgScore = subject.avgScore;
  const isAtRisk = avgScore !== null && avgScore < 30;
  const needsReview = avgScore !== null && avgScore >= 30 && avgScore < 60;
  const isOnTrack = avgScore !== null && avgScore >= 60;

  const weakestTopic = useMemo(() => {
    if (!subject.topics || subject.topics.length === 0) return null;
    const scored = [...subject.topics].filter((tp) => tp.memoryScore !== null);
    if (scored.length === 0) return subject.topics[0];
    scored.sort((a, b) => (getEffectiveScore(a) ?? 0) - (getEffectiveScore(b) ?? 0));
    return scored[0];
  }, [subject.topics]);

  const handleReviewWeakest = () => {
    if (!weakestTopic) return;
    const score = getEffectiveScore(weakestTopic);
    const scoreParam = score === null ? '' : `&score=${score}`;
    navigate(`/quiz?subject=${encodeURIComponent(subject.name)}&topic=${encodeURIComponent(weakestTopic.name)}${scoreParam}&mode=${weakestTopic.recommendedMode ?? 'mcq'}`);
  };

  const handleGoToConceptWeb = () => navigate(`/concept-web?subject=${encodeURIComponent(subject.name)}`);

  const getLastReviewedText = () => {
    if (avgScore === null) return t('dashboard.notStartedCount', { count: subject.notStartedCount });
    if (subject.lastReviewed === null) return t('dashboard.lastReviewed.none');
    if (subject.lastReviewed <= 0) return t('dashboard.lastReviewed.today');
    if (subject.lastReviewed === 1) return t('dashboard.lastReviewed.yesterday');
    return t('dashboard.lastReviewed.days', { days: subject.lastReviewed });
  };

  const topicCount = subject.topics.length;
  // Each topic row is ~44px tall + 6px gap; min height ensures SVG has room to spread
  const rowHeight = 44;
  const rowGap = 6;
  const bodyHeight = Math.max(144, topicCount * rowHeight + (topicCount - 1) * rowGap);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08, duration: 0.38 }}
    >
      <Card className="rounded-[1.75rem] border border-border/80 bg-card text-card-foreground shadow-[0_10px_28px_rgba(29,58,98,0.06)] hover:shadow-[0_16px_40px_rgba(29,58,98,0.10)] transition-all duration-300">
        <CardContent className="p-5 lg:p-6">

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-border/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl p-2 rounded-xl bg-secondary/30 shrink-0">{subject.icon}</span>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-base lg:text-lg font-black text-foreground tracking-tight">{subject.name}</h3>
                  {subject.syllabusCode && (
                    <Badge variant="outline" className="text-[10px] font-semibold text-muted-foreground border-border/60 px-1.5 py-0">
                      {subject.syllabusCode}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {isAtRisk    && <span className="text-[10px] font-bold text-destructive flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-destructive animate-ping inline-block" />At Risk</span>}
                  {needsReview && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />Needs Review</span>}
                  {isOnTrack   && <span className="text-[10px] font-bold text-primary flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />Memory Healthy</span>}
                  {avgScore === null && <span className="text-[10px] text-muted-foreground">Not started yet</span>}
                </div>
              </div>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={handleGoToConceptWeb}
              className="rounded-full font-bold border-primary/30 hover:border-primary text-primary hover:bg-primary/10 text-[11px] px-3 h-7 flex items-center gap-1 shrink-0"
            >
              <Share2 className="w-3 h-3" />
              Concept Web
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          {/* ── Body: Hub (left) → SVG branches → Topic rows (right) ── */}
          <div className="flex items-stretch gap-0" style={{ height: `${bodyHeight}px` }}>

            {/* LEFT: Center Average Score Hub (bigger, vertically centered) */}
            <div className="flex flex-col items-center justify-center gap-2 shrink-0" style={{ width: '152px' }}>
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Subject Average
              </span>
              {/* Bigger gauge — 112px */}
              <CircularGauge score={avgScore} size={112} />
              <p className="text-[10px] text-muted-foreground text-center leading-tight line-clamp-2 px-2">
                {getLastReviewedText()}
              </p>
              <Button
                size="sm"
                onClick={handleReviewWeakest}
                className="w-full bg-primary hover:bg-accent text-primary-foreground font-black rounded-lg h-7 text-[11px] flex items-center justify-center gap-1"
              >
                Review <ChevronRight className="w-3 h-3" />
              </Button>
            </div>

            {/* MIDDLE: SVG branching lines
                The SVG fills the exact body height. viewBox is always 0 0 100 100.
                The hub dot sits at (2, 50) which maps to the vertical center.
                Each branch bezier fans from (2,50) to (98, targetY) where targetY
                is evenly spaced between 8% and 92% so the end dots align with topic rows. */}
            <div className="relative shrink-0" style={{ width: '60px', height: '100%' }}>
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id={`bg-${subject.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.75" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.2" />
                  </linearGradient>
                </defs>

                {/* Central hub dot at left-center */}
                <circle cx="2" cy="50" r="5.5" className="fill-primary" />

                {subject.topics.map((tp, idx) => {
                  const tScore = getEffectiveScore(tp);
                  const tColor = getKnowledgeScoreColor(tScore);
                  // Spread branches evenly: margin 8% from edges so dots align with row centres
                  const margin = topicCount === 1 ? 0 : 8;
                  const span = 100 - margin * 2;
                  const targetY = topicCount === 1
                    ? 50
                    : margin + (idx / (topicCount - 1)) * span;

                  return (
                    <g key={tp.id}>
                      {/* Bezier: hub center-left → topic row right-side */}
                      <path
                        d={`M 2 50 C 38 50, 62 ${targetY}, 98 ${targetY}`}
                        fill="none"
                        stroke={`url(#bg-${subject.id})`}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={tScore === null ? '4 3' : undefined}
                      />
                      {/* Terminal dot coloured by topic health */}
                      <circle cx="98" cy={targetY} r="4.5" style={{ fill: tColor.fill }} />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* RIGHT: Topic rows, distributed evenly across the body height */}
            <div className="flex-1 flex flex-col justify-around gap-1.5 min-w-0 py-0.5">
              {subject.topics.map((topic, topicIdx) => {
                const topicScore = getEffectiveScore(topic);
                const topicScoreColor = getKnowledgeScoreColor(topicScore);
                const topicReminder = getNextReviewReminder(topic, topicScore);

                const handleTopicReview = () => {
                  const scoreParam = topicScore === null ? '' : `&score=${topicScore}`;
                  navigate(`/quiz?subject=${encodeURIComponent(subject.name)}&topic=${encodeURIComponent(topic.name)}${scoreParam}&mode=${topic.recommendedMode ?? 'mcq'}`);
                };

                return (
                  <motion.div
                    key={topic.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + topicIdx * 0.04 }}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all cursor-default"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: topicScoreColor.fill }} />
                        <h4 className="font-bold text-foreground text-[12px] lg:text-[13px] leading-tight truncate">
                          {topic.name}
                        </h4>
                      </div>
                      {topicReminder.isUrgent && (
                        <span className="mt-0.5 ml-3.5 text-[9px] font-bold text-destructive flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />{topicReminder.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-[11px] font-black px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${topicScoreColor.fill}18`, color: topicScoreColor.fill }}
                      >
                        {formatTo2SF(topicScore)}
                      </span>
                      <Button
                        size="sm"
                        onClick={handleTopicReview}
                        className="font-bold rounded-lg h-7 px-2.5 text-[11px] bg-primary hover:bg-accent text-primary-foreground transition-all hover:-translate-y-0.5"
                      >
                        {topicScore === null ? t('dashboard.startArrow') : t('dashboard.reviewNowArrow')}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

        </CardContent>
      </Card>
    </motion.div>
  );
}
/**
 * Priority Item Row component:
 * - Implements the row list format shown in user screenshot
 * - Number circle on left (1, 2, 3...)
 * - Topic name + Subject pill badge
 * - Memory score in 2 s.f.
 * - Recovery duration (~12 mins)
 * - Next review date reminder
 * - "Start →" button pre-filling Smart Quiz
 */
export function PriorityItemRow({
  item,
  rank,
  index,
}: {
  item: AtRiskTopicInfo;
  rank: number;
  index: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reviewTime = estimateReviewTime(item.effectiveScore);
  const scoreColor = getKnowledgeScoreColor(item.effectiveScore);
  const reminder = getNextReviewReminder(item.topic, item.effectiveScore);
  const formattedScore = formatTo2SF(item.effectiveScore);

  const handleStart = () => {
    navigate(
      `/quiz?subject=${encodeURIComponent(item.subjectName)}&topic=${encodeURIComponent(item.topic.name)}&score=${item.effectiveScore}&mode=${item.topic.recommendedMode ?? 'mcq'}`
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 + index * 0.05 }}
      className="flex items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-[1.35rem] bg-card text-card-foreground border border-border/70 floaty-card shadow-[0_8px_24px_rgba(29,58,98,0.06)] hover:shadow-[0_12px_32px_rgba(29,58,98,0.12)] transition-all hover:-translate-y-0.5"
    >
      {/* Rank circle */}
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 shadow-md">
        <span className="font-black text-base sm:text-lg">{rank}</span>
      </div>

      {/* Middle: Topic details & score */}
      <div className="flex-1 min-w-0">
        {/* Top line: status dot + topic name + subject badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: scoreColor.fill }}
          />
          <span className="font-black text-foreground text-xs sm:text-sm lg:text-base uppercase tracking-tight truncate max-w-[280px] sm:max-w-none">
            {item.topic.name}
          </span>
          <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-0 text-[11px] font-bold shrink-0">
            {item.subjectIcon} {item.subjectName}
          </Badge>
        </div>

        {/* Bottom line: Memory score pill + duration + review reminder */}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs">
          <span className="text-muted-foreground font-medium">
            {t('dashboard.memoryScoreColon')}
          </span>
          <Badge
            className="border-0 text-xs font-black px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: scoreColor.fill, color: scoreColor.text }}
          >
            {formattedScore}
          </Badge>
          <span className="text-muted-foreground flex items-center gap-1 font-medium">
            <Clock className="w-3.5 h-3.5" />
            ~{reviewTime} mins
          </span>
          <span
            className={`font-bold flex items-center gap-1 ${
              reminder.isUrgent ? 'text-destructive font-black' : 'text-muted-foreground'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {reminder.label}
          </span>
        </div>
      </div>

      {/* Right: Start button */}
      <Button
        size="sm"
        onClick={handleStart}
        className="font-bold rounded-full shrink-0 bg-primary hover:bg-accent text-primary-foreground px-4 sm:px-5 h-8 sm:h-9 text-xs shadow-sm transition-all hover:-translate-y-0.5"
      >
        {t('dashboard.startArrow')}
      </Button>
    </motion.div>
  );
}

// Generate dynamic insight message
function getDynamicInsight(
  priorityQueue: PriorityQueueItem[],
  subjectSummaries: SubjectSummary[],
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  subjectName: (name: string) => string,
): string {
  const atRiskSubjects = subjectSummaries.filter((s) => s.avgScore !== null && s.avgScore < 40);
  const warningSubjects = subjectSummaries.filter(
    (s) => s.avgScore !== null && s.avgScore >= 40 && s.avgScore < 70,
  );

  if (atRiskSubjects.length > 0) {
    const worstSubject = atRiskSubjects.reduce((a, b) =>
      (a.avgScore ?? 0) < (b.avgScore ?? 0) ? a : b,
    );
    const recoveryTime = estimateReviewTime(worstSubject.avgScore ?? 0);
    return t('dashboard.insight.dropped', {
      subject: subjectName(worstSubject.name),
      score: worstSubject.avgScore ?? 0,
      minutes: recoveryTime,
    });
  }

  if (warningSubjects.length > 0) {
    const needsAttention = warningSubjects[0];
    const timeSinceReview = needsAttention.lastReviewed ?? 0;
    if (timeSinceReview >= 2) {
      return t('dashboard.insight.stale', {
        subject: subjectName(needsAttention.name),
        score: needsAttention.avgScore ?? 0,
        days: timeSinceReview,
      });
    }
  }

  if (priorityQueue.length > 0) {
    const topPriority = priorityQueue[0];
    return t('dashboard.insight.priority', {
      topic: topPriority.topic.name,
      subject: subjectName(topPriority.subjectName),
      score: topPriority.effectiveScore,
      minutes: estimateReviewTime(topPriority.effectiveScore),
    });
  }

  const totalTopics = subjectSummaries.reduce((sum, subject) => sum + subject.topics.length, 0);
  const notStartedTopics = subjectSummaries.reduce(
    (sum, subject) => sum + subject.notStartedCount,
    0,
  );
  if (notStartedTopics > 0) {
    return t('dashboard.insight.firstPath', {
      started: totalTopics - notStartedTopics,
      total: totalTopics,
    });
  }

  return t('dashboard.insight.allGood');
}

function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const localizeSubjectName = useSubjectName();
  const { data: account } = useCurrentAccount();
  const firstName = account?.user.name.split(/\s+/)[0] || 'Student';

  // Get data from atoms
  const subjectSummaries = useAtomValue(subjectSummariesAtom);
  const priorityQueue = useAtomValue(priorityQueueAtom);
  const atRiskTopics = useAtomValue(atRiskTopicsAtom);
  const subjects = useAtomValue(subjectsAtom);

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

  const [isNewUser, setIsNewUser] = useState(false);
  const [showStoryboard, setShowStoryboard] = useState(false);

  useEffect(() => {
    if (hasStudyActivity) {
      setIsNewUser(false);
      setShowStoryboard(false);
      return;
    }

    try {
      const seen = localStorage.getItem(STORYBOARD_STORAGE_KEY);
      if (!seen) {
        setIsNewUser(true);
        setShowStoryboard(true);
      } else {
        setIsNewUser(false);
        setShowStoryboard(false);
      }
    } catch {
      setIsNewUser(false);
      setShowStoryboard(false);
    }
  }, [hasStudyActivity]);

  const visibleSubjectSummaries = useMemo(() => {
    return [...subjectSummaries].sort(
      (firstSubject, secondSubject) =>
        (firstSubject.avgScore ?? Number.POSITIVE_INFINITY) -
        (secondSubject.avgScore ?? Number.POSITIVE_INFINITY),
    );
  }, [subjectSummaries]);

  // At-risk topic info with subject details
  const atRiskTopicsWithInfo: AtRiskTopicInfo[] = useMemo(() => {
    return atRiskTopics
      .map((topic: TopicData) => {
        const subject = subjects.find((s: { id: string }) => s.id === topic.subjectId);
        return {
          topic,
          subjectName: subject?.name ?? '',
          subjectIcon: subject?.icon ?? '',
          effectiveScore: getEffectiveScore(topic) ?? 0,
        };
      })
      .sort((a: AtRiskTopicInfo, b: AtRiskTopicInfo) => a.effectiveScore - b.effectiveScore);
  }, [atRiskTopics, subjects]);

  // Strictly take top 5 most at-risk topics to avoid overwhelming students
  const top5PriorityTopics = useMemo(() => {
    return atRiskTopicsWithInfo.slice(0, 5);
  }, [atRiskTopicsWithInfo]);

  // Dynamic insight
  const insightMessage = getDynamicInsight(priorityQueue, subjectSummaries, t, localizeSubjectName);

  return (
    <div className="p-5 lg:p-10 pattern-overlay">
      {/* TOP SECTION — Greeting Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-8 overflow-hidden rounded-[2rem] edunets-gradient px-6 py-8 lg:px-10 lg:py-12 shadow-[0_28px_80px_rgba(29,58,98,0.14)]"
      >
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-accent blob-soft" />
        <div className="absolute -bottom-14 left-1/3 h-40 w-40 rounded-full bg-secondary blob-soft" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="min-w-0 max-w-4xl">
            <Badge className="mb-4 rounded-full border-0 bg-primary text-primary-foreground px-4 py-1.5 font-bold">
              {t('dashboard.pulse')}
            </Badge>
            <h1 className="text-4xl lg:text-6xl font-black tracking-[-0.05em] text-primary mb-4 leading-[0.95]">
              {t(getGreetingKey())}, {firstName}.<br />{t('dashboard.subtitle')}
            </h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-foreground leading-relaxed max-w-2xl text-base lg:text-lg font-medium"
            >
              {insightMessage}
            </motion.p>
          </div>

          {/* Capture Hub shortcut */}
          <motion.button
            type="button"
            onClick={() => navigate('/capture-hub')}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="group flex w-full shrink-0 items-center gap-3 rounded-2xl border border-primary/15 bg-card/80 px-5 py-4 text-left shadow-[0_12px_32px_rgba(29,58,98,0.12)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_44px_rgba(29,58,98,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto lg:w-60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Inbox className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-primary">{t('nav.captureHub')}</span>
              <span className="block text-xs font-semibold text-muted-foreground">{t('dashboard.captureCta')}</span>
            </span>
            <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-primary transition group-hover:translate-x-0.5" aria-hidden="true" />
          </motion.button>
        </div>
      </motion.div>

      {/* SPIDEY HOMEPAGE GUIDE BANNER (ONLY FOR NEW USERS) */}
      {isNewUser && (
        <SpideyHomepageGuideBanner
          onDismiss={() => {
            setIsNewUser(false);
            try {
              localStorage.setItem(STORYBOARD_STORAGE_KEY, 'true');
            } catch {}
          }}
        />
      )}

      {/* SECTION 1: MEMORY HEALTH — By Subject & By Topics */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-10"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-8 bg-secondary rounded-full -rotate-6" />
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-primary">
              {t('dashboard.memoryHealth')}
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-semibold">
            Average memory score → topic breakdown • Concept Web for full analysis
          </span>
        </div>

        {/* Stacked layout: chemistry first, then mathematics (sorted by avgScore asc = most at risk first) */}
        <div className="space-y-5">
          {visibleSubjectSummaries.map((subject: SubjectSummary, index: number) => (
            <MemoryHealthSubjectBranchCard
              key={subject.id}
              subject={subject}
              index={index}
            />
          ))}
        </div>
      </motion.section>

      {/* SECTION 2: TODAY'S PRIORITY QUEUE (Row Format, Moved Below Memory Health) */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-10"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-8 bg-destructive rounded-full rotate-6" />
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-primary">
              {t('dashboard.priorityQueue')}
            </h2>
            <Badge className="bg-destructive/15 text-destructive border-0 text-xs font-black px-2.5 py-0.5 rounded-full">
              {t('dashboard.top5AtRisk')}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-semibold">
            {t('dashboard.priorityQueue.sorted')}
          </p>
        </div>

        {top5PriorityTopics.length > 0 ? (
          <div className="space-y-3">
            {top5PriorityTopics.map((item, index) => (
              <PriorityItemRow
                key={item.topic.id}
                item={item}
                rank={index + 1}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-border/80 bg-card p-6 text-sm font-semibold text-muted-foreground shadow-xs text-center flex flex-col items-center justify-center gap-2">
            <span className="text-2xl">🎉</span>
            <p className="font-bold text-foreground">All caught up!</p>
            <p className="text-xs max-w-md">{t('dashboard.priorityQueue.empty')}</p>
          </div>
        )}
      </motion.section>

      {/* SPIDEY WELCOME STORYBOARD MODAL (1X ONBOARDING TOUR ONLY FOR NEW USERS) */}
      {isNewUser && (
        <SpideyWelcomeStoryboardModal
          open={showStoryboard}
          onOpenChange={(open) => {
            setShowStoryboard(open);
            if (!open) {
              setIsNewUser(false);
              try {
                localStorage.setItem(STORYBOARD_STORAGE_KEY, 'true');
              } catch {}
            }
          }}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: account } = useCurrentAccount();
  const role = account?.profile?.role ?? null;

  if (isTeachingRole(role)) return <TeacherDashboardPage />;
  return <StudentDashboard />;
}
