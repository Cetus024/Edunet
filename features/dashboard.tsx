'use client';

import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { ChevronRight, Flame, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import Image from 'next/image';
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
  isAtRisk as isReviewDue,
  atRiskTopicsAtom,
  subjectsAtom,
  type SubjectSummary,
  type PriorityQueueItem,
  type TopicData,
} from '@/lib/study-data';

// Get greeting based on time of day
function getGreetingKey(): TranslationKey {
  const hour = new Date().getHours();
  if (hour < 12) return 'dashboard.greeting.morning';
  if (hour < 17) return 'dashboard.greeting.afternoon';
  return 'dashboard.greeting.evening';
}

// At-risk topic info for the alert cards
interface AtRiskTopicInfo {
  topic: TopicData;
  subjectName: string;
  subjectIcon: string;
  effectiveScore: number;
}

// Topic Alert Card component
function TopicAlertCard({ info, index }: { info: AtRiskTopicInfo; index: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reviewTime = estimateReviewTime(info.effectiveScore);
  const scoreColor = getKnowledgeScoreColor(info.effectiveScore);

  const handleReviewNow = () => {
    // Navigate to quiz with subject, topic, and the exact displayed memory score pre-filled
    navigate(`/quiz?subject=${encodeURIComponent(info.subjectName)}&topic=${encodeURIComponent(info.topic.name)}&score=${info.effectiveScore}&mode=${info.topic.recommendedMode ?? 'mcq'}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08, duration: 0.4 }}
      className="flex-shrink-0 w-[280px]"
    >
      <Card className="border-0 rounded-[1.35rem] overflow-hidden floaty-card bg-card text-card-foreground border-l-4 border-l-destructive">
        <CardContent className="p-4">
          {/* Top: Subject indicator */}
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            <span className="text-xs text-muted-foreground font-medium">
              {info.subjectIcon} {info.subjectName}
            </span>
          </div>

          {/* Middle: Topic name */}
          <h4 className="font-black text-foreground text-base mb-3">
            {info.topic.name}
          </h4>

          {/* Progress bar with score */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{t('dashboard.memoryScore')}</span>
              <span className="text-xs font-black text-foreground">{info.effectiveScore}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${info.effectiveScore}%` }}
                transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
                className="h-full rounded-full"
                style={{ backgroundColor: scoreColor.fill }}
              />
            </div>
          </div>

          {/* Bottom: Spider message and button */}
          <div className="bg-secondary text-secondary-foreground rounded-2xl p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-card-foreground shadow-sm">
              <Image src="/branding/spidey-icon.png" alt="" width={380} height={380} className="h-6 w-6 select-none" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs italic font-bold leading-snug">
                {t('dashboard.couldRecover', { minutes: reviewTime })}
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleReviewNow}
              className="flex-shrink-0 bg-primary hover:bg-accent text-primary-foreground font-bold rounded-full h-8 text-xs px-3 transition-all hover:-translate-y-0.5"
            >
              {t('dashboard.reviewNowArrow')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Circular gauge uses the same continuous score scale as every other view.
function CircularGauge({ score, size = 100 }: { score: number | null; size?: number }) {
  const { t } = useTranslation();
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const displayScore = score ?? 0;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;
  const color = getKnowledgeScoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background circle - changes color based on score severity */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color.background}
          strokeWidth={10}
        />
        {/* Progress circle - what the student has retained */}
        {score !== null && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color.fill}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          />
        )}
      </svg>
      {/* Score text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {score !== null ? (
          <motion.span
            className="text-2xl font-bold"
            style={{ color: color.fill }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}%
          </motion.span>
        ) : (
          <motion.span
            className="text-[10px] font-semibold text-muted-foreground text-center px-1 leading-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {t('dashboard.notStarted')}
          </motion.span>
        )}
      </div>
    </div>
  );
}

// Subject card with visual indicators based on memory score
function SubjectCard({ subject, index }: {
  subject: SubjectSummary; 
  index: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const score = subject.avgScore;
  const reviewDue = subject.atRiskCount > 0;
  const isAtRisk = reviewDue && score !== null && score < 30;
  const needsReview = reviewDue && !isAtRisk;
  const isOnTrack = score !== null && !reviewDue;

  // Handle review button click
  const handleReviewClick = () => {
    const reviewCandidates = subject.atRiskCount > 0 ? subject.topics.filter(isReviewDue) : subject.topics;
    const topicsWithScores = reviewCandidates
      .filter((topic: TopicData) => topic.memoryScore !== null)
      .map((entry: TopicData) => ({
        name: entry.name,
        score: getEffectiveScore(entry) ?? 0,
        mode: entry.recommendedMode ?? 'mcq',
      }));
    topicsWithScores.sort((a, b) => a.score - b.score);
    const topicToReview = topicsWithScores[0] ?? {
      name: subject.topics[0]?.name ?? '',
      score: null,
      mode: subject.topics[0]?.recommendedMode ?? 'mcq',
    };
    if (!topicToReview.name) return;
    const scoreParameter = topicToReview.score === null ? '' : `&score=${topicToReview.score}`;
    navigate(`/quiz?subject=${encodeURIComponent(subject.name)}&topic=${encodeURIComponent(topicToReview.name)}${scoreParameter}&mode=${topicToReview.mode}`);
  };

  // Format last reviewed text based on memory strength
  const getLastReviewedText = () => {
    if (score === null) return t('dashboard.notStartedCount', { count: subject.notStartedCount });
    if (subject.lastReviewed === null) return t('dashboard.lastReviewed.none');
    if (subject.lastReviewed <= 0) return t('dashboard.lastReviewed.today');
    if (subject.lastReviewed === 1) return t('dashboard.lastReviewed.yesterday');
    return t('dashboard.lastReviewed.days', { days: subject.lastReviewed });
  };

  // Get card glow class based on score
  const getCardGlowClass = () => {
    if (isAtRisk) return 'at-risk-pulse';
    if (needsReview) return 'needs-review-glow';
    return '';
  };

  // Get button styles based on score
  const getButtonClass = () => {
    if (isAtRisk) {
      return 'bg-destructive hover:bg-destructive text-destructive-foreground';
    }
    if (needsReview) {
      return 'bg-accent hover:bg-primary text-accent-foreground hover:text-primary-foreground';
    }
    return 'bg-primary hover:bg-accent text-primary-foreground';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.06, duration: 0.4 }}
      className="flex-shrink-0"
    >
      <Card
        className={`relative w-[190px] border-0 rounded-[1.5rem] overflow-hidden floaty-card transition-all duration-300 bg-card text-card-foreground ${getCardGlowClass()}`}
      >
        {/* Status Badge - positioned top right */}
        {isAtRisk && (
          <div className="absolute top-2 right-2 z-10">
            <span className="bg-destructive text-destructive-foreground text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
              {t('dashboard.atRisk')}
            </span>
          </div>
        )}
        {needsReview && (
          <div className="absolute top-2 right-2 z-10">
            <span className="bg-accent text-accent-foreground text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
              {t('dashboard.needsReview')}
            </span>
          </div>
        )}
        {isOnTrack && (
          <div className="absolute top-2 right-2 z-10">
            <span className="bg-primary text-primary-foreground text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
              ✓ On Track
            </span>
          </div>
        )}

        <CardContent className="p-4 pt-8 flex flex-col items-center">
          {/* Subject name */}
          <div className="flex items-center gap-2 mb-3 w-full">
            <span className="text-lg">{subject.icon}</span>
            <span className="font-black text-foreground text-sm truncate">{subject.name}</span>
          </div>
          
          {/* Circular gauge - use display score for specific subjects */}
          <CircularGauge score={score} size={88} />
          
          {/* Last reviewed */}
          <p className="text-[11px] text-muted-foreground mt-3 text-center h-8 flex items-center">
            {getLastReviewedText()}
          </p>
          
          {/* Review button */}
          <Button
            size="sm"
            onClick={handleReviewClick}
            className={`mt-2 w-full font-semibold rounded-xl h-9 text-xs ${getButtonClass()}`}
          >
            {score === null ? t('dashboard.startTopic') : t('dashboard.reviewNow')} <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface PriorityDisplayItem {
  id: string;
  topicName: string;
  subjectName: string;
  subjectIcon: string;
  memoryScore: number;
  reviewTime: number;
  recommendedMode: 'mcq' | 'essay';
}

function PriorityItemRow({
  item,
  index,
  rank
}: {
  item: PriorityDisplayItem;
  index: number;
  rank: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scoreColor = getKnowledgeScoreColor(item.memoryScore);

  const handleStart = () => {
    navigate(`/quiz?subject=${encodeURIComponent(item.subjectName)}&topic=${encodeURIComponent(item.topicName)}&score=${item.memoryScore}&mode=${item.recommendedMode}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.08 }}
      className="flex items-center gap-4 p-4 rounded-[1.35rem] bg-card text-card-foreground floaty-card"
    >
      {/* Rank circle */}
      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 shadow-lg">
        <span className="font-black text-lg">{rank}</span>
      </div>

      {/* Topic info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: scoreColor.fill }} />
          <span className="font-bold text-foreground">{item.topicName}</span>
          <Badge className="bg-secondary text-secondary-foreground border-0 text-xs font-bold shrink-0">
            {item.subjectIcon} {item.subjectName}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1.5 ml-4">
          <span className="text-xs text-muted-foreground">{t('dashboard.memoryScoreColon')}</span>
          <Badge 
            className="border-0 text-xs font-bold"
            style={{ backgroundColor: scoreColor.fill, color: scoreColor.text }}
          >
            {item.memoryScore}%
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            ~{item.reviewTime} mins
          </span>
        </div>
      </div>

      {/* Start button */}
      <Button
        size="sm"
        onClick={handleStart}
        className="font-bold rounded-full shrink-0 bg-primary hover:bg-accent text-primary-foreground transition-all hover:-translate-y-0.5"
      >
        {t('dashboard.startArrow')}
      </Button>
    </motion.div>
  );
}

// Generate dynamic insight message.
//
// Takes the translator rather than returning a key, because each branch below
// builds one sentence out of live numbers. Assembling these from fragments
// would not survive translation — Chinese orders the subject, the figure and
// the recommendation differently from English — so the whole sentence is the
// translation unit and the values are interpolated into it.
function getDynamicInsight(
  priorityQueue: PriorityQueueItem[],
  subjectSummaries: SubjectSummary[],
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  subjectName: (name: string) => string,
): string {
  // Find subject with biggest drop or lowest score
  const atRiskSubjects = subjectSummaries.filter(s => s.avgScore !== null && s.avgScore < 40);
  const warningSubjects = subjectSummaries.filter(s => s.avgScore !== null && s.avgScore >= 40 && s.avgScore < 70);
  
  if (atRiskSubjects.length > 0) {
    const worstSubject = atRiskSubjects.reduce((a, b) => 
      (a.avgScore ?? 0) < (b.avgScore ?? 0) ? a : b
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
  const localizeSubjectName = useSubjectName();
  const { data: account } = useCurrentAccount();
  const firstName = account?.user.name.split(/\s+/)[0] || 'Student';

  // Get data from atoms
  const subjectSummaries = useAtomValue(subjectSummariesAtom);
  const priorityQueue = useAtomValue(priorityQueueAtom);
  const atRiskTopics = useAtomValue(atRiskTopicsAtom);
  const subjects = useAtomValue(subjectsAtom);
  const visibleSubjectSummaries = useMemo(() => {
    return [...subjectSummaries].sort(
      (firstSubject, secondSubject) =>
        (firstSubject.avgScore ?? Number.POSITIVE_INFINITY) -
        (secondSubject.avgScore ?? Number.POSITIVE_INFINITY),
    );
  }, [subjectSummaries]);

  const visiblePriorityItems = useMemo<PriorityDisplayItem[]>(() => {
    return priorityQueue.map((item) => ({
      id: item.topic.id,
      topicName: item.topic.name,
      subjectName: item.subjectName,
      subjectIcon: item.subjectIcon,
      memoryScore: item.effectiveScore,
      reviewTime: estimateReviewTime(item.effectiveScore),
      recommendedMode: item.topic.recommendedMode ?? 'mcq',
    }));
  }, [priorityQueue]);

  // Get at-risk topic info with subject details
  const atRiskTopicsWithInfo: AtRiskTopicInfo[] = atRiskTopics.map((topic: TopicData) => {
    const subject = subjects.find((s: { id: string }) => s.id === topic.subjectId);
    return {
      topic,
      subjectName: subject?.name ?? '',
      subjectIcon: subject?.icon ?? '',
      effectiveScore: getEffectiveScore(topic) ?? 0,
    };
  }).sort((a: AtRiskTopicInfo, b: AtRiskTopicInfo) => a.effectiveScore - b.effectiveScore);

  const streakStats = useMemo(() => {
    const startedTopics = subjects.flatMap((subject) => subject.topics).filter((topic) => topic.memoryScore !== null);
    const scores = startedTopics
      .map((topic) => getEffectiveScore(topic))
      .filter((score): score is number => score !== null);
    const reviewedToday = startedTopics.some((topic) => {
      if (!topic.lastReviewedAt) return false;
      const reviewed = new Date(topic.lastReviewedAt);
      const today = new Date();
      return reviewed.toDateString() === today.toDateString();
    });
    return {
      days: reviewedToday ? 1 : 0,
      topicsReviewed: startedTopics.length,
      avgScore: scores.length
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : 0,
    };
  }, [subjects]);

  // Dynamic insight
  const insightMessage = getDynamicInsight(priorityQueue, subjectSummaries, t, localizeSubjectName);

  // CSS for glow animations based on score thresholds
  const glowStyles = `
    @keyframes pulse-glow-red {
      0%, 100% { 
        box-shadow: 0 0 18px rgba(217, 95, 89, 0.32), 0 18px 45px rgba(29, 58, 98, 0.12); 
      }
      50% { 
        box-shadow: 0 0 28px rgba(217, 95, 89, 0.45), 0 28px 70px rgba(29, 58, 98, 0.16); 
      }
    }
    .at-risk-pulse {
      animation: pulse-glow-red 1.5s ease-in-out infinite;
    }
    .needs-review-glow {
      box-shadow: 0 0 24px rgba(100, 134, 181, 0.24), 0 18px 45px rgba(29, 58, 98, 0.12);
    }
  `;

  return (
    <div className="p-5 lg:p-10 pattern-overlay">
      <style>{glowStyles}</style>
      
      {/* TOP SECTION — Greeting */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-8 overflow-hidden rounded-[2rem] edunets-gradient px-6 py-8 lg:px-10 lg:py-12 shadow-[0_28px_80px_rgba(29,58,98,0.14)]"
      >
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-accent blob-soft" />
        <div className="absolute -bottom-14 left-1/3 h-40 w-40 rounded-full bg-secondary blob-soft" />
        <div className="relative max-w-4xl">
          <Badge className="mb-4 rounded-full border-0 bg-primary text-primary-foreground px-4 py-1.5 font-bold">{t('dashboard.pulse')}</Badge>
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
      </motion.div>

      {/* AT-RISK TOPIC CARDS */}
      {atRiskTopicsWithInfo.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="mb-10"
        >
          {/* Horizontal scrollable container */}
          <div className="relative -mx-6 lg:-mx-8 px-6 lg:px-8">
            <div 
              className="flex gap-4 overflow-x-auto pb-4" 
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {atRiskTopicsWithInfo.slice(0, 3).map((info, index) => (
                <TopicAlertCard key={info.topic.id} info={info} index={index} />
              ))}
            </div>
            {/* Gradient fade on right edge */}
            {atRiskTopicsWithInfo.length > 2 && (
              <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none lg:hidden" />
            )}
          </div>
        </motion.section>
      )}

      {/* SECTION 1 — Memory Health by Subject */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-10"
      >
        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-primary mb-4 flex items-center gap-2">
          <span className="w-3 h-8 bg-secondary rounded-full rotate-6" />
          {t('dashboard.memoryHealth')}
        </h2>
        
        {/* Horizontal scrollable container */}
        <div className="relative -mx-6 lg:-mx-8 px-6 lg:px-8">
          <div 
            className="flex gap-4 overflow-x-auto pb-4" 
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {visibleSubjectSummaries.map((subject: SubjectSummary, index: number) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                index={index}
              />
            ))}
          </div>
          {/* Gradient fade on right edge */}
          <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none lg:hidden" />
        </div>
      </motion.section>

      {/* SECTION 2 — Today's Priority Queue */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mb-10"
      >
        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-primary mb-4 flex items-center gap-2">
          <span className="w-3 h-8 bg-accent rounded-full -rotate-6" />
          {t('dashboard.priorityQueue')}
        </h2>
        
        {/* Urgency label */}
        <p className="text-xs text-muted-foreground italic mb-3">
          {t('dashboard.priorityQueue.sorted')}
        </p>
        
        <div className="space-y-3">
          {visiblePriorityItems.map((item: PriorityDisplayItem, index: number) => (
            <PriorityItemRow key={item.id} item={item} index={index} rank={index + 1} />
          ))}
          {visiblePriorityItems.length === 0 && (
            <div className="rounded-[1.35rem] border border-border bg-card p-5 text-sm font-semibold text-muted-foreground shadow-sm">
              {t('dashboard.priorityQueue.empty')}
            </div>
          )}
        </div>
      </motion.section>

      {/* SECTION 3 — Your Streak */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-primary mb-4 flex items-center gap-2">
          <span className="w-3 h-8 bg-secondary rounded-full rotate-6" />
          {t('dashboard.streak')}
        </h2>
        
        <div className="flex flex-wrap gap-3">
          {/* Streak days */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground shadow-lg"
          >
            <Flame className="w-5 h-5" />
            <span className="font-bold">{streakStats.days}-day streak</span>
          </motion.div>

          {/* Topics reviewed */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-accent-foreground shadow-lg"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-bold">{streakStats.topicsReviewed} topics reviewed</span>
          </motion.div>

          {/* Average score */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-secondary text-secondary-foreground shadow-lg"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="font-bold">Avg score: {streakStats.avgScore}%</span>
          </motion.div>
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
