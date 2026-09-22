'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Clock, GraduationCap, Mail, TrendingDown, User, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useChildProgress } from '@/lib/api/parent';
import { useCurrentAccount } from '@/lib/api/me';
import { getEffectiveScore, isAtRisk, type SubjectData, type TopicData } from '@/lib/study-data';

function getScoreTone(score: number | null) {
  if (score === null) return { text: 'text-muted-foreground', bg: 'bg-muted', label: 'Not started' };
  if (score >= 70) return { text: 'text-foreground', bg: 'bg-primary', label: 'On track' };
  if (score >= 40) return { text: 'text-foreground', bg: 'bg-accent', label: 'Needs review' };
  return { text: 'text-foreground', bg: 'bg-destructive', label: 'At risk' };
}

function PendingChildCard({ childName, childEmail }: { childName: string; childEmail: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UserRound className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="text-xl font-black text-foreground">Waiting for {childName || 'your child'} to join</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        You linked <span className="font-bold text-foreground">{childEmail}</span> during setup, but no EduNets
        account with that email exists yet (or it hasn&apos;t finished onboarding). As soon as they sign up and
        complete setup with this exact email, their real progress will show up here automatically.
      </p>
    </div>
  );
}

export default function ParentDashboardPage() {
  const { data: account } = useCurrentAccount();
  const firstName = account?.user.name.split(/\s+/)[0] || 'there';
  const { data, isLoading, error } = useChildProgress();

  const startedSubjects = useMemo(() => {
    if (!data?.subjects) return [];
    return data.subjects
      .map((subject: SubjectData) => {
        const startedTopics = subject.topics.filter((topic: TopicData) => topic.memoryScore !== null);
        if (startedTopics.length === 0) return null;
        const scores = startedTopics.map((topic) => getEffectiveScore(topic) ?? 0);
        const avgScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
        return { subject, avgScore, startedCount: startedTopics.length };
      })
      .filter((entry): entry is { subject: SubjectData; avgScore: number; startedCount: number } => entry !== null)
      .sort((a, b) => a.avgScore - b.avgScore);
  }, [data]);

  const atRiskTopics = useMemo(() => {
    if (!data?.subjects) return [];
    return data.subjects.flatMap((subject: SubjectData) => subject.topics
      .filter((topic) => isAtRisk(topic))
      .map((topic) => ({ subject, topic, score: getEffectiveScore(topic) ?? 0 })))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-muted-foreground">
        Loading your child&apos;s progress…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-xl font-black text-foreground">Couldn&apos;t load your child&apos;s progress</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Please try again in a moment.'}
        </p>
      </div>
    );
  }

  if (data.status === 'pending' || !data.child) {
    return <PendingChildCard childName={data.childName} childEmail={data.childEmail} />;
  }

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-gradient-to-br from-primary/10 to-transparent p-6">
        <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Good to see you, {firstName}</p>
        <h1 className="mt-1 text-2xl font-black text-foreground">{data.child.name}&apos;s progress</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Mail className="h-3.5 w-3.5" aria-hidden="true" /> {data.child.email}
        </p>
      </motion.div>

      {data.tutors.length > 0 && (
        <Card className="border-0 rounded-3xl card-shadow">
          <CardContent className="flex flex-wrap items-center gap-3 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                {data.tutors.length > 1 ? 'Their teachers' : 'Their teacher'}
              </p>
              <p className="text-sm font-bold text-foreground">
                {data.tutors.map((tutor) => `${tutor.name} (${tutor.role === 'tutor' ? 'Tutor' : 'Teacher'})`).join(', ')}
                {data.tutors[0]?.subjectName ? ` · ${data.tutors[0].subjectName}` : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-black text-foreground">Memory health by subject</h2>
        {startedSubjects.length === 0 ? (
          <Card className="border-0 rounded-3xl card-shadow">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <User className="h-5 w-5 shrink-0" aria-hidden="true" />
              {data.child.name} hasn&apos;t started reviewing any topics yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {startedSubjects.map(({ subject, avgScore, startedCount }) => {
              const tone = getScoreTone(avgScore);
              return (
                <Card key={subject.id} className="border-0 rounded-2xl card-shadow">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-2xl" aria-hidden="true">{subject.icon}</span>
                      <Badge variant="secondary" className="text-[10px]">{tone.label}</Badge>
                    </div>
                    <p className="font-black text-foreground">{subject.name}</p>
                    <p className="mt-1 text-2xl font-black text-foreground">{avgScore}%</p>
                    <p className="mt-1 text-xs text-muted-foreground">{startedCount} topic{startedCount === 1 ? '' : 's'} started</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {atRiskTopics.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-foreground">
            <TrendingDown className="h-5 w-5 text-destructive" aria-hidden="true" /> Topics that need attention
          </h2>
          <div className="space-y-2">
            {atRiskTopics.map(({ subject, topic, score }) => (
              <Card key={topic.id} className="border-0 rounded-2xl card-shadow">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl" aria-hidden="true">{subject.icon}</span>
                    <div>
                      <p className="font-bold text-foreground">{topic.name}</p>
                      <p className="text-xs text-muted-foreground">{subject.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {topic.lastReviewedAt && (
                      <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        Last reviewed {new Date(topic.lastReviewedAt).toLocaleDateString()}
                      </span>
                    )}
                    <Badge className="bg-destructive text-white">{score}%</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
