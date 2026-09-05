'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Circle,
  Clock3,
  Copy,
  Loader2,
  Mic,
  Square,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useMicLevel } from '@/hooks/use-mic-level';
import { useTranscription } from '@/hooks/use-transcription';
import { useCurrentAccount } from '@/lib/api/me';
import {
  addRevisionUtterance,
  createRevisionRoom,
  endRevisionRoom,
  heartbeatRevisionRoom,
  joinRevisionRoom,
  revisionRoomQueryKey,
  startRevisionRoom,
  useRevisionRoom,
  type RevisionRoom,
} from '@/lib/api/revision-rooms';
import { useCatalog } from '@/lib/api/study';
import { useStudySquad } from '@/lib/api/study-squads';
import { reviewDiscussion, type CoverageVerdict } from '@/lib/discussion-rubric';
import { resolveCurriculumTopic } from '@/lib/curriculum';
import { useSubjectName, useTranslation, type TranslationKey } from '@/lib/i18n';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import type { RevisionRoomPresence } from '@/lib/api/revision-rooms';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'SN';
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const PRESENCE_KEYS: Record<RevisionRoomPresence, TranslationKey> = {
  invited: 'revision.presence.invited',
  online: 'revision.presence.online',
  away: 'revision.presence.away',
  finished: 'revision.presence.finished',
  left: 'revision.presence.left',
};

const VERDICT_KEYS: Record<CoverageVerdict, TranslationKey> = {
  covered: 'verdict.covered',
  partial: 'verdict.partial',
  missed: 'verdict.missed',
};

function setRoomCache(
  queryClient: ReturnType<typeof useQueryClient>,
  roomId: string,
  userId: string,
  result: { room: RevisionRoom },
) {
  queryClient.setQueryData([...revisionRoomQueryKey, roomId, userId], result);
}

export default function RevisionRoomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const subjectName = useSubjectName();
  const roomId = searchParams.get('roomId');
  const requestedTopicId = searchParams.get('topicId');
  const topicId = requestedTopicId
    ? (resolveCurriculumTopic(requestedTopicId)?.id ?? requestedTopicId)
    : null;
  const { data: account } = useCurrentAccount();
  const { data: catalog, isPending: catalogPending } = useCatalog();
  const userId = account?.user.id ?? null;
  const squadQuery = useStudySquad(userId);
  const roomQuery = useRevisionRoom(roomId, userId);
  const room = roomQuery.data?.room ?? null;
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const transcriptRef = useRef('');
  const {
    status: transcriptionStatus,
    finalTranscript,
    interimTranscript,
    error: transcriptionError,
    provider,
    start,
    stop,
    reset,
  } = useTranscription();
  const isRecording = transcriptionStatus === 'recording' || transcriptionStatus === 'connecting';
  const { level: micLevel, available: micAvailable } = useMicLevel(isRecording);

  useEffect(() => {
    transcriptRef.current = finalTranscript;
  }, [finalTranscript]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomId || !room?.hasJoined || room.status === 'ended') return;
    const sendHeartbeat = () => void heartbeatRevisionRoom(roomId).catch(() => undefined);
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 10_000);
    return () => window.clearInterval(timer);
  }, [room?.hasJoined, room?.status, roomId]);

  const createMutation = useMutation({
    mutationFn: () => createRevisionRoom(topicId ?? '', selectedInviteIds),
    onSuccess: (result) => navigate(`/revision-room?roomId=${encodeURIComponent(result.room.id)}`),
    onError: (error) => toast.error(t('revision.notCreated'), {
      description: error instanceof Error ? error.message : t('revision.tryAgain'),
    }),
  });
  const joinMutation = useMutation({
    mutationFn: () => joinRevisionRoom(roomId ?? ''),
    onSuccess: (result) => {
      if (roomId && userId) setRoomCache(queryClient, roomId, userId, result);
      toast.success(t('revision.toast.joined'));
    },
    onError: (error) => toast.error(t('revision.toast.couldNotJoin'), {
      description: error instanceof Error ? error.message : t('revision.tryAgain'),
    }),
  });
  const startMutation = useMutation({
    mutationFn: () => startRevisionRoom(roomId ?? ''),
    onSuccess: (result) => {
      if (roomId && userId) setRoomCache(queryClient, roomId, userId, result);
      toast.success(t('revision.toast.isLive'));
    },
  });
  const endMutation = useMutation({
    mutationFn: () => endRevisionRoom(roomId ?? ''),
    onSuccess: (result) => {
      if (roomId && userId) setRoomCache(queryClient, roomId, userId, result);
      toast.success(t('revision.toast.reviewReady'));
    },
  });
  const utteranceMutation = useMutation({
    mutationFn: (input: { submissionId: string; text: string; speakingMs: number }) => (
      addRevisionUtterance(roomId ?? '', {
        ...input,
        locale: navigator.language || 'en',
        provider,
      })
    ),
    onSuccess: (result) => {
      if (roomId && userId) setRoomCache(queryClient, roomId, userId, result);
      reset();
      toast.success(t('revision.toast.explanationShared'));
    },
    onError: (error) => toast.error(t('revision.transcriptNotShared'), {
      description: error instanceof Error ? error.message : t('revision.tryAgain'),
    }),
  });

  const beginRecording = useCallback(async () => {
    reset();
    setRecordingStartedAt(Date.now());
    await start();
  }, [reset, start]);

  const finishRecording = useCallback(async () => {
    await stop();
    const text = transcriptRef.current.trim();
    if (!text) {
      toast.error(t('revision.noSpeechCaptured'));
      return;
    }
    const speakingMs = Math.min(1_800_000, Math.max(0, Date.now() - (recordingStartedAt ?? Date.now())));
    utteranceMutation.mutate({ submissionId: crypto.randomUUID(), text, speakingMs });
    setRecordingStartedAt(null);
  }, [recordingStartedAt, stop, utteranceMutation]);

  const secondsLeft = useMemo(() => {
    if (!room?.startedAt) return room?.durationSeconds ?? 180;
    const remainingAtFetch = new Date(room.startedAt).getTime()
      + room.durationSeconds * 1_000
      - new Date(room.serverNow).getTime();
    const elapsedSinceFetch = now - roomQuery.dataUpdatedAt;
    return Math.max(0, Math.ceil((remainingAtFetch - elapsedSinceFetch) / 1_000));
  }, [now, room, roomQuery.dataUpdatedAt]);

  const groupReview = useMemo(() => {
    if (!room || room.status !== 'ended') return null;
    return reviewDiscussion(room.topicId, room.utterances.map((utterance) => ({
      speakerId: utterance.userId,
      speakerName: utterance.displayName,
      text: utterance.text,
    })));
  }, [room]);

  if (!roomId && !topicId) {
    return (
      <main className="pattern-overlay min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div>
            <Badge className="rounded-full">{t('nav.studySquad')}</Badge>
            <h1 className="mt-3 text-3xl font-bold">{t('revision.chooseTopic')}</h1>
            <p className="mt-2 text-muted-foreground">{t('revision.everyoneJoins')}</p>
          </div>
          {catalogPending ? <Loader2 className="h-6 w-6 animate-spin" /> : (
            <div className="grid gap-4 md:grid-cols-2">
              {catalog?.subjects.flatMap((subject) => subject.topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => navigate(`/revision-room?topicId=${encodeURIComponent(topic.id)}`)}
                  className="rounded-[24px] border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary"
                >
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{subjectName(subject.name)}</span>
                  <span className="mt-1 block text-lg font-bold">{topic.name}</span>
                </button>
              ))) }
            </div>
          )}
        </div>
      </main>
    );
  }

  if (!roomId && topicId) {
    const topic = catalog?.subjects.flatMap((subject) => subject.topics.map((item) => ({ ...item, subjectName: subject.name })))
      .find((item) => item.id === topicId);
    const inviteableMembers = squadQuery.data?.squad?.members.filter((member) => member.id !== userId) ?? [];
    return (
      <main className="pattern-overlay min-h-screen bg-background p-4 sm:p-8">
        <Card className="mx-auto max-w-2xl rounded-[28px]">
          <CardHeader>
            <Badge className="w-fit rounded-full">{t('revision.createRoomBadge')}</Badge>
            <CardTitle className="text-3xl">{topic?.name ?? t('revision.title')}</CardTitle>
            <p className="text-muted-foreground">{t('revision.inviteUpToFour', { subject: topic ? subjectName(topic.subjectName) : '' })}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {!squadQuery.data?.squad ? (
              <div className="rounded-2xl border border-dashed p-5 text-sm">{t('revision.needSquadFirst')}</div>
            ) : inviteableMembers.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-5 text-sm">{t('revision.soloOk')}</div>
            ) : (
              <div className="space-y-2">
                {inviteableMembers.map((member) => (
                  <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border p-3">
                    <Checkbox
                      checked={selectedInviteIds.includes(member.id)}
                      onCheckedChange={(checked) => setSelectedInviteIds((current) => checked
                        ? [...current, member.id].slice(0, 4)
                        : current.filter((id) => id !== member.id))}
                    />
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-bold">{initials(member.name)}</span>
                    <span className="font-semibold">{member.name}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/revision-room')} className="rounded-full">{t('revision.back')}</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!squadQuery.data?.squad || !topic || createMutation.isPending}
                className="flex-1 rounded-full"
              >
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                {t('revision.createRoom')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (roomQuery.isPending || !account) {
    return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin" /></main>;
  }
  if (roomQuery.error || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="max-w-md rounded-[28px]"><CardContent className="space-y-4 p-8 text-center">
          <h1 className="text-2xl font-bold">{t('revision.unavailable')}</h1>
          <p className="text-muted-foreground">{roomQuery.error instanceof Error ? roomQuery.error.message : t('revision.couldNotLoad')}</p>
          <Button onClick={() => navigate('/study-squad')} className="rounded-full">{t('revision.backToSquad')}</Button>
        </CardContent></Card>
      </main>
    );
  }

  if (!room.hasJoined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-lg rounded-[28px]"><CardContent className="space-y-5 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground"><Users /></div>
          <div><Badge>{room.squadName}</Badge><h1 className="mt-3 text-3xl font-bold">{room.topicName}</h1><p className="mt-2 text-muted-foreground">{t('revision.hostedBy', { name: room.hostName })}</p></div>
          <Button onClick={() => joinMutation.mutate()} disabled={!room.canJoin || joinMutation.isPending} className="w-full rounded-full">
            {joinMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t('revision.joinRoom')}
          </Button>
        </CardContent></Card>
      </main>
    );
  }

  return (
    <main className="pattern-overlay min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          <Card className="rounded-[28px]">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
              <div><Badge className="rounded-full">{subjectName(room.subjectName)}</Badge><h1 className="mt-2 text-2xl font-bold">{room.topicName}</h1><p className="text-sm text-muted-foreground">{room.squadName} · {t('revision.hostedByInline', { name: room.hostName })}</p></div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="rounded-full" onClick={() => { void navigator.clipboard.writeText(window.location.href); toast.success(t('revision.toast.linkCopied')); }}><Copy className="mr-2 h-4 w-4" />{room.joinCode}</Button>
                {room.status === 'lobby' && room.canManage && <Button className="rounded-full" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>{t('revision.start')}</Button>}
                {room.status === 'live' && room.canManage && <Button variant="destructive" className="rounded-full" onClick={() => endMutation.mutate()} disabled={endMutation.isPending}>{t('revision.endAndReview')}</Button>}
              </div>
            </CardContent>
          </Card>

          {room.status === 'lobby' && (
            <Card className="rounded-[28px]"><CardContent className="p-8 text-center"><Clock3 className="mx-auto h-10 w-10 text-primary" /><h2 className="mt-4 text-2xl font-bold">{t('revision.waitingInLobby')}</h2><p className="mt-2 text-muted-foreground">{t('revision.inviteInstructions')}</p></CardContent></Card>
          )}

          {room.status === 'live' && (
            <Card className="rounded-[28px]"><CardContent className="space-y-6 p-6 sm:p-8">
              <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-muted-foreground">{t('revision.groupExplanation')}</p><h2 className="text-2xl font-bold">{t('revision.speakFromOwnMic')}</h2></div><div className="rounded-full bg-secondary px-4 py-2 font-mono font-bold">{formatClock(secondsLeft)}</div></div>
              <Progress value={(secondsLeft / room.durationSeconds) * 100} />
              <div className="rounded-[24px] bg-muted p-5">
                <p className="min-h-20 leading-7">{finalTranscript} <span className="text-muted-foreground">{interimTranscript}</span>{!finalTranscript && !interimTranscript && t('revision.liveTranscriptHint')}</p>
                {transcriptionError && <p className="mt-3 text-sm text-destructive">{transcriptionError}</p>}
                <div className="mt-4 flex items-center gap-3">
                  {!isRecording ? (
                    <Button onClick={() => void beginRecording()} disabled={utteranceMutation.isPending} className="rounded-full"><Mic className="mr-2 h-4 w-4" />{t('revision.startMyExplanation')}</Button>
                  ) : (
                    <Button onClick={() => void finishRecording()} className="rounded-full"><Square className="mr-2 h-4 w-4" />{t('revision.finishAndShare')}</Button>
                  )}
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-background"><div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(micLevel * 100)}%` }} /></div>
                  <span className="text-xs text-muted-foreground">{micAvailable ? t('revision.micActive') : t('revision.micUnavailable')}</span>
                </div>
              </div>
            </CardContent></Card>
          )}

          {room.status === 'ended' && groupReview && (
            <Card className="rounded-[28px]"><CardContent className="space-y-5 p-6 sm:p-8"><div><Badge className="rounded-full">{t('revision.groupReview')}</Badge><h2 className="mt-2 text-2xl font-bold">{t('revision.whatSquadCovered')}</h2></div><div className="grid gap-3 sm:grid-cols-3">{groupReview.group.map((item) => <div key={item.id} className="rounded-2xl border p-4"><div className="flex items-center gap-2">{item.verdict === 'covered' ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}<span className="font-bold">{item.name}</span></div><p className="mt-2 text-sm text-muted-foreground">{t(VERDICT_KEYS[item.verdict])}</p></div>)}</div></CardContent></Card>
          )}

          <Card className="rounded-[28px]"><CardHeader><CardTitle>{t('revision.sharedTranscript')}</CardTitle></CardHeader><CardContent className="space-y-3">{room.utterances.length === 0 ? <p className="text-sm text-muted-foreground">{t('revision.noExplanationsShared')}</p> : room.utterances.map((utterance) => <article key={utterance.id} className="rounded-2xl bg-muted p-4"><div className="mb-2 flex items-center justify-between gap-3"><strong>{utterance.displayName}</strong><span className="text-xs text-muted-foreground">{new Date(utterance.spokenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><p className="leading-7">{utterance.text}</p></article>)}</CardContent></Card>
        </section>

        <aside>
          <Card className="sticky top-6 rounded-[28px]"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> {t('revision.participants')}</CardTitle></CardHeader><CardContent className="space-y-3">{room.participants.map((participant) => <div key={participant.userId} className="flex items-center gap-3 rounded-2xl border p-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xs font-bold">{initials(participant.displayName)}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{participant.displayName}{participant.userId === room.hostUserId ? t('revision.hostSuffix') : ''}</p><p className="text-xs text-muted-foreground">{t(PRESENCE_KEYS[participant.presence])}</p></div>{participant.presence === 'online' ? <Wifi className="h-4 w-4 text-primary" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}</div>)}</CardContent></Card>
        </aside>
      </div>
    </main>
  );
}
