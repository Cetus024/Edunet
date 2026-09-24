'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { CHEMISTRY_STUDY_PROMPTS } from '@/lib/study-relay-prompts';
import type { StudyRelayRoom, StudyRelayRoomResponse } from '@/lib/api/study-relay';

type MockPlayer = {
  id: string;
  displayName: string;
  seatIndex: number;
  isHost: boolean;
};

type MockSubmission = {
  chainId: string;
  hopIndex: number;
  type: 'drawing' | 'explanation';
  playerId: string;
  imageUrl: string | null;
  text: string | null;
  skipped: boolean;
};

type MockState = {
  roomId: string;
  code: string;
  status: StudyRelayRoom['status'];
  currentHop: number;
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  players: MockPlayer[];
  viewerId: string;
  prompts: Array<{ chainId: string; promptId: string; drawerPlayerId: string; seatIndex: number }>;
  submissions: MockSubmission[];
};

type StudyRelayMockApi = {
  enabled: boolean;
  createRoom: (displayName: string) => StudyRelayRoomResponse;
  joinRoom: (code: string, displayName: string) => StudyRelayRoomResponse;
  getRoom: () => StudyRelayRoomResponse | null;
  startRoom: () => StudyRelayRoomResponse;
  submitDrawing: (imageUrl: string) => StudyRelayRoomResponse;
  submitExplanation: (text: string) => StudyRelayRoomResponse;
  addBotPlayers: (count?: number) => StudyRelayRoomResponse;
};

const MockContext = createContext<StudyRelayMockApi | null>(null);

function buildResponse(state: MockState): StudyRelayRoomResponse {
  const viewer = state.players.find((player) => player.id === state.viewerId)!;
  const now = new Date();
  let explainStage: 'view' | 'write' | null = null;
  if (state.status === 'explaining' && state.phaseStartedAt) {
    const elapsed = now.getTime() - new Date(state.phaseStartedAt).getTime();
    explainStage = elapsed < 30_000 ? 'view' : 'write';
  }

  const assignment = (() => {
    if (state.status === 'drawing') {
      const prompt = state.prompts.find((row) => row.drawerPlayerId === viewer.id);
      if (!prompt) return null;
      const concept = CHEMISTRY_STUDY_PROMPTS.find((item) => item.id === prompt.promptId);
      return {
        chainId: prompt.chainId,
        hopIndex: 0,
        type: 'drawing' as const,
        concept: concept?.concept ?? prompt.promptId,
        imageUrl: null,
        priorText: null,
      };
    }
    if (state.status === 'explaining') {
      const chainSeat = ((viewer.seatIndex - state.currentHop) % state.players.length + state.players.length)
        % state.players.length;
      const prompt = state.prompts.find((row) => row.seatIndex === chainSeat);
      if (!prompt) return null;
      const prior = [...state.submissions]
        .filter((row) => row.chainId === prompt.chainId && row.hopIndex < state.currentHop && !row.skipped)
        .sort((a, b) => b.hopIndex - a.hopIndex)[0];
      return {
        chainId: prompt.chainId,
        hopIndex: state.currentHop,
        type: 'explanation' as const,
        concept: null,
        imageUrl: prior?.type === 'drawing' ? prior.imageUrl : null,
        priorText: prior?.type === 'explanation' ? prior.text : null,
      };
    }
    return null;
  })();

  const hasSubmittedCurrent = Boolean(
    assignment
    && state.submissions.some((row) => (
      row.chainId === assignment.chainId
      && row.hopIndex === assignment.hopIndex
      && row.playerId === viewer.id
    )),
  );

  const chains = state.status === 'reveal' || state.status === 'ended'
    ? state.prompts.map((prompt) => {
      const seed = CHEMISTRY_STUDY_PROMPTS.find((item) => item.id === prompt.promptId);
      return {
        chainId: prompt.chainId,
        promptId: prompt.promptId,
        concept: seed?.concept ?? prompt.promptId,
        referenceNote: seed?.referenceNote ?? null,
        drawerPlayerId: prompt.drawerPlayerId,
        hops: state.submissions
          .filter((row) => row.chainId === prompt.chainId)
          .sort((a, b) => a.hopIndex - b.hopIndex)
          .map((row) => {
            const author = state.players.find((player) => player.id === row.playerId);
            return {
              hopIndex: row.hopIndex,
              type: row.type,
              skipped: row.skipped,
              imageUrl: row.imageUrl,
              text: row.text,
              playerId: row.playerId,
              displayName: author?.displayName ?? 'Player',
            };
          }),
      };
    })
    : [];

  return {
    room: {
      id: state.roomId,
      code: state.code,
      subject: 'chemistry',
      status: state.status,
      currentHop: state.currentHop,
      minPlayers: 3,
      maxPlayers: 10,
      squadId: null,
      phaseStartedAt: state.phaseStartedAt,
      phaseEndsAt: state.phaseEndsAt,
      explainStage,
      explainViewSeconds: 30,
      drawingSeconds: 60,
      explainWriteSeconds: 90,
      serverNow: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      hostPlayerId: state.players.find((player) => player.isHost)?.id ?? viewer.id,
      canStart: viewer.isHost && state.status === 'lobby' && state.players.length >= 3,
      playerCount: state.players.length,
      viewer: {
        playerId: viewer.id,
        displayName: viewer.displayName,
        seatIndex: viewer.seatIndex,
        isHost: viewer.isHost,
      },
      players: state.players.map((player) => ({
        ...player,
        isConnected: true,
        lastSeenAt: now.toISOString(),
      })),
      assignment,
      hasSubmittedCurrent,
      chains,
    },
    playerToken: 'mock-token',
  };
}

function maybeAdvance(state: MockState): MockState {
  if (state.status !== 'drawing' && state.status !== 'explaining') return state;
  if (!state.phaseEndsAt) return state;
  const now = Date.now();
  const allIn = state.prompts.every((prompt) => (
    state.submissions.some((row) => row.chainId === prompt.chainId && row.hopIndex === state.currentHop)
  ));
  const timedOut = now >= new Date(state.phaseEndsAt).getTime();
  if (!allIn && !timedOut) return state;

  const submissions = [...state.submissions];
  for (const prompt of state.prompts) {
    if (submissions.some((row) => row.chainId === prompt.chainId && row.hopIndex === state.currentHop)) continue;
    const playerSeat = (prompt.seatIndex + state.currentHop) % state.players.length;
    const player = state.players.find((row) => row.seatIndex === playerSeat)!;
    submissions.push({
      chainId: prompt.chainId,
      hopIndex: state.currentHop,
      type: state.currentHop === 0 ? 'drawing' : 'explanation',
      playerId: player.id,
      imageUrl: null,
      text: null,
      skipped: true,
    });
  }

  const nextHop = state.currentHop + 1;
  if (nextHop >= state.players.length) {
    return {
      ...state,
      status: 'reveal',
      submissions,
      phaseStartedAt: new Date().toISOString(),
      phaseEndsAt: null,
    };
  }

  const started = new Date();
  return {
    ...state,
    status: 'explaining',
    currentHop: nextHop,
    submissions,
    phaseStartedAt: started.toISOString(),
    phaseEndsAt: new Date(started.getTime() + 120_000).toISOString(),
  };
}

export function StudyRelayMockProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MockState | null>(null);

  const createRoom = useCallback((displayName: string) => {
    const hostId = crypto.randomUUID();
    const next: MockState = {
      roomId: crypto.randomUUID(),
      code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: 'lobby',
      currentHop: 0,
      phaseStartedAt: null,
      phaseEndsAt: null,
      viewerId: hostId,
      players: [{ id: hostId, displayName, seatIndex: 0, isHost: true }],
      prompts: [],
      submissions: [],
    };
    setState(next);
    return buildResponse(next);
  }, []);

  const joinRoom = useCallback((code: string, displayName: string) => {
    setState((current) => {
      if (!current) {
        const hostId = crypto.randomUUID();
        const guestId = crypto.randomUUID();
        return {
          roomId: crypto.randomUUID(),
          code: code.toUpperCase(),
          status: 'lobby',
          currentHop: 0,
          phaseStartedAt: null,
          phaseEndsAt: null,
          viewerId: guestId,
          players: [
            { id: hostId, displayName: 'Host', seatIndex: 0, isHost: true },
            { id: guestId, displayName, seatIndex: 1, isHost: false },
          ],
          prompts: [],
          submissions: [],
        };
      }
      const guestId = crypto.randomUUID();
      return {
        ...current,
        code: code.toUpperCase(),
        viewerId: guestId,
        players: [
          ...current.players,
          {
            id: guestId,
            displayName,
            seatIndex: current.players.length,
            isHost: false,
          },
        ],
      };
    });
    // Return is approximate; caller should re-read via getRoom after state settles.
    const hostId = crypto.randomUUID();
    const guestId = crypto.randomUUID();
    const fallback: MockState = {
      roomId: crypto.randomUUID(),
      code: code.toUpperCase(),
      status: 'lobby',
      currentHop: 0,
      phaseStartedAt: null,
      phaseEndsAt: null,
      viewerId: guestId,
      players: [
        { id: hostId, displayName: 'Host', seatIndex: 0, isHost: true },
        { id: guestId, displayName, seatIndex: 1, isHost: false },
      ],
      prompts: [],
      submissions: [],
    };
    return buildResponse(state ?? fallback);
  }, [state]);

  const getRoom = useCallback(() => {
    if (!state) return null;
    const advanced = maybeAdvance(state);
    if (advanced !== state) setState(advanced);
    return buildResponse(advanced);
  }, [state]);

  const addBotPlayers = useCallback((count = 2) => {
    setState((current) => {
      if (!current) return current;
      const bots: MockPlayer[] = [];
      for (let index = 0; index < count; index += 1) {
        bots.push({
          id: crypto.randomUUID(),
          displayName: `Bot ${current.players.length + index + 1}`,
          seatIndex: current.players.length + index,
          isHost: false,
        });
      }
      return { ...current, players: [...current.players, ...bots] };
    });
    return getRoom() ?? buildResponse(state!);
  }, [getRoom, state]);

  const startRoom = useCallback(() => {
    setState((current) => {
      if (!current || current.players.length < 3) return current;
      const started = new Date();
      const prompts = current.players.map((player, index) => ({
        chainId: crypto.randomUUID(),
        promptId: CHEMISTRY_STUDY_PROMPTS[index % CHEMISTRY_STUDY_PROMPTS.length]!.id,
        drawerPlayerId: player.id,
        seatIndex: player.seatIndex,
      }));
      return {
        ...current,
        status: 'drawing',
        currentHop: 0,
        prompts,
        phaseStartedAt: started.toISOString(),
        phaseEndsAt: new Date(started.getTime() + 60_000).toISOString(),
      };
    });
    return getRoom() ?? buildResponse(state!);
  }, [getRoom, state]);

  const submitDrawing = useCallback((imageUrl: string) => {
    setState((current) => {
      if (!current || current.status !== 'drawing') return current;
      const prompt = current.prompts.find((row) => row.drawerPlayerId === current.viewerId);
      if (!prompt) return current;
      const next: MockState = {
        ...current,
        submissions: [
          ...current.submissions,
          {
            chainId: prompt.chainId,
            hopIndex: 0,
            type: 'drawing',
            playerId: current.viewerId,
            imageUrl,
            text: null,
            skipped: false,
          },
        ],
      };
      // Auto-fill bots so a solo mock walkthrough can advance.
      for (const other of next.prompts) {
        if (other.drawerPlayerId === current.viewerId) continue;
        if (next.submissions.some((row) => row.chainId === other.chainId && row.hopIndex === 0)) continue;
        next.submissions.push({
          chainId: other.chainId,
          hopIndex: 0,
          type: 'drawing',
          playerId: other.drawerPlayerId,
          imageUrl: 'https://placehold.co/400x300/png?text=Bot+drawing',
          text: null,
          skipped: false,
        });
      }
      return maybeAdvance(next);
    });
    return getRoom() ?? buildResponse(state!);
  }, [getRoom, state]);

  const submitExplanation = useCallback((text: string) => {
    setState((current) => {
      if (!current || current.status !== 'explaining') return current;
      const viewer = current.players.find((player) => player.id === current.viewerId)!;
      const chainSeat = ((viewer.seatIndex - current.currentHop) % current.players.length + current.players.length)
        % current.players.length;
      const prompt = current.prompts.find((row) => row.seatIndex === chainSeat);
      if (!prompt) return current;
      const next: MockState = {
        ...current,
        submissions: [
          ...current.submissions,
          {
            chainId: prompt.chainId,
            hopIndex: current.currentHop,
            type: 'explanation',
            playerId: current.viewerId,
            imageUrl: null,
            text,
            skipped: false,
          },
        ],
      };
      for (const other of next.prompts) {
        if (next.submissions.some((row) => row.chainId === other.chainId && row.hopIndex === current.currentHop)) {
          continue;
        }
        const playerSeat = (other.seatIndex + current.currentHop) % current.players.length;
        const player = current.players.find((row) => row.seatIndex === playerSeat)!;
        if (player.id === current.viewerId) continue;
        next.submissions.push({
          chainId: other.chainId,
          hopIndex: current.currentHop,
          type: 'explanation',
          playerId: player.id,
          imageUrl: null,
          text: 'Bot explanation of the drawing.',
          skipped: false,
        });
      }
      return maybeAdvance(next);
    });
    return getRoom() ?? buildResponse(state!);
  }, [getRoom, state]);

  const value = useMemo<StudyRelayMockApi>(() => ({
    enabled: true,
    createRoom,
    joinRoom,
    getRoom,
    startRoom,
    submitDrawing,
    submitExplanation,
    addBotPlayers,
  }), [addBotPlayers, createRoom, getRoom, joinRoom, startRoom, submitDrawing, submitExplanation]);

  return <MockContext.Provider value={value}>{children}</MockContext.Provider>;
}

export function useStudyRelayMock() {
  return useContext(MockContext);
}
