'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveRubricTopicId } from '@/lib/discussion-rubric';
import { resolveCurriculumTopic } from '@/lib/curriculum';
import { useTranslation } from '@/lib/i18n';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { ArrowUpRight, Bell, BookOpenCheck, CheckCircle2, Crown, Flame, Flag, GraduationCap, Instagram, Loader2, Medal, Mic, Orbit, Search, Sparkles, Timer, UserPlus, Users, Zap } from 'lucide-react';
import { useAtom, useAtomValue } from 'jotai';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { getEffectiveScore, rescueNudgeLogsAtom, subjectSummariesAtom, type RescueNudgeLog } from '@/lib/study-data';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentAccount } from '@/lib/api/me';
import { createSquadQuizRoom } from '@/lib/api/squad-quiz';
import {
  createStudySquad,
  inviteSchoolUserToStudySquad,
  restoreStudySquadStreak,
  schoolDirectoryQueryKey,
  studySquadQueryKey,
  useSchoolDirectory,
  useStudySquad,
} from '@/lib/api/study-squads';
import {
  getAvatarClass,
  getInitials,
  normalizeTopic,
  type SquadMember,
  type SubjectScore,
  type WeakTopic,
} from '@/lib/squad-data';

type RescueTarget = { member: SquadMember; topic: WeakTopic };

const presetMessages = ['Wanna review this together?', "You've got this — need a hand?", "Let's team up on this one"];
const fallbackMember: SquadMember = {
  id: 'current-user',
  name: 'You',
  fullName: 'You',
  initials: 'YU',
  score: 0,
  overallMemoryScore: 0,
  streak: 0,
  color: 'white',
  subjects: [],
};

export default function StudySquadPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [squadName, setSquadName] = useState('');
  const [expanded, setExpanded] = useState<string>('');
  const [highlightedMemberId, setHighlightedMemberId] = useState<string | null>(null);
  const [highlightedSubject, setHighlightedSubject] = useState<string | null>(null);
  const [highlightedTopic, setHighlightedTopic] = useState<string | null>(null);
  const [conceptContext, setConceptContext] = useState<{ subject: string; topic: string } | null>(null);
  const [rescueTarget, setRescueTarget] = useState<RescueTarget | null>(null);
  const [rescueSprintEnabled, setRescueSprintEnabled] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(presetMessages[0]);
  const [customMessage, setCustomMessage] = useState('');
  const [rescueLogs, setRescueLogs] = useAtom(rescueNudgeLogsAtom);
  const [notifiedLogIds, setNotifiedLogIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  // The signed-in learner's local study-state cache keeps their own scores
  // immediately fresh after a quiz. Other squad members come from the
  // authenticated squad API, which calculates their decayed Memory Scores
  // from database progress without exposing email addresses.
  const { data: account } = useCurrentAccount();
  const squadQuery = useStudySquad(account?.user.id ?? null);
  const squad = squadQuery.data?.squad ?? null;
  const directoryQuery = useSchoolDirectory(
    account?.user.id ?? null,
    Boolean(squad && squad.role === 'owner'),
  );
  const createSquadMutation = useMutation({
    mutationFn: () => createStudySquad(squadName),
    onSuccess: async (result) => {
      setSquadName('');
      if (account) queryClient.setQueryData([...studySquadQueryKey, account.user.id], result);
      await queryClient.invalidateQueries({ queryKey: studySquadQueryKey });
      toast.success(`Created ${result.squad?.name ?? 'your study squad'}.`);
    },
    onError: (error) => {
      toast.error('Squad not created', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    },
  });
  const inviteMutation = useMutation({
    mutationFn: (targetUserId: string) => inviteSchoolUserToStudySquad(targetUserId),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: studySquadQueryKey }),
        queryClient.invalidateQueries({ queryKey: schoolDirectoryQueryKey }),
      ]);
      toast.success(`Invitation sent to ${result.invitation.name ?? 'your schoolmate'}.`);
    },
    onError: (error) => {
      toast.error('Invitation not sent', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    },
  });
  const restoreStreakMutation = useMutation({
    mutationFn: restoreStudySquadStreak,
    onSuccess: async (result) => {
      if (account) queryClient.setQueryData([...studySquadQueryKey, account.user.id], result);
      await queryClient.invalidateQueries({ queryKey: studySquadQueryKey });
      toast.success('Group streak restored', {
        description: 'The restored date is now saved for every squad member.',
      });
    },
    onError: (error) => {
      toast.error('Streak not restored', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    },
  });
  const filteredSchoolPeople = useMemo(() => {
    const people = directoryQuery.data?.people ?? [];
    const query = memberSearch.trim().toLowerCase();
    if (!query) return people;
    return people.filter((person) => (
      person.name.toLowerCase().includes(query)
      || person.role.toLowerCase().includes(query)
    ));
  }, [directoryQuery.data?.people, memberSearch]);
  const subjectSummaries = useAtomValue(subjectSummariesAtom);
  const currentSquadMember = squad?.members.find((member) => member.id === account?.user.id);
  const realMember = useMemo<SquadMember | null>(() => {
    if (!account) return null;
    const subjects: SubjectScore[] = subjectSummaries
      .filter((summary) => summary.avgScore !== null)
      .map((summary) => ({
        subject: summary.name,
        score: summary.avgScore ?? 0,
        topics: summary.topics.filter((topic) => topic.memoryScore !== null).map((topic) => topic.name),
      }));
    const overall = subjects.length > 0
      ? Math.round(subjects.reduce((sum, entry) => sum + entry.score, 0) / subjects.length)
      : 0;
    const fullName = account.user.name || 'You';
    return {
      id: account.user.id,
      name: fullName.trim().split(/\s+/)[0] || fullName,
      fullName,
      initials: getInitials(fullName),
      score: overall,
      overallMemoryScore: overall,
      streak: currentSquadMember?.streakDays ?? 0,
      color: 'white',
      subjects,
    };
  }, [account, currentSquadMember?.streakDays, subjectSummaries]);
  const allMembers = useMemo<SquadMember[]>(() => {
    if (!squad) return realMember ? [realMember] : [fallbackMember];
    const colors = ['yellow', 'blue', 'white'] as const;
    return squad.members.map((member, index) => {
      if (member.id === realMember?.id) return realMember;
      const score = member.overallMemoryScore ?? 0;
      return {
        id: member.id,
        name: member.name.trim().split(/\s+/)[0] || member.name,
        fullName: member.name,
        initials: getInitials(member.name),
        score,
        overallMemoryScore: score,
        streak: member.streakDays,
        color: colors[index % colors.length] ?? 'white',
        subjects: member.subjects.map((subject) => ({
          subject: subject.name,
          score: subject.score,
          topics: subject.topics.map((topic) => topic.name),
        })),
      };
    });
  }, [realMember, squad]);
  const realWeakTopics = useMemo<WeakTopic[]>(() => {
    if (!account) return [];
    return subjectSummaries.flatMap((summary) => summary.topics
      .filter((topic) => {
        const effective = getEffectiveScore(topic);
        return effective !== null && effective < 40;
      })
      .map((topic) => ({
        id: `${account.user.id}-${topic.id}`,
        topicId: topic.id,
        topic: topic.name,
        subject: summary.name,
        memberId: account.user.id,
        score: getEffectiveScore(topic) as number,
      })));
  }, [account, subjectSummaries]);
  const allWeakTopics = useMemo(() => {
    const storedWeakTopics: WeakTopic[] = squad?.members.flatMap((member) => (
      member.id === account?.user.id ? [] : member.subjects.flatMap((subject) => (
        subject.topics
          .filter((topic) => topic.score < 40)
          .map((topic) => ({
            id: `${member.id}-${topic.id}`,
            topicId: topic.id,
            topic: topic.name,
            subject: subject.name,
            memberId: member.id,
            score: topic.score,
          }))
      ))
    )) ?? [];
    return [...storedWeakTopics, ...realWeakTopics];
  }, [account?.user.id, realWeakTopics, squad?.members]);
  const getMemberById = useCallback(
    (id: string) => allMembers.find((member) => member.id === id) ?? allMembers[0] ?? fallbackMember,
    [allMembers],
  );

  const activeRescueByMember = useMemo(() => {
    const now = Date.now();
    return rescueLogs.reduce<Record<string, RescueNudgeLog>>((accumulator: Record<string, RescueNudgeLog>, log: RescueNudgeLog) => {
      const isFresh = now - log.createdAt < 24 * 60 * 60 * 1000;
      if (log.pendingRescue && log.rescueStatus === 'pending' && isFresh) accumulator[log.memberId] = log;
      return accumulator;
    }, {});
  }, [rescueLogs]);

  const latestCompletedRescue = useMemo(() => {
    return rescueLogs.find((log: RescueNudgeLog) => log.rescueStatus === 'completed' && log.resolvedAt && Date.now() - log.resolvedAt < 3500) ?? null;
  }, [rescueLogs]);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const rankedMembers = useMemo(() => [...allMembers].sort((a: SquadMember, b: SquadMember) => b.score - a.score), [allMembers]);
  const selectedMember = rankedMembers.find((member: SquadMember) => member.id === selectedMemberId) ?? rankedMembers[0] ?? fallbackMember;

  const submitCreateSquad = () => {
    if (!squadName.trim()) {
      toast.error('Give your squad a name first.');
      return;
    }
    createSquadMutation.mutate();
  };

  useEffect(() => {
    const friendId = searchParams.get('friendId');
    const subject = searchParams.get('subject');
    const topic = searchParams.get('topic');
    if (!friendId && !subject && !topic) return;
    const resolvedTopic = topic ? resolveCurriculumTopic(topic) : undefined;
    const canonicalTopic = resolvedTopic?.name ?? topic;
    const canonicalSubject = resolvedTopic
      ? (resolvedTopic.subjectId === 'e-math' ? 'Mathematics' : 'Chemistry')
      : subject;

    if (canonicalSubject && canonicalTopic) {
      setConceptContext({ subject: canonicalSubject, topic: canonicalTopic });
    }

    const targetMember = rankedMembers.find((member: SquadMember) => member.id === friendId);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('friendId');
    nextParams.delete('subject');
    nextParams.delete('topic');
    setSearchParams(nextParams, { replace: true });

    if (!targetMember) return;

    setSelectedMemberId(targetMember.id);
    setExpanded(targetMember.id);
    setHighlightedMemberId(targetMember.id);
    setHighlightedSubject(canonicalSubject);
    setHighlightedTopic(canonicalTopic);

    window.setTimeout(() => {
      rowRefs.current[targetMember.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);

    const clearHighlight = window.setTimeout(() => {
      setHighlightedMemberId((current: string | null) => current === targetMember.id ? null : current);
      setHighlightedSubject(null);
      setHighlightedTopic(null);
    }, 1700);

    return () => window.clearTimeout(clearHighlight);
  }, [rankedMembers, searchParams, setSearchParams]);

  useEffect(() => {
    const now = Date.now();
    setRescueLogs((currentLogs: RescueNudgeLog[]) => currentLogs.map((log: RescueNudgeLog) => {
      if (log.rescueStatus === 'pending' && now - log.createdAt >= 24 * 60 * 60 * 1000) {
        return { ...log, pendingRescue: false, rescueStatus: 'expired', resolvedAt: now };
      }
      return log;
    }));
  }, [setRescueLogs]);

  useEffect(() => {
    const nextLog = rescueLogs.find((log: RescueNudgeLog) => log.rescueStatus === 'pending' && !notifiedLogIds.includes(log.id));
    if (!nextLog) return;
    const roomId = nextLog.roomId;

    toast.info(`${nextLog.senderName} sent you a 10-Minute Rescue — ${nextLog.topic}`, {
      description: 'Start 10-Min Rescue →',
      ...(roomId ? { action: {
        label: 'Start',
        onClick: () => navigate(`/rescue-join?roomId=${encodeURIComponent(roomId)}`),
      } } : {}),
    });
    setNotifiedLogIds((currentIds: string[]) => [...currentIds, nextLog.id]);
  }, [navigate, notifiedLogIds, rescueLogs]);

  const openRescueDialog = (member: SquadMember, topic: WeakTopic) => {
    setRescueTarget({ member, topic });
    setRescueSprintEnabled(true);
    setSelectedMessage(presetMessages[0]);
    setCustomMessage('');
    setSendState('idle');
  };

  // The rubric is keyed by catalog Topic id. Deriving it from subject + Topic
  // name keeps squad records and legacy links on the same parent. null means
  // this Topic has no rubric, and the entry
  // point is hidden rather than opening a room that could not score anything.
  const discussionTopicId = useMemo(
    () => (rescueTarget ? resolveRubricTopicId(rescueTarget.topic.subject, rescueTarget.topic.topic) : null),
    [rescueTarget],
  );

  const startTopicDiscussion = useCallback((subject: string, topicName: string) => {
    const rubricTopicId = resolveRubricTopicId(subject, topicName);
    if (!rubricTopicId) return;
    const query = new URLSearchParams({ topicId: rubricTopicId, topic: topicName, subject });
    setRescueTarget(null);
    navigate(`/revision-room?${query.toString()}`);
  }, [navigate]);

  const openConceptWeb = useCallback((subject?: string, topicName?: string) => {
    const query = new URLSearchParams();
    if (subject) query.set('subject', subject);
    if (topicName) query.set('topic', topicName);
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    setRescueTarget(null);
    navigate(`/concept-web${suffix}`);
  }, [navigate]);

  const openDiscussionRoom = useCallback(() => {
    if (!rescueTarget) return;
    startTopicDiscussion(rescueTarget.topic.subject, rescueTarget.topic.topic);
  }, [rescueTarget, startTopicDiscussion]);

  const closeRescueDialog = () => {
    if (sendState === 'sending') return;
    setRescueTarget(null);
  };

  const startRescueRoom = async (target: RescueTarget, message: string) => {
    const result = await createSquadQuizRoom({
      topicId: target.topic.topicId,
      invitedUserIds: [target.member.id],
      message,
    });
    const roomId = result.room.id;
    const now = Date.now();
    const nextLog: RescueNudgeLog = {
      id: `${target.member.id}-${target.topic.id}-${now}`,
      memberId: target.member.id,
      memberName: target.member.name,
      senderName: account?.user.name ?? 'You',
      subject: target.topic.subject,
      topic: target.topic.topic,
      message,
      pendingRescue: true,
      rescueStatus: 'pending',
      roomId,
      createdAt: now,
    };

    setRescueLogs((currentLogs: RescueNudgeLog[]) => [nextLog, ...currentLogs]);
    toast.success('Rescue room started', {
      description: `${target.member.name} gets a join screen before entering question 1.`,
    });
    setRescueTarget(null);
    setSendState('idle');
    navigate(`/rescue-room?roomId=${encodeURIComponent(roomId)}&role=host`);
  };

  const sendRescueNudge = async () => {
    if (!rescueTarget) return;

    setSendState('sending');
    const message = customMessage.trim() || selectedMessage;
    if (rescueSprintEnabled) {
      try {
        await startRescueRoom(rescueTarget, message);
      } catch (error) {
        setSendState('error');
        toast.error('Rescue room not started', {
          description: error instanceof Error ? error.message : 'Try again in a moment.',
        });
      }
      return;
    }

    const now = Date.now();
    const nextLog: RescueNudgeLog = {
      id: `${rescueTarget.member.id}-${rescueTarget.topic.id}-${now}`,
      memberId: rescueTarget.member.id,
      memberName: rescueTarget.member.name,
      senderName: account?.user.name ?? 'You',
      subject: rescueTarget.topic.subject,
      topic: rescueTarget.topic.topic,
      message,
      pendingRescue: false,
      rescueStatus: 'completed',
      createdAt: now,
    };
    setRescueLogs((currentLogs: RescueNudgeLog[]) => [nextLog, ...currentLogs]);
    setSendState('success');
    toast.success('Nudge sent', {
      description: `${rescueTarget.member.name} gets your message.`,
    });
    setRescueTarget(null);
    setSendState('idle');
  };

  const shareRecap = () => {
    toast.success('Story recap ready', { description: 'Your 9:16 Memory Score recap is ready for Instagram Stories.' });
  };



  return (
    <div className="pattern-overlay bg-background p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="card-shadow border-border bg-card text-card-foreground">
            <CardContent className="p-6 lg:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="max-w-2xl">
                  <Badge className="mb-4 rounded-full border-0 bg-secondary text-secondary-foreground">Study Squad</Badge>
                  <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">Keep your squad learning together</h1>
                  <p className="mt-3 text-muted-foreground">Invite friends, compare memory scores, and send 10-minute rescues before streaks break.</p>
                  {/* The general entry: any topic, not only the ones the squad
                      is currently weak at. Goes to the room's own picker. */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() => navigate('/revision-room')}
                      className="rounded-full bg-primary text-primary-foreground hover:bg-accent"
                    >
                      <Mic className="mr-2 h-4 w-4" /> Start a Revision Room
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openConceptWeb()}
                      className="rounded-full border-primary text-foreground hover:bg-secondary"
                    >
                      <Orbit className="mr-2 h-4 w-4" /> {t('squad.openConceptWeb')}
                    </Button>
                  </div>
                  {conceptContext && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-accent/40 bg-accent/15 px-4 py-3 text-sm">
                      <span className="font-black">{t('squad.fromConceptWeb')}</span>
                      <span className="font-semibold">{conceptContext.subject} · {conceptContext.topic}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openConceptWeb(conceptContext.subject, conceptContext.topic)}
                        className="ml-auto rounded-full"
                      >
                        {t('squad.backToBubble')} <ArrowUpRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[2rem] bg-primary text-primary-foreground shadow-lg">
                  <Users className="h-12 w-12" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Users className="h-5 w-5" /> Your real squad</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {squadQuery.isPending ? (
                <div className="flex items-center gap-2 rounded-[18px] bg-secondary p-4 text-sm font-bold text-secondary-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your squad…
                </div>
              ) : squadQuery.error ? (
                <div className="rounded-[18px] border border-destructive/30 bg-destructive/10 p-4">
                  <p className="text-sm font-bold">Couldn’t load your squad.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void squadQuery.refetch()} className="mt-3 rounded-full">Try again</Button>
                </div>
              ) : !squad ? (
                <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); submitCreateSquad(); }}>
                  <div>
                    <label htmlFor="squad-name" className="mb-2 block text-sm font-bold">Create your first squad</label>
                    <Input
                      id="squad-name"
                      value={squadName}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSquadName(event.target.value)}
                      placeholder="The Memory Makers"
                      maxLength={80}
                      className="rounded-full"
                    />
                  </div>
                  <Button type="submit" disabled={createSquadMutation.isPending} className="w-full rounded-full bg-primary text-primary-foreground">
                    {createSquadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create squad
                  </Button>
                </form>
              ) : (
                <>
                  <div className="rounded-[18px] bg-secondary p-4 text-secondary-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black">{squad.name}</p>
                        <p className="text-sm font-semibold">{squad.members.length} of 5 members</p>
                      </div>
                      <Badge className="rounded-full border-0 bg-card text-card-foreground">{squad.role}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {squad.members.map((member) => (
                        <span key={member.id} className="rounded-full bg-card px-3 py-1 text-xs font-bold text-card-foreground">
                          {member.name}{member.role === 'owner' ? ' · owner' : ''}
                        </span>
                      ))}
                    </div>
                  </div>

                  {squad.role === 'owner' && (
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="school-member-search" className="block text-sm font-bold">Find people at your school</label>
                        <p className="mt-1 text-xs text-muted-foreground">{directoryQuery.data?.school.name ?? 'Your school'} · emails stay private</p>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="school-member-search"
                          type="search"
                          value={memberSearch}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setMemberSearch(event.target.value)}
                          placeholder="Search by name or role"
                          className="rounded-full pl-9"
                        />
                      </div>

                      {directoryQuery.isPending ? (
                        <div className="flex items-center gap-2 py-4 text-sm font-bold text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading school directory…</div>
                      ) : directoryQuery.error ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => void directoryQuery.refetch()} className="rounded-full">Retry directory</Button>
                      ) : (
                        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                          {filteredSchoolPeople.length === 0 ? (
                            <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No matching school accounts.</p>
                          ) : filteredSchoolPeople.map((person) => (
                            <div key={person.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                                {person.role === 'teacher' ? <GraduationCap className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black">{person.name}</p>
                                <p className="text-xs capitalize text-muted-foreground">{person.role.replace('_', ' ')}</p>
                              </div>
                              {person.canInvite ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={inviteMutation.isPending}
                                  onClick={() => inviteMutation.mutate(person.id)}
                                  className="rounded-full"
                                >
                                  {inviteMutation.isPending && inviteMutation.variables === person.id
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    : <UserPlus className="mr-2 h-4 w-4" />}
                                  Invite
                                </Button>
                              ) : (
                                <Badge variant="outline" className="rounded-full">
                                  {person.status === 'teacher' ? 'Ask Teacher'
                                    : person.status === 'member' ? 'Member'
                                      : person.status === 'invited' ? 'Invited'
                                        : 'In another squad'}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {squad.pendingInvitations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Pending invitations</p>
                      {squad.pendingInvitations.map((invitation) => (
                        <div key={invitation.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-semibold">{invitation.name ?? invitation.email}</span>
                          <Badge variant="outline" className="rounded-full">Pending</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="card-shadow border-border bg-card text-card-foreground">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-xl"><Medal className="h-5 w-5" /> Leaderboard</CardTitle>
              <Badge className="rounded-full border-0 bg-primary text-primary-foreground">Top 5</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {rankedMembers.map((member: SquadMember, index: number) => {
                const pendingRescue = activeRescueByMember[member.id];
                const justCompleted = latestCompletedRescue?.memberId === member.id;
                return (
                  <button
                    ref={(element: HTMLButtonElement | null) => { rowRefs.current[member.id] = element; }}
                    key={member.id}
                    onClick={() => { setSelectedMemberId(member.id); setExpanded(expanded === member.id ? '' : member.id); setHighlightedMemberId(null); setHighlightedSubject(null); setHighlightedTopic(null); }}
                    className={`w-full rounded-[18px] border p-4 text-left text-foreground transition hover:bg-accent hover:text-accent-foreground ${highlightedMemberId === member.id ? 'border-accent bg-accent/25' : 'border-border bg-background'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-[18px] border border-border font-bold ${getAvatarClass(member.color)}`}>{member.initials}</div>
                        {index === 0 && <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Crown className="h-4 w-4" /></span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">
                          {index + 1}. {member.name}
                          {member.id === realMember?.id && (
                            <>{' '}<Badge className="ml-1 rounded-full border-0 bg-primary text-primary-foreground align-middle">You</Badge></>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground"><Flame className="mr-1 inline h-4 w-4" /> {member.streak}-day streak</p>
                      </div>
                      {pendingRescue && <Badge className="rounded-full border-0 bg-secondary text-secondary-foreground">Rescue sent ⏳</Badge>}
                      {justCompleted && <Badge className="rounded-full border-0 bg-primary text-primary-foreground">Rescued! ✓</Badge>}
                      <p className="text-2xl font-bold">{member.score}%</p>
                    </div>
                    {expanded === member.id && (
                      <div className="mt-4 space-y-3 rounded-[18px] bg-card p-4 text-card-foreground">
                        {member.subjects.map((subject: SubjectScore) => {
                          const subjectMatches = highlightedMemberId === member.id && highlightedSubject === subject.subject;
                          const topicMatches = subjectMatches && highlightedTopic && subject.topics?.some((topic: string) => normalizeTopic(topic) === normalizeTopic(highlightedTopic));
                          return (
                            <div key={subject.subject} className={`rounded-xl p-2 transition-colors ${subjectMatches ? 'bg-accent/25' : ''}`}>
                              <div className="mb-1 flex justify-between text-sm font-semibold"><span>{subject.subject}</span><span>{subject.score}%</span></div>
                              <Progress value={subject.score} className="h-2" />
                              {topicMatches && <p className="mt-2 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{highlightedTopic}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="card-shadow border-border bg-card text-card-foreground">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Bell className="h-5 w-5" /> Where your squad struggles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {allWeakTopics.length === 0 && (
                  <div className="rounded-[18px] border border-dashed border-border bg-background p-5 text-sm font-semibold text-muted-foreground">
                    No at-risk topics yet. Scores below 40% will appear here for squad rescue.
                  </div>
                )}
                {allWeakTopics.map((topic: WeakTopic) => {
                  const member = getMemberById(topic.memberId);
                  return (
                    <div key={topic.id} className="rounded-[18px] border-l-4 border-l-destructive bg-background p-4 text-foreground">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{topic.topic}</p>
                          <p className="text-sm text-muted-foreground">{topic.subject} · {member.name} scored {topic.score}%</p>
                        </div>
                        <Badge className="border-0 bg-destructive text-primary-foreground">At risk</Badge>
                      </div>
                      {/* The discussion entry sits outside this branch on
                          purpose. Once a rescue has been sent the card swaps to
                          "Open Rescue Room" and the rescue dialog becomes
                          unreachable -- so an entry point that only lived in
                          that dialog disappeared exactly for the topics the
                          squad is working on hardest. */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {activeRescueByMember[member.id] ? (
                          <>
                            <Badge className="rounded-full border-0 bg-secondary text-secondary-foreground">Rescue sent ⏳</Badge>
                            <Button
                              disabled={!activeRescueByMember[member.id]?.roomId}
                              onClick={() => {
                                const roomId = activeRescueByMember[member.id]?.roomId;
                                if (roomId) navigate(`/rescue-join?roomId=${encodeURIComponent(roomId)}`);
                              }}
                              size="sm"
                              className="rounded-full bg-primary text-primary-foreground hover:bg-accent"
                            >
                              Open Rescue Room
                            </Button>
                          </>
                        ) : (
                          <Button onClick={() => openRescueDialog(member, topic)} size="sm" className="rounded-full bg-accent text-accent-foreground hover:bg-primary">
                            <Bell className="mr-2 h-4 w-4" /> Rescue {member.name}
                          </Button>
                        )}
                        {resolveRubricTopicId(topic.subject, topic.topic) && (
                          <Button
                            onClick={() => startTopicDiscussion(topic.subject, topic.topic)}
                            size="sm"
                            variant="outline"
                            className="rounded-full border-primary text-foreground hover:bg-secondary"
                          >
                            <Mic className="mr-2 h-4 w-4" /> Discuss
                          </Button>
                        )}
                        <Button
                          onClick={() => openConceptWeb(topic.subject, topic.topic)}
                          size="sm"
                          variant="outline"
                          className="rounded-full border-primary text-foreground hover:bg-secondary"
                        >
                          <Orbit className="mr-2 h-4 w-4" /> {t('squad.viewInConceptWeb')}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="card-shadow border-border bg-card text-card-foreground">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Group streak</p>
                    <p className="text-4xl font-bold tracking-tight">{squad?.streak.currentDays ?? 0} days</p>
                    <p className="text-sm text-muted-foreground">
                      {squad?.streak.restoresUsedThisMonth ?? 0} of {squad?.streak.restoresLimit ?? 5} restores used this month
                    </p>
                    {squad && !squad.streak.activeToday && (
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">Complete a quiz today to keep it going.</p>
                    )}
                  </div>
                  <div className="flex h-20 w-20 items-center justify-center rounded-[18px] bg-primary text-primary-foreground">
                    <Flame className="h-10 w-10" />
                  </div>
                </div>
                <Button
                  onClick={() => restoreStreakMutation.mutate()}
                  disabled={!squad?.streak.canRestore || restoreStreakMutation.isPending}
                  className="mt-5 w-full rounded-full bg-primary text-primary-foreground hover:bg-accent"
                >
                  {restoreStreakMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {squad?.streak.canRestore && squad.streak.restoreDate
                    ? `Restore ${squad.streak.restoreDate}`
                    : squad && squad.streak.restoresUsedThisMonth >= squad.streak.restoresLimit
                      ? 'Monthly limit reached'
                      : 'No restore needed'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>



        <Card className="card-shadow overflow-hidden border-0 bg-card text-card-foreground">
          <CardContent className="grid gap-8 p-6 lg:grid-cols-[0.62fr_0.38fr] lg:p-8">
            <div className="space-y-5">
              <Badge className="rounded-full border-0 bg-accent text-accent-foreground"><Sparkles className="mr-2 h-4 w-4" /> Story ready</Badge>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-foreground">Memory Score Recap</h2>
                <p className="mt-2 max-w-xl text-muted-foreground">A vertical, share-ready recap styled like a learning Wrapped card for Instagram Stories.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] bg-secondary p-4 text-secondary-foreground">
                  <p className="text-sm font-bold">Squad rank</p>
                  <p className="mt-1 text-3xl font-black">#2</p>
                </div>
                <div className="rounded-[18px] bg-primary p-4 text-primary-foreground">
                  <p className="text-sm font-bold">Best streak</p>
                  <p className="mt-1 text-3xl font-black">18d</p>
                </div>
                <div className="rounded-[18px] bg-accent p-4 text-accent-foreground">
                  <p className="text-sm font-bold">Top score</p>
                  <p className="mt-1 text-3xl font-black">92%</p>
                </div>
              </div>
              <Button onClick={shareRecap} className="rounded-full bg-primary text-primary-foreground hover:bg-accent"><Instagram className="mr-2 h-4 w-4" /> Post in Story</Button>
            </div>

            <div className="mx-auto w-full max-w-[330px]">
              <div className="relative aspect-[9/16] overflow-hidden rounded-[2rem] bg-primary p-5 text-primary-foreground shadow-[0_28px_80px_rgba(29,58,98,0.28)]">
                <div className="absolute -right-16 -top-12 h-44 w-44 rounded-full bg-accent" />
                <div className="absolute -bottom-12 -left-14 h-48 w-48 rounded-full bg-secondary" />

                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <Badge className="rounded-full border-0 bg-secondary text-secondary-foreground">EduNets Wrapped</Badge>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-card-foreground"><Zap className="h-5 w-5" /></div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-bold text-primary-foreground">This week, your squad remembered</p>
                    <h3 className="text-6xl font-black leading-none tracking-[-0.08em] text-primary-foreground">86%</h3>
                    <p className="max-w-[14rem] text-lg font-black leading-tight text-primary-foreground">of your strongest topics before they faded.</p>
                  </div>

                  <div className="space-y-3">
                    {selectedMember.subjects.slice(0, 3).map((subject: SubjectScore, index: number) => (
                      <div key={subject.subject} className="rounded-2xl bg-card p-3 text-card-foreground shadow-lg">
                        <div className="mb-2 flex items-center justify-between text-sm font-black"><span>{index + 1}. {subject.subject}</span><span>{subject.score}%</span></div>
                        <Progress value={subject.score} className="h-2" />
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[1.5rem] bg-secondary p-4 text-secondary-foreground">
                    <div className="flex items-center gap-3">
                      <BookOpenCheck className="h-8 w-8" />
                      <div>
                        <p className="text-xs font-bold">Top learner</p>
                        <p className="text-2xl font-black">{selectedMember.name}</p>
                      </div>
                      <ArrowUpRight className="ml-auto h-6 w-6" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={rescueTarget !== null} onOpenChange={(open: boolean) => { if (!open) closeRescueDialog(); }}>
          <DialogContent className="max-w-[430px] overflow-hidden border-border bg-card p-0 text-card-foreground">
            {rescueTarget && (
              <div className="relative">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-secondary" />
                <div className="absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-accent" />
                <div className="relative space-y-5 p-6">
                  <DialogHeader className="text-left">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-primary text-primary-foreground shadow-lg">
                        {sendState === 'success' ? <CheckCircle2 className="h-10 w-10" /> : <Timer className="h-10 w-10" />}
                        <span className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><Flag className="h-4 w-4" /></span>
                      </div>
                      <Badge className="rounded-full border-0 bg-destructive text-primary-foreground">10-min rescue</Badge>
                    </div>
                    <DialogTitle className="text-2xl font-black tracking-tight">Send {rescueTarget.member.name} a 10-Minute Rescue?</DialogTitle>
                    <DialogDescription className="text-muted-foreground">Help your squad protect today&apos;s streak with one tiny, targeted sprint.</DialogDescription>
                  </DialogHeader>

                  <div className="rounded-[1.5rem] bg-primary p-4 text-primary-foreground">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Flame className="h-9 w-9" />
                        <div>
                          <p className="text-sm font-bold">Group streak</p>
                          <p className="text-3xl font-black">{squad?.streak.currentDays ?? 0} days</p>
                        </div>
                      </div>
                      <div className="rounded-full bg-secondary px-3 py-2 text-sm font-black text-secondary-foreground">Day {(squad?.streak.currentDays ?? 0) + 1}</div>
                    </div>
                    <p className="mt-3 text-sm font-bold text-primary-foreground">Complete this Rescue quiz to protect today&apos;s streak.</p>
                  </div>

                  <div className="rounded-[1.25rem] border border-border bg-background p-4 text-foreground">
                    <p className="font-bold">About: {rescueTarget.topic.topic} — {rescueTarget.topic.score}%</p>
                    <p className="mt-1 text-sm text-muted-foreground">{rescueTarget.topic.subject} rescue for {rescueTarget.member.name}</p>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-[1.25rem] bg-secondary p-4 text-secondary-foreground">
                    <div>
                      <p className="font-black">Attach a live 10-min {rescueTarget.topic.topic} room</p>
                      <p className="text-sm font-semibold">Invite opens a join screen first; sender can enter question 1 now.</p>
                    </div>
                    <Switch checked={rescueSprintEnabled} onCheckedChange={setRescueSprintEnabled} aria-label="Attach rescue room" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {presetMessages.map((message: string) => (
                        <Button
                          key={message}
                          type="button"
                          variant={selectedMessage === message ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedMessage(message)}
                          className="rounded-full"
                        >
                          {message}
                        </Button>
                      ))}
                    </div>
                    <Textarea
                      value={customMessage}
                      onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setCustomMessage(event.target.value)}
                      placeholder="Add a quick note..."
                      className="min-h-20 rounded-[1rem]"
                    />
                  </div>

                  {sendState === 'error' && <p className="rounded-xl bg-destructive p-3 text-sm font-bold text-primary-foreground">Couldn&apos;t send this nudge. Try again.</p>}

                  <div className="space-y-2">
                    <Button onClick={sendRescueNudge} disabled={sendState === 'sending' || sendState === 'success'} className="w-full rounded-full bg-primary text-primary-foreground hover:bg-accent">
                      {sendState === 'sending' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {sendState === 'success' && <CheckCircle2 className="mr-2 h-4 w-4" />}
                      {sendState === 'success' ? 'Sent' : rescueSprintEnabled ? 'Send Rescue Nudge' : 'Send Nudge'}
                    </Button>

                    {/* The second way out of this dialog: instead of nudging
                        someone else to revise, explain the topic yourself and
                        get it checked. Hidden rather than disabled when the
                        topic has no rubric -- a room that cannot score anything
                        would return a blank review with no error. */}
                    {discussionTopicId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openDiscussionRoom}
                        className="w-full rounded-full border-primary text-foreground hover:bg-secondary"
                      >
                        <Mic className="mr-2 h-4 w-4" />
                        Start a {rescueTarget.topic.topic} Revision Room
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openConceptWeb(rescueTarget.topic.subject, rescueTarget.topic.topic)}
                      className="w-full rounded-full border-primary text-foreground hover:bg-secondary"
                    >
                      <Orbit className="mr-2 h-4 w-4" />
                      {t('squad.viewTopicInConceptWeb', { topic: rescueTarget.topic.topic })}
                    </Button>
                    <p className="text-center text-xs font-semibold text-muted-foreground">
                      Send a 10-minute rescue, or explain the topic out loud yourself.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
