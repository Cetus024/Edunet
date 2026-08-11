'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ChevronRight, MessageCircle, Share2, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from '@/lib/navigation';
import { useCurrentAccount } from '@/lib/api/me';
import { useEnquiryUnreadCount } from '@/lib/api/enquiries';
import { useTeacherStudents } from '@/lib/api/teacher-students';
import { useTeacherClassPulse, type TopicHealth } from '@/lib/api/teacher-class-pulse';
import { useTeachingContext } from '@/lib/teaching-context';

type RankedAction = {
  id: string;
  sourceLabel: string;
  sourceIcon: LucideIcon;
  urgency: number;
  headline: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

const STATUS_DOT: Record<TopicHealth['status'], string> = {
  critical: 'bg-destructive',
  warning: 'bg-[#EAA93C]',
  ok: 'bg-[#186636]',
  unstarted: 'bg-muted-foreground/40',
};

export default function TeacherDashboardPage() {
  const navigate = useNavigate();
  const { data: account } = useCurrentAccount();
  const { activeScopeId, activeScope } = useTeachingContext();
  const firstName = account?.user.name.split(/\s+/)[0] || 'there';
  const { data: rosterData } = useTeacherStudents({ scopeId: activeScopeId });
  const { unreadCount } = useEnquiryUnreadCount({
    userId: account?.user.id ?? null,
    enabled: Boolean(account?.onboardingCompleted),
  });
  const {
    data: pulse,
    isLoading: pulseLoading,
    error: pulseError,
  } = useTeacherClassPulse({ enabled: Boolean(account?.onboardingCompleted), scopeId: activeScopeId });

  const students = useMemo(() => rosterData?.students ?? [], [rosterData]);
  const topics = pulse?.topics ?? [];

  // Ranked purely from real, computed data - how many of a teacher's own
  // students are below mastery on a real topic (from their actual concept
  // web scores), and how many students are actually waiting on a reply.
  // No fabricated "AI explanation review queue" or class-section grouping:
  // neither exists in the data model, so rather than invent numbers for
  // them this only ranks what can genuinely be measured today.
  const rankedActions = useMemo<RankedAction[]>(() => {
    const topicActions: RankedAction[] = topics
      .filter((topic) => topic.studentsStarted > 0 && topic.status !== 'ok')
      .map((topic) => ({
        id: `topic-${topic.topicId}`,
        sourceLabel: 'Concept Web',
        sourceIcon: Share2,
        urgency: Math.round((topic.studentsBelowMastery / topic.studentsStarted) * 100),
        headline: `Re-teach ${topic.topicName} — ${topic.studentsBelowMastery} of ${topic.studentsStarted} below mastery`,
        description: `Review where ${topic.topicName} is breaking down in Concept Web, then plan a focused re-teach.`,
        actionLabel: 'Open Concept Web',
        onAction: () => navigate('/concept-web'),
      }))
      .sort((first, second) => second.urgency - first.urgency);

    const messageAction: RankedAction[] = unreadCount > 0 ? [{
      id: 'messages',
      sourceLabel: 'Messages',
      sourceIcon: MessageCircle,
      urgency: Math.min(99, 50 + unreadCount * 12),
      headline: `${unreadCount} student${unreadCount === 1 ? '' : 's'} ${unreadCount === 1 ? 'is' : 'are'} waiting on a reply`,
      description: 'Open the inbox, answer the newest questions, and clear the unread queue.',
      actionLabel: 'Open Messages',
      onAction: () => navigate('/ask-teacher'),
    }] : [];

    return [...topicActions, ...messageAction]
      .sort((first, second) => second.urgency - first.urgency)
      .slice(0, 4);
  }, [navigate, topics, unreadCount]);

  const hotspotCount = topics.filter((topic) => topic.status === 'critical').length;

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-gradient-to-br from-primary/15 to-transparent p-6">
        <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Welcome back, {firstName}</p>
        <h1 className="mt-1 text-2xl font-black text-foreground">{activeScope?.classroomName ?? 'Your classroom'} at a glance</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          {activeScope?.subjectName ? `${activeScope.subjectName}: ` : ''}Everyone at your school who picked this subject during setup shows up here automatically - no manual
          roster to keep up to date.
        </p>
      </motion.div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-foreground">Ranked actions</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sorted by urgency across teacher tools, not by feature.</p>
          </div>
          {rankedActions.length > 0 && (
            <Badge className="rounded-full border-0 bg-primary text-primary-foreground">
              Top {rankedActions.length}
            </Badge>
          )}
        </div>

        {pulseLoading && <p className="text-sm text-muted-foreground">Reading your roster's real progress…</p>}
        {pulseError && (
          <p className="text-sm text-destructive">
            {pulseError instanceof Error ? pulseError.message : 'Could not load your class pulse.'}
          </p>
        )}
        {!pulseLoading && !pulseError && rankedActions.length === 0 && (
          <Card className="border-0 rounded-2xl card-shadow">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nothing urgent right now — no students below mastery on a started topic, and no unread messages.
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {rankedActions.map((action, index) => {
            const SourceIcon = action.sourceIcon;
            return (
              <motion.button
                key={action.id}
                type="button"
                onClick={action.onAction}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex w-full items-start gap-4 rounded-2xl bg-secondary/60 p-5 text-left transition hover:-translate-y-0.5 hover:bg-secondary"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1 rounded-full border-border bg-card text-xs font-bold text-foreground">
                      <SourceIcon className="h-3 w-3" aria-hidden="true" /> {action.sourceLabel}
                    </Badge>
                    <Badge className="rounded-full border-0 bg-accent/15 text-xs font-bold text-accent">
                      Urgency {action.urgency}
                    </Badge>
                  </div>
                  <p className="font-black text-foreground">{action.headline}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 self-center text-sm font-bold text-primary">
                  {action.actionLabel} <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-foreground">Class Pulse</h2>
            <p className="mt-1 text-sm text-muted-foreground">A quick read on which topic needs attention today.</p>
          </div>
          {topics.length > 0 && (
            <Badge variant="outline" className="rounded-full border-border bg-card text-xs font-bold text-foreground">
              {topics.length} topics
            </Badge>
          )}
        </div>

        {!pulseLoading && !pulseError && topics.length === 0 && (
          <Card className="border-0 rounded-2xl card-shadow">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No students at your school have picked your subject during setup yet. Once they do, their real
              progress shows up here.
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {topics.map((topic) => (
            <Card key={topic.topicId} className="border-0 rounded-2xl card-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-foreground">{topic.topicName}</p>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[topic.status]}`} aria-hidden="true" />
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/concept-web')}
                  className="mt-2 block text-left text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Open Concept Web
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/concept-web')}
                  className="mt-3 flex items-center gap-1 text-sm font-bold text-primary"
                >
                  View topic map <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => navigate('/concept-web')} className="text-left">
          <Card className="border-0 rounded-2xl card-shadow transition hover:-translate-y-0.5">
            <CardContent className="p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-bold text-muted-foreground">Concept Web</p>
              <p className="text-2xl font-black text-foreground">{hotspotCount} hotspot{hotspotCount === 1 ? '' : 's'}</p>
              <p className="text-xs text-muted-foreground">Topics most students are below mastery on</p>
            </CardContent>
          </Card>
        </button>
        <button type="button" onClick={() => navigate('/ask-teacher')} className="text-left">
          <Card className="border-0 rounded-2xl card-shadow transition hover:-translate-y-0.5">
            <CardContent className="p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/20 text-accent">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-bold text-muted-foreground">Messages</p>
              <p className="text-2xl font-black text-foreground">{unreadCount} unread</p>
              <p className="text-xs text-muted-foreground">Student questions needing replies</p>
            </CardContent>
          </Card>
        </button>
        <Card className="border-0 rounded-2xl card-shadow">
          <CardContent className="p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Users className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-bold text-muted-foreground">Roster</p>
            <p className="text-2xl font-black text-foreground">{students.length} students</p>
            <p className="text-xs text-muted-foreground">Your full class list</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-foreground">Your students</h2>
        </div>
        {students.length === 0 ? (
          <Card className="border-0 rounded-2xl card-shadow">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No students at your school have picked your subject during setup yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {students.map((student) => (
              <Card key={student.id} className="border-0 rounded-2xl card-shadow">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-bold text-foreground">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>
                  {student.topicName
                    ? <Badge variant="secondary">Latest: {student.topicName}</Badge>
                    : <Badge variant="outline" className="text-muted-foreground">Not started yet</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
