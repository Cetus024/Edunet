'use client';

import { useQuery } from '@tanstack/react-query';

import { API_BASE_URL, ApiConnectionError, ApiError } from '@/lib/api/client';

export type StudyRelayStatus = 'lobby' | 'drawing' | 'explaining' | 'reveal' | 'ended';

export type StudyRelayRoom = {
  id: string;
  code: string;
  subject: 'chemistry' | 'mathematics';
  status: StudyRelayStatus;
  currentHop: number;
  minPlayers: number;
  maxPlayers: number;
  squadId: string | null;
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  explainStage: 'view' | 'write' | null;
  explainViewSeconds: number;
  drawingSeconds: number;
  explainWriteSeconds: number;
  serverNow: string;
  createdAt: string;
  updatedAt: string;
  hostPlayerId: string;
  canStart: boolean;
  playerCount: number;
  viewer: {
    playerId: string;
    displayName: string;
    seatIndex: number;
    isHost: boolean;
  };
  players: Array<{
    id: string;
    displayName: string;
    seatIndex: number;
    isHost: boolean;
    isConnected: boolean;
    lastSeenAt: string;
  }>;
  assignment: {
    chainId: string;
    hopIndex: number;
    type: 'drawing' | 'explanation';
    concept: string | null;
    imageUrl: string | null;
    priorText: string | null;
  } | null;
  hasSubmittedCurrent: boolean;
  chains: Array<{
    chainId: string;
    promptId: string;
    concept: string;
    referenceNote: string | null;
    drawerPlayerId: string;
    hops: Array<{
      hopIndex: number;
      type: 'drawing' | 'explanation';
      skipped: boolean;
      imageUrl: string | null;
      text: string | null;
      playerId: string;
      displayName: string;
    }>;
  }>;
};

export type StudyRelayRoomResponse = {
  room: StudyRelayRoom;
  playerToken?: string;
};

const SESSION_KEY = 'edunets-study-relay-session';

export type StudyRelaySession = {
  roomId: string;
  playerToken: string;
  playerId: string;
  displayName: string;
};

export function loadStudyRelaySession(): StudyRelaySession | null {
  try {
    const raw = globalThis.localStorage?.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudyRelaySession;
    if (!parsed?.roomId || !parsed?.playerToken) return null;
    return {
      roomId: parsed.roomId,
      playerToken: parsed.playerToken,
      playerId: parsed.playerId ?? '',
      displayName: parsed.displayName ?? '',
    };
  } catch {
    return null;
  }
}

export function saveStudyRelaySession(session: StudyRelaySession) {
  globalThis.localStorage?.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStudyRelaySession() {
  globalThis.localStorage?.removeItem(SESSION_KEY);
}

async function studyRelayRequest<T>(
  path: string,
  init: RequestInit = {},
  playerToken?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (playerToken) headers.set('X-Study-Relay-Token', playerToken);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    });
  } catch {
    throw new ApiConnectionError();
  }

  let payload: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorPayload = payload as { error?: { code?: string; message?: string; requestId?: string } } | null;
    throw new ApiError({
      status: response.status,
      code: errorPayload?.error?.code ?? 'API_REQUEST_FAILED',
      message: errorPayload?.error?.message ?? `Request failed (${response.status}).`,
      requestId: errorPayload?.error?.requestId,
    });
  }

  return payload as T;
}

export const studyRelayRoomQueryKey = ['study-relay-room'] as const;

export function useStudyRelayRoom(roomId: string | null, playerToken: string | null, options?: {
  pollWhenDisconnected?: boolean;
}) {
  return useQuery({
    queryKey: [...studyRelayRoomQueryKey, roomId ?? 'missing', playerToken ?? 'none'],
    queryFn: () => studyRelayRequest<StudyRelayRoomResponse>(
      `/api/v1/study-relay/rooms/${encodeURIComponent(roomId ?? '')}`,
      { method: 'GET' },
      playerToken,
    ),
    enabled: Boolean(roomId && playerToken),
    refetchInterval: (query) => {
      const status = query.state.data?.room.status;
      if (status === 'reveal' || status === 'ended') return false;
      return options?.pollWhenDisconnected === false ? false : 5_000;
    },
    staleTime: 1_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function createStudyRelayRoom(input: {
  displayName: string;
  subject?: 'chemistry' | 'mathematics';
  squadId?: string;
}) {
  return studyRelayRequest<StudyRelayRoomResponse>('/api/v1/study-relay/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function joinStudyRelayRoom(input: { code: string; displayName: string }) {
  return studyRelayRequest<StudyRelayRoomResponse>('/api/v1/study-relay/rooms/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function startStudyRelayRoom(roomId: string, playerToken: string) {
  return studyRelayRequest<StudyRelayRoomResponse>(
    `/api/v1/study-relay/rooms/${encodeURIComponent(roomId)}/start`,
    { method: 'POST' },
    playerToken,
  );
}

export function requestDrawingUploadUrl(roomId: string, playerToken: string) {
  return studyRelayRequest<{
    path: string;
    signedUrl: string;
    token: string;
  }>(
    `/api/v1/study-relay/rooms/${encodeURIComponent(roomId)}/drawings/upload-url`,
    { method: 'POST' },
    playerToken,
  );
}

export function submitDrawing(roomId: string, playerToken: string, path: string) {
  return studyRelayRequest<StudyRelayRoomResponse>(
    `/api/v1/study-relay/rooms/${encodeURIComponent(roomId)}/submissions/drawing`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    },
    playerToken,
  );
}

export function submitExplanation(roomId: string, playerToken: string, text: string) {
  return studyRelayRequest<StudyRelayRoomResponse>(
    `/api/v1/study-relay/rooms/${encodeURIComponent(roomId)}/submissions/explanation`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    },
    playerToken,
  );
}

export function heartbeatStudyRelayRoom(roomId: string, playerToken: string) {
  return studyRelayRequest<{ lastSeenAt: string }>(
    `/api/v1/study-relay/rooms/${encodeURIComponent(roomId)}/heartbeat`,
    { method: 'POST' },
    playerToken,
  );
}

export async function uploadDrawingPng(
  roomId: string,
  playerToken: string,
  dataUrl: string,
): Promise<string> {
  const upload = await requestDrawingUploadUrl(roomId, playerToken);
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const put = await fetch(upload.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: blob,
  });
  if (!put.ok) {
    throw new ApiError({
      status: put.status,
      code: 'STUDY_RELAY_UPLOAD_FAILED',
      message: 'Could not upload the drawing to storage.',
    });
  }
  return upload.path;
}
