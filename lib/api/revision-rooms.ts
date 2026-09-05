'use client';

import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api/client';

export type RevisionRoomPresence = 'invited' | 'online' | 'away' | 'finished' | 'left';

export type RevisionRoom = {
  id: string;
  squadId: string;
  squadName: string | null;
  hostUserId: string;
  hostName: string;
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  status: 'lobby' | 'live' | 'reviewing' | 'ended';
  durationSeconds: number;
  joinCode: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  serverNow: string;
  canManage: boolean;
  hasJoined: boolean;
  canJoin: boolean;
  participants: Array<{
    userId: string;
    displayName: string;
    image: string | null;
    status: 'invited' | 'joined' | 'left';
    presence: RevisionRoomPresence;
    speakingMs: number;
    joinedAt: string;
    leftAt: string | null;
    lastSeenAt: string;
  }>;
  utterances: Array<{
    id: string;
    userId: string;
    displayName: string;
    text: string;
    locale: string;
    provider: 'browser' | 'huawei';
    spokenAt: string;
    createdAt: string;
  }>;
};

export type RevisionRoomResponse = { room: RevisionRoom };
export const revisionRoomQueryKey = ['revision-room'] as const;

export function useRevisionRoom(roomId: string | null, userId: string | null) {
  return useQuery({
    queryKey: [...revisionRoomQueryKey, roomId ?? 'missing', userId ?? 'anonymous'],
    queryFn: () => apiRequest<RevisionRoomResponse>(
      `/api/v1/me/revision-rooms/${encodeURIComponent(roomId ?? '')}`,
    ),
    enabled: Boolean(roomId && userId),
    refetchInterval: (query) => query.state.data?.room.status === 'ended' ? false : 2_000,
    staleTime: 1_000,
    retry: false,
  });
}

function roomAction(roomId: string, action: string) {
  return apiRequest<RevisionRoomResponse>(
    `/api/v1/me/revision-rooms/${encodeURIComponent(roomId)}/${action}`,
    { method: 'POST' },
  );
}

export function createRevisionRoom(topicId: string, invitedUserIds: string[]) {
  return apiRequest<RevisionRoomResponse>('/api/v1/me/revision-rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicId, invitedUserIds }),
  });
}

export const joinRevisionRoom = (roomId: string) => roomAction(roomId, 'join');
export const heartbeatRevisionRoom = (roomId: string) => roomAction(roomId, 'heartbeat');
export const startRevisionRoom = (roomId: string) => roomAction(roomId, 'start');
export const endRevisionRoom = (roomId: string) => roomAction(roomId, 'end');
