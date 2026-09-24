'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Copy,
  Crown,
  Loader2,
  Play,
  Sparkles,
  Timer,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { StudyRelayCanvas, type StudyRelayCanvasHandle } from '@/components/study-relay-canvas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentAccount } from '@/lib/api/me';
import {
  clearStudyRelaySession,
  createStudyRelayRoom,
  heartbeatStudyRelayRoom,
  joinStudyRelayRoom,
  loadStudyRelaySession,
  saveStudyRelaySession,
  startStudyRelayRoom,
  submitDrawing,
  submitExplanation,
  studyRelayRoomQueryKey,
  uploadDrawingPng,
  useStudyRelayRoom,
  type StudyRelayRoom,
  type StudyRelayRoomResponse,
} from '@/lib/api/study-relay';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { isApiError } from '@/lib/api/client';
import { useStudySquad } from '@/lib/api/study-squads';
import { useTranslation } from '@/lib/i18n';
import { subscribeStudyRelayRoom } from '@/lib/supabase/browser';
import { StudyRelayMockProvider, useStudyRelayMock } from '@/features/study-relay-mock';

function formatCountdown(endsAt: string | null) {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
}

function PhaseTimer({ room }: { room: StudyRelayRoom }) {
  const [seconds, setSeconds] = useState(() => formatCountdown(room.phaseEndsAt));

  useEffect(() => {
    setSeconds(formatCountdown(room.phaseEndsAt));
    const timer = window.setInterval(() => {
      setSeconds(formatCountdown(room.phaseEndsAt));
    }, 250);
    return () => window.clearInterval(timer);
  }, [room.phaseEndsAt, room.status, room.currentHop]);

  if (seconds === null) return null;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return (
    <Badge className="rounded-full bg-secondary text-secondary-foreground">
      <Timer className="mr-1.5 h-3.5 w-3.5" />
      {minutes}:{rem.toString().padStart(2, '0')}
    </Badge>
  );
}

function RevealChains({ room }: { room: StudyRelayRoom }) {
  const [activeChain, setActiveChain] = useState(0);
  const [visibleHops, setVisibleHops] = useState(0);
  const chain = room.chains[activeChain];

  useEffect(() => {
    setVisibleHops(0);
    if (!chain) return;
    const total = chain.hops.length + 2; // prompt + hops + reference
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      setVisibleHops(step);
      if (step >= total) window.clearInterval(timer);
    }, 900);
    return () => window.clearInterval(timer);
  }, [activeChain, chain?.chainId]);

  if (!chain) {
    return <p className="text-muted-foreground">No chains to reveal yet.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {room.chains.map((item, index) => (
          <Button
            key={item.chainId}
            size="sm"
            variant={index === activeChain ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setActiveChain(index)}
          >
            Chain {index + 1}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {visibleHops >= 1 && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Original prompt</p>
              <p className="mt-2 text-lg font-semibold">{chain.concept}</p>
            </motion.div>
          )}
          {chain.hops.map((hop, index) => (
            visibleHops >= index + 2 ? (
              <motion.div
                key={`${hop.hopIndex}-${hop.playerId}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {hop.type === 'drawing' ? 'Drawing' : 'Explanation'} · {hop.displayName}
                </p>
                {hop.skipped ? (
                  <p className="mt-3 text-sm italic text-muted-foreground">Skipped (no submission)</p>
                ) : hop.type === 'drawing' && hop.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hop.imageUrl} alt={`Drawing by ${hop.displayName}`} className="mt-3 max-h-64 w-full rounded-xl object-contain bg-white" />
                ) : (
                  <p className="mt-3 text-sm leading-relaxed">{hop.text}</p>
                )}
              </motion.div>
            ) : null
          ))}
          {visibleHops >= chain.hops.length + 2 && chain.referenceNote && (
            <motion.div
              key="reference"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-accent/40 bg-accent/10 p-4 md:col-span-2 xl:col-span-3"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference note</p>
              <p className="mt-2 text-sm leading-relaxed">{chain.referenceNote}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StudyRelayInner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const account = useCurrentAccount();
  const userId = account.data?.user?.id ?? null;
  const squadQuery = useStudySquad(userId);
  const mock = useStudyRelayMock();
  const useMock = searchParams.get('mock') === '1' || Boolean(mock?.enabled && searchParams.get('mock') !== '0');

  const [displayName, setDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState(searchParams.get('code')?.toUpperCase() ?? '');
  const [session, setSession] = useState(() => loadStudyRelaySession());
  const [busy, setBusy] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<string[]>([]);
  const canvasRef = useRef<StudyRelayCanvasHandle>(null);

  useEffect(() => {
    if (!displayName && account.data?.user?.name) {
      setDisplayName(account.data.user.name.slice(0, 40));
    }
  }, [account.data?.user?.name, displayName]);

  const liveQuery = useStudyRelayRoom(
    useMock ? null : session?.roomId ?? null,
    useMock ? null : session?.playerToken ?? null,
    { pollWhenDisconnected: !realtimeConnected },
  );

  const [mockSnapshot, setMockSnapshot] = useState<StudyRelayRoomResponse | null>(null);

  const refreshMock = useCallback(() => {
    if (!mock) return;
    const snapshot = mock.getRoom();
    setMockSnapshot(snapshot);
  }, [mock]);

  useEffect(() => {
    if (!useMock || !mock) return;
    refreshMock();
    const timer = window.setInterval(refreshMock, 1_000);
    return () => window.clearInterval(timer);
  }, [mock, refreshMock, useMock]);

  const room = useMock ? mockSnapshot?.room ?? null : liveQuery.data?.room ?? null;
  const playerToken = session?.playerToken ?? (useMock ? 'mock-token' : null);

  useEffect(() => {
    if (useMock || !session?.roomId || !session.playerToken || !session.playerId) return;
    const client = subscribeStudyRelayRoom(session.roomId, {
      presence: {
        playerId: session.playerId,
        displayName: session.displayName,
      },
      onBroadcast: () => {
        void queryClient.invalidateQueries({ queryKey: studyRelayRoomQueryKey });
      },
      onPresenceSync: (ids) => {
        setOnlinePlayerIds(ids);
        setRealtimeConnected(true);
      },
    });
    setRealtimeConnected(Boolean(client.channel));
    return () => {
      client.unsubscribe();
      setRealtimeConnected(false);
      setOnlinePlayerIds([]);
    };
  }, [
    queryClient,
    session?.displayName,
    session?.playerId,
    session?.playerToken,
    session?.roomId,
    useMock,
  ]);

  useEffect(() => {
    if (useMock || !session?.roomId || !session.playerToken) return;
    const timer = window.setInterval(() => {
      void heartbeatStudyRelayRoom(session.roomId, session.playerToken).catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [session?.playerToken, session?.roomId, useMock]);

  const persistSession = (response: StudyRelayRoomResponse, name: string) => {
    if (!response.playerToken) return;
    const next = {
      roomId: response.room.id,
      playerToken: response.playerToken,
      playerId: response.room.viewer.playerId,
      displayName: name,
    };
    saveStudyRelaySession(next);
    setSession(next);
  };

  const handleCreate = async () => {
    if (!displayName.trim()) {
      toast.error('Enter a display name');
      return;
    }
    setBusy(true);
    try {
      if (useMock && mock) {
        const response = mock.createRoom(displayName.trim());
        persistSession(response, displayName.trim());
        setMockSnapshot(response);
        toast.success('Demo room created');
        return;
      }
      const response = await createStudyRelayRoom({
        displayName: displayName.trim(),
        subject: 'chemistry',
        ...(squadQuery.data?.squad?.id ? { squadId: squadQuery.data.squad.id } : {}),
      });
      persistSession(response, displayName.trim());
      toast.success('Room created');
    } catch (error) {
      const message = isApiError(error) ? error.message : 'Could not create room';
      toast.error(message);
      if (isApiError(error) && (error.code === 'STUDY_RELAY_NOT_MIGRATED' || error.status === 500)) {
        toast.message(t('squad.relay.setupHint'), {
          action: {
            label: t('squad.relay.tryDemo'),
            onClick: () => navigate('/study-squad/relay?mock=1'),
          },
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!displayName.trim() || !joinCode.trim()) {
      toast.error('Enter a display name and room code');
      return;
    }
    setBusy(true);
    try {
      if (useMock && mock) {
        const response = mock.joinRoom(joinCode.trim(), displayName.trim());
        persistSession(response, displayName.trim());
        refreshMock();
        toast.success('Joined mock room');
        return;
      }
      const response = await joinStudyRelayRoom({
        code: joinCode.trim(),
        displayName: displayName.trim(),
      });
      persistSession(response, displayName.trim());
      toast.success('Joined room');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Could not join room');
    } finally {
      setBusy(false);
    }
  };

  const handleStart = async () => {
    if (!session && !useMock) return;
    setBusy(true);
    try {
      if (useMock && mock) {
        mock.addBotPlayers(Math.max(0, 3 - (mock.getRoom()?.room.playerCount ?? 0)));
        const response = mock.startRoom();
        setMockSnapshot(response);
        toast.success('Drawing phase started');
        return;
      }
      const response = await startStudyRelayRoom(session!.roomId, session!.playerToken);
      void queryClient.setQueryData([...studyRelayRoomQueryKey, session!.roomId, session!.playerToken], response);
      toast.success('Drawing phase started');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Could not start');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitDrawing = async () => {
    if (!canvasRef.current || !playerToken) return;
    setBusy(true);
    try {
      const dataUrl = await canvasRef.current.exportPngDataUrl();
      if (useMock && mock) {
        const response = mock.submitDrawing(dataUrl);
        setMockSnapshot(response);
        toast.success('Drawing submitted');
        return;
      }
      const storagePath = await uploadDrawingPng(session!.roomId, session!.playerToken, dataUrl);
      const response = await submitDrawing(session!.roomId, session!.playerToken, storagePath);
      void queryClient.setQueryData([...studyRelayRoomQueryKey, session!.roomId, session!.playerToken], response);
      toast.success('Drawing submitted');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Could not submit drawing');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitExplanation = async () => {
    if (!explanation.trim() || !playerToken) return;
    setBusy(true);
    try {
      if (useMock && mock) {
        const response = mock.submitExplanation(explanation.trim());
        setMockSnapshot(response);
        setExplanation('');
        toast.success('Explanation submitted');
        return;
      }
      const response = await submitExplanation(session!.roomId, session!.playerToken, explanation.trim());
      void queryClient.setQueryData([...studyRelayRoomQueryKey, session!.roomId, session!.playerToken], response);
      setExplanation('');
      toast.success('Explanation submitted');
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Could not submit explanation');
    } finally {
      setBusy(false);
    }
  };

  const leaveRoom = () => {
    clearStudyRelaySession();
    setSession(null);
    setMockSnapshot(null);
  };

  const inviteLink = room
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/study-squad/relay?code=${encodeURIComponent(room.code)}`
    : '';

  const statusLabel = room
    ? room.status === 'lobby'
      ? t('squad.relay.waiting')
      : room.status === 'drawing'
        ? t('squad.relay.drawing')
        : room.status === 'explaining'
          ? (room.explainStage === 'view' ? t('squad.relay.viewing') : t('squad.relay.writing'))
          : t('squad.relay.reveal')
    : '';

  const shellHeader = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <button
          type="button"
          onClick={() => navigate('/study-squad')}
          className="mb-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          ← {t('squad.relay.back')}
        </button>
        <Badge className="mb-2 block w-fit rounded-full border-0 bg-secondary text-secondary-foreground">
          {t('squad.relay.badge')}
        </Badge>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
          {room ? t('squad.relay.room', { code: room.code }) : t('squad.relay.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {room ? statusLabel : t('squad.relay.blurb')}
        </p>
      </div>
      {room ? (
        <div className="flex flex-wrap items-center gap-2">
          <PhaseTimer room={room} />
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={async () => {
              await navigator.clipboard.writeText(room.code);
              toast.success(t('squad.relay.copyCode'));
            }}
          >
            <Copy className="mr-1.5 h-4 w-4" /> {room.code}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={async () => {
              await navigator.clipboard.writeText(inviteLink);
              toast.success(t('squad.relay.copyLink'));
            }}
          >
            {t('squad.relay.copyLink')}
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={leaveRoom}>
            {t('squad.relay.leave')}
          </Button>
        </div>
      ) : null}
    </div>
  );

  const lobbyCard = (
    <div className="space-y-4">
      <Card className="card-shadow border-border bg-card text-card-foreground">
        <CardHeader>
          <CardTitle className="text-lg">{t('squad.relay.expectTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ['squad.relay.step1', 'squad.relay.step1Hint'],
              ['squad.relay.step2', 'squad.relay.step2Hint'],
              ['squad.relay.step3', 'squad.relay.step3Hint'],
              ['squad.relay.step4', 'squad.relay.step4Hint'],
            ] as const).map(([titleKey, hintKey]) => (
              <div key={titleKey} className="rounded-[18px] border border-border bg-background p-4">
                <p className="font-bold text-foreground">{t(titleKey)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t(hintKey)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="card-shadow border-border bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5" /> {t('squad.relay.title')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t('squad.relay.blurb')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold">{t('squad.relay.displayName')}</label>
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={40}
                placeholder={t('squad.relay.displayNameHint')}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-full bg-primary text-primary-foreground hover:bg-accent"
                disabled={busy}
                onClick={() => void handleCreate()}
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                {t('squad.relay.create')}
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => navigate('/study-squad/relay?mock=1')}
              >
                {t('squad.relay.tryDemo')}
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                maxLength={8}
                placeholder={t('squad.relay.codePlaceholder')}
              />
              <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => void handleJoin()}>
                {t('squad.relay.join')}
              </Button>
            </div>
            {useMock && (
              <p className="text-xs text-muted-foreground">{t('squad.relay.mockNote')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="card-shadow border-border bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="text-lg">{t('squad.relay.modeTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-[18px] border-2 border-primary bg-accent/20 p-4 text-left"
            >
              <p className="font-bold">{t('squad.relay.modeClassic')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('squad.relay.modeClassicHint')}</p>
            </button>
            <button
              type="button"
              disabled
              className="rounded-[18px] border border-border bg-background p-4 text-left opacity-60"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{t('squad.relay.modeIcebreaker')}</p>
                <Badge className="rounded-full border-0 bg-secondary text-secondary-foreground">{t('squad.relay.modeSoon')}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t('squad.relay.modeIcebreakerHint')}</p>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (!room) {
    return (
      <div className="pattern-overlay bg-background p-4 text-foreground sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {shellHeader}
          {lobbyCard}
        </div>
      </div>
    );
  }

  return (
    <div className="pattern-overlay bg-background p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {shellHeader}

      {room.status === 'lobby' && (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="card-shadow border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Users className="h-5 w-5" />
                {t('squad.relay.players', { count: room.playerCount, max: room.maxPlayers })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: room.maxPlayers }, (_, index) => {
                const player = room.players.find((entry) => entry.seatIndex === index) ?? null;
                if (!player) {
                  return (
                    <div
                      key={`empty-${index}`}
                      className="flex items-center gap-3 rounded-[18px] border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/60 text-xs font-bold">
                        {index + 1}
                      </span>
                      {t('squad.relay.emptySeat')}
                    </div>
                  );
                }
                const live = onlinePlayerIds.length === 0 || onlinePlayerIds.includes(player.id);
                return (
                  <div key={player.id} className="flex items-center justify-between rounded-[18px] border border-border bg-background px-3 py-2">
                    <span className="flex items-center gap-3 font-medium">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {player.displayName.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                          title={live ? 'Online' : 'Away'}
                        />
                        {player.displayName}
                      </span>
                    </span>
                    {player.isHost ? <Crown className="h-4 w-4 text-amber-500" /> : null}
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground">
                {t('squad.relay.needPlayers', { min: room.minPlayers, max: room.maxPlayers })}
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="card-shadow border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">{t('squad.relay.modeTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border-2 border-primary bg-accent/20 p-4">
                  <p className="font-bold">{t('squad.relay.modeClassic')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('squad.relay.modeClassicHint')}</p>
                </div>
                <div className="rounded-[18px] border border-border bg-background p-4 opacity-60">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{t('squad.relay.modeIcebreaker')}</p>
                    <Badge className="rounded-full border-0 bg-secondary text-secondary-foreground">{t('squad.relay.modeSoon')}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{t('squad.relay.modeIcebreakerHint')}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow border-border bg-card">
              <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={async () => {
                    await navigator.clipboard.writeText(inviteLink);
                    toast.success(t('squad.relay.copyLink'));
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" /> {t('squad.relay.invite')}
                </Button>
                {room.viewer.isHost ? (
                  <Button
                    className="rounded-full bg-primary text-primary-foreground hover:bg-accent sm:ml-auto"
                    disabled={busy || !room.canStart}
                    onClick={() => void handleStart()}
                  >
                    <Play className="mr-2 h-4 w-4" /> {t('squad.relay.startDrawing')}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground sm:ml-auto">{t('squad.relay.waitHost')}</p>
                )}
              </CardContent>
            </Card>

            {useMock && mock && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  mock.addBotPlayers(2);
                  refreshMock();
                }}
              >
                {t('squad.relay.addBots')}
              </Button>
            )}
          </div>
        </div>
      )}

      {room.status === 'drawing' && room.assignment && (
        <Card className="card-shadow border-border bg-card">
          <CardHeader>
            <CardTitle>Draw: {room.assignment.concept}</CardTitle>
            <p className="text-sm text-muted-foreground">60 seconds — keep it simple and readable.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <StudyRelayCanvas ref={canvasRef} disabled={room.hasSubmittedCurrent || busy} />
            <Button
              className="rounded-full bg-primary text-primary-foreground hover:bg-accent"
              disabled={busy || room.hasSubmittedCurrent}
              onClick={() => void handleSubmitDrawing()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {room.hasSubmittedCurrent ? 'Submitted — waiting for others' : 'Submit drawing'}
            </Button>
          </CardContent>
        </Card>
      )}

      {room.status === 'explaining' && room.assignment && (
        <Card className="card-shadow border-border bg-card">
          <CardHeader>
            <CardTitle>
              {room.explainStage === 'view' ? t('squad.relay.viewing') : t('squad.relay.writing')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {room.explainStage === 'view'
                ? '30-second viewing window — no typing yet.'
                : '1 minute 30 seconds to write your explanation.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {room.assignment.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={room.assignment.imageUrl}
                alt="Assigned drawing"
                className="max-h-80 w-full rounded-2xl border border-border bg-white object-contain"
              />
            ) : room.assignment.priorText ? (
              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-relaxed">
                {room.assignment.priorText}
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">Previous hop was skipped.</p>
            )}
            <Textarea
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              disabled={room.explainStage === 'view' || room.hasSubmittedCurrent || busy}
              placeholder="What concept do you think this shows?"
              rows={5}
              maxLength={2000}
            />
            <Button
              className="rounded-full bg-primary text-primary-foreground hover:bg-accent"
              disabled={busy || room.hasSubmittedCurrent || room.explainStage === 'view' || !explanation.trim()}
              onClick={() => void handleSubmitExplanation()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {room.hasSubmittedCurrent ? 'Submitted — waiting for others' : 'Submit explanation'}
            </Button>
          </CardContent>
        </Card>
      )}

      {(room.status === 'reveal' || room.status === 'ended') && (
        <Card className="card-shadow border-border bg-card">
          <CardHeader>
            <CardTitle>{t('squad.relay.reveal')}</CardTitle>
            <p className="text-sm text-muted-foreground">No scores — the drift is the point.</p>
          </CardHeader>
          <CardContent>
            <RevealChains room={room} />
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}

export default function StudyRelayPage() {
  const [searchParams] = useSearchParams();
  const mock = searchParams.get('mock') === '1';

  if (mock) {
    return (
      <StudyRelayMockProvider>
        <StudyRelayInner />
      </StudyRelayMockProvider>
    );
  }

  return <StudyRelayInner />;
}
