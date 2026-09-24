'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Flame,
  Loader2,
  LogOut,
  RotateCcw,
  Send,
  Trophy,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';

import { useMascotFeedback } from '@/features/mascot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrentAccount } from '@/lib/api/me';
import {
  advanceSquadQuizRoom,
  heartbeatSquadQuizRoom,
  inviteSquadQuizParticipants,
  restartSquadQuizRoom,
  squadQuizRoomQueryKey,
  useSquadQuizRoom,
  type SquadQuizAvatarColor,
  type SquadQuizRoom,
} from '@/lib/api/squad-quiz';
import { useStudySquad } from '@/lib/api/study-squads';
import { useTranslation, type TranslationKey } from '@/lib/i18n';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import type { SquadQuizParticipantPresence } from '@/lib/api/squad-quiz';

import { SolutionWhiteboard, WorkReview } from '@/features/solution-whiteboard';
import { submitLearningWork, useLearningWork } from '@/lib/api/learning-work';

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'SN';
}

function avatarClass(color: SquadQuizAvatarColor): string {
  if (color === 'Yellow') return 'bg-secondary text-secondary-foreground';
  if (color === 'LightBlue') return 'bg-accent text-accent-foreground';
  return 'bg-card text-card-foreground';
}

const PRESENCE_KEYS: Record<SquadQuizParticipantPresence, TranslationKey> = {
  invited: 'revision.presence.invited',
  online: 'revision.presence.online',
  away: 'revision.presence.away',
  finished: 'revision.presence.finished',
  left: 'revision.presence.left',
};

function setRoomCache(
  queryClient: ReturnType<typeof useQueryClient>,
  roomId: string,
  userId: string,
  result: { room: SquadQuizRoom },
) {
  queryClient.setQueryData([...squadQuizRoomQueryKey, roomId, userId], result);
}

export default function RescueRoomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useMascotFeedback();
  const { data: account } = useCurrentAccount();
  const roomId = searchParams.get('roomId') ?? searchParams.get('ctxRoomId');
  const userId = account?.user.id ?? null;
  const roomQuery = useSquadQuizRoom(roomId, userId);
  const squadQuery = useStudySquad(userId);
  const room = roomQuery.data?.room ?? null;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([]);
  const [completionCelebrated, setCompletionCelebrated] = useState(false);
  const [editingWorkId, setEditingWorkId] = useState<string | null>(null);
  const { t, locale } = useTranslation();

  const zh = locale === 'zh';
  const workQuery = useLearningWork('rescue', roomId ?? '', userId ?? '', Boolean(room?.hasJoined), room?.status === 'finished');
  const works = workQuery.data?.works ?? [];
  const currentWork = works.find((work) => work.userId === userId && work.questionIndex === room?.currentQuestionIndex && work.runNumber === room?.restartCount);

  const advanceMutation = useMutation({
    mutationFn: () => advanceSquadQuizRoom(roomId ?? ''),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not advance'),
    onSuccess: (result) => {
      if (roomId && userId) setRoomCache(queryClient, roomId, userId, result);
    },
  });
  const restartMutation = useMutation({
    mutationFn: () => restartSquadQuizRoom(roomId ?? ''),
    onSuccess: (result) => {
      if (roomId && userId) setRoomCache(queryClient, roomId, userId, result);
      setCompletionCelebrated(false);
      toast.success(t('rescue.toast.roomRestarted'));
    },
    onError: (error) => toast.error(t('rescue.toast.roomNotRestarted'), {
      description: error instanceof Error ? error.message : t('rescue.tryAgain'),
    }),
  });
  const inviteMutation = useMutation({
    mutationFn: () => inviteSquadQuizParticipants(roomId ?? '', selectedInviteIds),
    onSuccess: (result) => {
      if (roomId && userId) setRoomCache(queryClient, roomId, userId, result);
      toast.success(t('rescue.toast.invited', {
        count: selectedInviteIds.length,
        suffix: selectedInviteIds.length === 1 ? '' : 's',
      }));
      setSelectedInviteIds([]);
      setInviteOpen(false);
    },
    onError: (error) => toast.error(t('rescue.toast.invitationsNotSent'), {
      description: error instanceof Error ? error.message : t('rescue.tryAgain'),
    }),
  });

  useEffect(() => {
    if (!roomId || !room?.hasJoined || room.status !== 'active') return;
    const sendHeartbeat = () => void heartbeatSquadQuizRoom(roomId).catch(() => undefined);
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 10_000);
    return () => window.clearInterval(timer);
  }, [room?.hasJoined, room?.status, roomId]);

  useEffect(() => {
    if (room?.status !== 'finished' || completionCelebrated) return;
    setCompletionCelebrated(true);
    toast.success(t('rescue.toast.streakDay'), { description: t('rescue.toast.savedAsActivity') });
    notify({ type: 'rescueCompleted' });
  }, [completionCelebrated, notify, room?.status, t]);

  const activeParticipants = room?.participants.filter((participant) => !['invited', 'left'].includes(participant.status)) ?? [];
  const allAnswered = activeParticipants.some((participant) => participant.answeredCurrent)
    && activeParticipants.every((participant) => participant.answeredCurrent || participant.presence === 'away');

  const sortedParticipants = useMemo(() => (
    [...(room?.participants ?? [])].sort((first, second) => (
      new Date(first.joinedAt ?? first.lastSeenAt ?? 0).getTime()
        - new Date(second.joinedAt ?? second.lastSeenAt ?? 0).getTime()
    ))
  ), [room?.participants]);
  const participantIds = new Set(room?.participants.map((participant) => participant.userId) ?? []);
  const remainingMembers = (squadQuery.data?.squad?.members ?? []).filter((member) => (
    member.id !== userId && !participantIds.has(member.id)
  ));
  const toggleInvite = (memberId: string, checked: boolean) => {
    setSelectedInviteIds((current) => checked
      ? [...new Set([...current, memberId])]
      : current.filter((candidate) => candidate !== memberId));
  };

  if (!roomId) return <RoomMessage title={t('rescue.missingLink')} body={t('rescue.openFromNotifications')} />;
  if (!account || roomQuery.isPending) return <RoomMessage title={t('rescue.loadingRoom')} body={t('rescue.syncing')} loading />;
  if (roomQuery.isError || !room) {
    return <RoomMessage title={t('rescue.unavailable')} body={roomQuery.error instanceof Error ? roomQuery.error.message : t('rescue.couldNotOpen')} />;
  }
  if (!room.hasJoined && room.status === 'active') {
    return <RoomMessage title={t('rescue.joinBeforeAnswering')} body={t('rescue.chooseAvatar')} actionLabel={t('rescue.goToJoinScreen')} action={() => navigate(`/rescue-join?roomId=${encodeURIComponent(room.id)}`)} />;
  }

  if (room.status === 'finished') {
    return (
      <div className="edunets-gradient p-4 text-foreground sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-5">
          <Card className="card-shadow rounded-[20px] border-border bg-card text-card-foreground">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="text-center">
                <Badge className="mb-4 rounded-full border-0 bg-primary text-primary-foreground"><Trophy className="mr-2 h-4 w-4" /> {t('rescue.complete')}</Badge>
                <h1 className="text-3xl font-black">{zh ? '解题回顾' : 'Solution review'}</h1>
                <p className="mt-2 text-muted-foreground">{t('rescue.savedAsStreak')}</p>
              </div>
              <ParticipantList participants={sortedParticipants} finished />
              {workQuery.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
              {works.filter((work) => work.runNumber === room.restartCount).map((work) => <WorkReview key={work.id} work={work} />)}
              <div className={`grid gap-3 ${room.canManage ? 'sm:grid-cols-2' : ''}`}>
                <Button onClick={() => navigate('/study-squad')} className="rounded-full bg-primary text-primary-foreground hover:bg-accent"><Flame className="mr-2 h-4 w-4" /> {t('rescue.backToSquad')}</Button>
                {room.canManage && (
                  <Button disabled={restartMutation.isPending} onClick={() => restartMutation.mutate()} variant="outline" className="rounded-full">
                    {restartMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />} {t('rescue.resetRoom')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const question = room.currentQuestion;
  return (
    <div className="edunets-gradient p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="grid items-center gap-3 rounded-[20px] bg-card p-4 text-card-foreground shadow-lg md:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-3 font-black text-primary">{t('rescue.round', { current: room.currentQuestionIndex + 1, total: room.totalRounds })}</div>
          <div className="text-center text-sm font-semibold">{zh ? '共同题目 · 独立手写 · AI 分析' : 'One question · Individual handwriting · AI feedback'}</div>
          <div className="flex justify-end gap-2">
            {room.canManage && <Button variant="outline" className="rounded-full" onClick={() => setInviteOpen(true)}><Users className="mr-2 h-4 w-4" /> {t('rescue.inviteSquad')}</Button>}
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => navigate('/study-squad')} aria-label={t('rescue.exitRoom')}><LogOut className="h-4 w-4" /></Button>
          </div>
          <p className="md:col-span-3 text-center text-sm font-bold text-muted-foreground">{zh ? '在线成员提交后，由主持人切换下一题。离线且未提交的成员会跳过本题。' : 'After online members submit, the host advances. Offline members who have not submitted skip this question.'}</p>
          {room.canManage && <Button className="md:col-span-3" disabled={!allAnswered || advanceMutation.isPending} onClick={() => advanceMutation.mutate()}>{zh ? '看完反馈，继续下一题／结束' : 'Finish reviewing and advance / finish'}</Button>}
        </header>

        <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
          <Card className="h-fit rounded-[20px]"><CardContent className="space-y-4 p-5"><h2 className="font-bold">{zh ? '小队进度' : 'Squad progress'}</h2><ParticipantList participants={sortedParticipants} /></CardContent></Card>
          <div className="space-y-5">
            <Badge>{room.subjectName} · {room.topicName}</Badge>
            {currentWork && <><WorkReview work={currentWork} /><Button variant="outline" onClick={() => setEditingWorkId(currentWork.id)}>{zh ? '修改手写或文字，再分析' : 'Edit drawing or text and analyse again'}</Button></>}
            {(!currentWork || editingWorkId === currentWork.id) && <SolutionWhiteboard
              key={`${room.id}:${room.restartCount}:${question.questionIndex}`}
              draftKey={`rescue-work:${userId}:${room.id}:${room.restartCount}:${question.questionIndex}`}
              question={question.text + (question.options ? '\n' + question.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n') : '')}
              questionIndex={question.questionIndex} runNumber={room.restartCount}
              disabled={workQuery.isPending || workQuery.isError}
              onSubmit={async (input) => {
                await submitLearningWork('rescue', room.id, input);
                await Promise.all([workQuery.refetch(), roomQuery.refetch()]);
                setEditingWorkId(null);
              }} />}
            {workQuery.isError && <p className="text-sm text-destructive" role="alert">{workQuery.error.message}<Button variant="outline" onClick={() => void workQuery.refetch()}>{zh ? '重试' : 'Retry'}</Button></p>}
            {works.filter((work) => work.userId === userId && work.runNumber === room.restartCount && work.questionIndex < room.currentQuestionIndex).map((work) => <WorkReview key={work.id} work={work} />)}
          </div>
        </div>

        <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) setSelectedInviteIds([]); }}>
          <DialogContent className="max-w-[430px] border-border bg-card text-card-foreground">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> {t('rescue.inviteSquadTitle')}</DialogTitle><DialogDescription>{t('rescue.inviteSquadDescription')}</DialogDescription></DialogHeader>
            <div className="space-y-3">
              {remainingMembers.length === 0 ? <p className="rounded-[16px] bg-secondary p-4">{t('rescue.everyoneInvited')}</p> : remainingMembers.map((member) => (
                <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-border bg-background p-3">
                  <Checkbox checked={selectedInviteIds.includes(member.id)} onCheckedChange={(checked) => toggleInvite(member.id, checked === true)} />
                  <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-secondary font-bold">{initialsFor(member.name)}</div>
                  <p className="min-w-0 flex-1 truncate font-bold">{member.name}</p>
                </label>
              ))}
            </div>
            <Button disabled={selectedInviteIds.length === 0 || inviteMutation.isPending} onClick={() => inviteMutation.mutate()} className="w-full rounded-full">
              {inviteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} {t('rescue.sendInvitations')}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ParticipantList({ participants, finished = false }: {
  participants: SquadQuizRoom['participants'];
  finished?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {participants.map((participant, index) => {
        const active = participant.presence === 'online';
        return (
          <motion.div
            key={participant.userId}
            animate={participant.lastAnswerCorrect ? { scale: [1, 1.03, 1] } : { scale: 1 }}
            className={`flex items-center gap-3 rounded-[16px] border p-3 ${participant.lastAnswerCorrect ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-card-foreground'}`}
          >
            <div className="w-6 text-center font-black">{participant.presence === 'invited' ? '—' : index + 1}</div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-[14px] border border-border font-bold ${avatarClass(participant.avatarColor)}`}>{initialsFor(participant.displayName)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{participant.displayName}</p>
              <p className="flex items-center gap-1 text-xs font-semibold opacity-80">
                {active ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {finished ? t('rescue.status.finished') : participant.answeredCurrent ? t('rescue.status.answerLocked') : t(PRESENCE_KEYS[participant.presence])}
              </p>
            </div>

          </motion.div>
        );
      })}
    </div>
  );
}

function RoomMessage({ title, body, loading = false, action, actionLabel }: {
  title: string;
  body: string;
  loading?: boolean;
  action?: () => void;
  actionLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="edunets-gradient flex items-center justify-center p-4 text-foreground sm:p-6 lg:p-8">
      <Card className="card-shadow w-full max-w-[480px] rounded-[20px] border-border bg-card text-card-foreground">
        <CardContent className="space-y-4 p-8 text-center">
          {loading && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
          <h1 className="text-2xl font-black">{title}</h1>
          <p className="text-muted-foreground">{body}</p>
          {action && <Button onClick={action} className="rounded-full">{actionLabel ?? t('common.continue')}</Button>}
        </CardContent>
      </Card>
    </div>
  );
}
