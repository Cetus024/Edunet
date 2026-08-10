'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { ArrowUpRight, Bell, BookOpenCheck, CheckCircle2, Copy, Crown, Flame, Flag, Instagram, Loader2, Mail, Medal, Send, Sparkles, Timer, Users, Zap } from 'lucide-react';
import { useAtom, useAtomValue } from 'jotai';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { getEffectiveScore, quizRoomParticipantsAtom, quizRoomsAtom, rescueNudgeLogsAtom, subjectSummariesAtom, type AvatarColor, type QuizRoomDraft, type QuizRoomParticipantDraft, type RescueNudgeLog } from '@/lib/study-data';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/hooks/use-user';
import { useCurrentAccount } from '@/lib/api/me';
import {
  getAvatarClass,
  getInitials,
  normalizeTopic,
  squadMembers,
  weakTopics,
  type SquadMember,
  type SubjectScore,
  type WeakTopic,
} from '@/lib/squad-data';

type RescueTarget = { member: SquadMember; topic: WeakTopic };

const presetMessages = ['Wanna review this together?', "You've got this — need a hand?", "Let's team up on this one"];

function createRoomId(target: RescueTarget, now: number): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${target.member.id}-${target.topic.id}-${now}`;
}

export default function StudySquadPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedMemberId, setSelectedMemberId] = useState('maya');
  const [inviteEmail, setInviteEmail] = useState('');
  const [expanded, setExpanded] = useState<string>('maya');
  const [highlightedMemberId, setHighlightedMemberId] = useState<string | null>(null);
  const [highlightedSubject, setHighlightedSubject] = useState<string | null>(null);
  const [highlightedTopic, setHighlightedTopic] = useState<string | null>(null);
  const [rescueTarget, setRescueTarget] = useState<RescueTarget | null>(null);
  const [rescueSprintEnabled, setRescueSprintEnabled] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(presetMessages[0]);
  const [customMessage, setCustomMessage] = useState('');
  const [rescueLogs, setRescueLogs] = useAtom(rescueNudgeLogsAtom);
  const [, setQuizRooms] = useAtom(quizRoomsAtom);
  const [, setQuizRoomParticipants] = useAtom(quizRoomParticipantsAtom);

  const [notifiedLogIds, setNotifiedLogIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const { data: user } = useUser();
  const currentUserId = user?.userPrincipalName ?? user?.objectId ?? 'maya';
  const currentUserName = user?.fullName?.trim() || 'Maya';
  const hostAvatarColor: AvatarColor = 'Yellow';
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  // The 5 squad members above are display-only demo data (no backend table
  // for squads yet). This puts the actual signed-in account into the same
  // leaderboard/weak-topics views, built from their real subjectsAtom
  // progress, so "your squad" genuinely includes you alongside the demo
  // roster rather than just showing 5 strangers.
  const { data: account } = useCurrentAccount();
  const subjectSummaries = useAtomValue(subjectSummariesAtom);
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
      streak: 0,
      color: 'white',
      subjects,
    };
  }, [account, subjectSummaries]);
  const allMembers = useMemo<SquadMember[]>(
    () => (realMember ? [...squadMembers, realMember] : squadMembers),
    [realMember],
  );
  const realWeakTopics = useMemo<WeakTopic[]>(() => {
    if (!account) return [];
    return subjectSummaries.flatMap((summary) => summary.topics
      .filter((topic) => {
        const effective = getEffectiveScore(topic);
        return effective !== null && effective < 40;
      })
      .map((topic) => ({
        id: `${account.user.id}-${topic.id}`,
        topic: topic.name,
        subject: summary.name,
        memberId: account.user.id,
        score: getEffectiveScore(topic) as number,
      })));
  }, [account, subjectSummaries]);
  const allWeakTopics = useMemo(() => [...weakTopics, ...realWeakTopics], [realWeakTopics]);
  const getMemberById = useCallback(
    (id: string) => allMembers.find((member) => member.id === id) ?? allMembers[0],
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
  const selectedMember = rankedMembers.find((member: SquadMember) => member.id === selectedMemberId) ?? rankedMembers[0];

  const sendInvite = () => {
    toast.success(inviteEmail ? `Invite sent to ${inviteEmail}` : 'Invite ready to send');
    setInviteEmail('');
  };

  const copyReferral = () => {
    toast.success('Referral code copied');
  };

  useEffect(() => {
    const friendId = searchParams.get('friendId');
    if (!friendId) return;

    const subject = searchParams.get('subject');
    const topic = searchParams.get('topic');
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
    setHighlightedSubject(subject);
    setHighlightedTopic(topic);

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

    toast.info(`${nextLog.senderName} sent you a 10-Minute Rescue — ${nextLog.topic}`, {
      description: 'Start 10-Min Rescue →',
      action: {
        label: 'Start',
        onClick: () => navigate(`/rescue-join?roomId=${encodeURIComponent(nextLog.roomId ?? 'demo-room-chemical-bonding')}`),
      },
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

  const closeRescueDialog = () => {
    if (sendState === 'sending') return;
    setRescueTarget(null);
  };

  const startRescueRoom = (target: RescueTarget, message: string) => {
    const now = Date.now();
    const roomId = createRoomId(target, now);
    const nextRoom: QuizRoomDraft = {
      roomId,
      hostUserId: currentUserId,
      hostName: currentUserName,
      invitedName: target.member.name,
      subject: target.topic.subject,
      topic: target.topic.topic,
      questionSetId: `${target.topic.id}-rescue`,
      status: 'active',
      currentQuestionIndex: 0,
      roundNumber: 1,
      totalRounds: 3,
      questionStartedAt: now,
      createdAt: now,
    };
    const hostParticipant: QuizRoomParticipantDraft = {
      participantId: `${currentUserId}-${roomId}`,
      roomId,
      userId: currentUserId,
      displayName: currentUserName,
      avatarColor: hostAvatarColor,
      score: 0,
      lastAnswerCorrect: false,
      joinedAt: now,
    };
    const nextLog: RescueNudgeLog = {
      id: `${target.member.id}-${target.topic.id}-${now}`,
      memberId: target.member.id,
      memberName: target.member.name,
      senderName: currentUserName,
      subject: target.topic.subject,
      topic: target.topic.topic,
      message,
      pendingRescue: true,
      rescueStatus: 'pending',
      roomId,
      createdAt: now,
    };

    setQuizRooms((currentRooms: QuizRoomDraft[]) => [
      nextRoom,
      ...currentRooms.filter((room: QuizRoomDraft) => room.roomId !== roomId),
    ]);
    setQuizRoomParticipants((currentParticipants: QuizRoomParticipantDraft[]) => [
      hostParticipant,
      ...currentParticipants.filter((participant: QuizRoomParticipantDraft) => !(
        participant.roomId === roomId && participant.userId === currentUserId
      )),
    ]);
    setRescueLogs((currentLogs: RescueNudgeLog[]) => [nextLog, ...currentLogs]);
    toast.success('Rescue room started', {
      description: `${target.member.name} gets a join screen before entering question 1.`,
    });
    setRescueTarget(null);
    setSendState('idle');
    navigate(`/rescue-room?roomId=${encodeURIComponent(roomId)}&role=host`);
  };

  const sendRescueNudge = () => {
    if (!rescueTarget) return;

    setSendState('sending');
    const message = customMessage.trim() || selectedMessage;
    if (rescueSprintEnabled) {
      startRescueRoom(rescueTarget, message);
      return;
    }

    const now = Date.now();
    const nextLog: RescueNudgeLog = {
      id: `${rescueTarget.member.id}-${rescueTarget.topic.id}-${now}`,
      memberId: rescueTarget.member.id,
      memberName: rescueTarget.member.name,
      senderName: currentUserName,
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
                </div>
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[2rem] bg-primary text-primary-foreground shadow-lg">
                  <Users className="h-12 w-12" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow border-border bg-card text-card-foreground">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><Mail className="h-5 w-5" /> Invite + referral</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={inviteEmail} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(event.target.value)} placeholder="friend@gmail.com" className="rounded-full" />
                <Button onClick={sendInvite} size="icon" className="rounded-full bg-primary text-primary-foreground"><Send className="h-4 w-4" /></Button>
              </div>
              <div className="rounded-[18px] bg-secondary p-4 text-secondary-foreground">
                <p className="text-sm font-semibold">Referral code</p>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-full bg-card px-4 py-3 text-card-foreground">
                  <span className="font-bold tracking-wide">EDUNETS-5DAY</span>
                  <Button onClick={copyReferral} variant="ghost" size="icon-sm" className="rounded-full"><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
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
                      {activeRescueByMember[member.id] ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge className="rounded-full border-0 bg-secondary text-secondary-foreground">Rescue sent ⏳</Badge>
                          <Button onClick={() => navigate(`/rescue-join?roomId=${encodeURIComponent(activeRescueByMember[member.id]?.roomId ?? 'demo-room-chemical-bonding')}`)} size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-accent">
                            Open Rescue Room
                          </Button>
                        </div>
                      ) : (
                        <Button onClick={() => openRescueDialog(member, topic)} className="mt-4 rounded-full bg-accent text-accent-foreground hover:bg-primary">
                          <Bell className="mr-2 h-4 w-4" /> Rescue {member.name}
                        </Button>
                      )}
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
                    <p className="text-4xl font-bold tracking-tight">18 days</p>
                    <p className="text-sm text-muted-foreground">2 of 5 restores used this month</p>
                  </div>
                  <div className="flex h-20 w-20 items-center justify-center rounded-[18px] bg-primary text-primary-foreground">
                    <Flame className="h-10 w-10" />
                  </div>
                </div>
                <Button onClick={() => toast.success('Streak restored')} className="mt-5 w-full rounded-full bg-primary text-primary-foreground hover:bg-accent">Restore Streak</Button>
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
                          <p className="text-3xl font-black">18 days <span className="text-primary-foreground">+1</span></p>
                        </div>
                      </div>
                      <div className="rounded-full bg-secondary px-3 py-2 text-sm font-black text-secondary-foreground">Day 19</div>
                    </div>
                    <p className="mt-3 text-sm font-bold text-primary-foreground">1 rescue away from Day 19</p>
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

                  <Button onClick={sendRescueNudge} disabled={sendState === 'sending' || sendState === 'success'} className="w-full rounded-full bg-primary text-primary-foreground hover:bg-accent">
                    {sendState === 'sending' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {sendState === 'success' && <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {sendState === 'success' ? 'Sent' : rescueSprintEnabled ? 'Send Rescue Nudge' : 'Send Nudge'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
