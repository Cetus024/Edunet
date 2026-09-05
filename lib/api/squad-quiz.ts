'use client';

import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api/client';

export type SquadQuizAvatarColor = 'Yellow' | 'LightBlue' | 'White';
export type SquadQuizParticipantPresence = 'invited' | 'online' | 'away' | 'finished' | 'left';

export type SquadQuizRoom = {
  id: string;
  squadId: string;
  squadName: string;
  hostUserId: string;
  hostName: string;
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  status: 'active' | 'finished';
  currentQuestionIndex: number;
  totalRounds: number;
  questionStartedAt: string;
  questionEndsAt: string;
  serverNow: string;
  restartCount: number;
  createdAt: string;
  finishedAt: string | null;
  canManage: boolean;
  hasJoined: boolean;
  currentQuestion: {
    questionIndex: number;
    questionKey: string;
    type: 'mcq' | 'fill-blank' | 'structured' | 'diagram';
    text: string;
    options: string[] | null;
  };
  currentUserAnswer: {
    isCorrect: boolean;
    points: number;
    explanation: string;
  } | null;
  participants: Array<{
    userId: string;
    displayName: string;
    avatarColor: SquadQuizAvatarColor;
    status: 'invited' | 'joined' | 'answered' | 'finished' | 'left';
    presence: SquadQuizParticipantPresence;
    score: number;
    lastAnswerCorrect: boolean | null;
    answeredCurrent: boolean;
    joinedAt: string | null;
    lastSeenAt: string | null;
  }>;
};

export type SquadQuizRoomResponse = { room: SquadQuizRoom };

export const squadQuizRoomQueryKey = ['squad-quiz-room'] as const;

export function useSquadQuizRoom(roomId: string | null, userId: string | null) {
  return useQuery({
    queryKey: [...squadQuizRoomQueryKey, roomId ?? 'missing', userId ?? 'anonymous'],
    queryFn: () => apiRequest<SquadQuizRoomResponse>(
      `/api/v1/me/squad-quiz-rooms/${encodeURIComponent(roomId ?? '')}`,
    ),
    enabled: Boolean(roomId && userId),
    refetchInterval: (query) => query.state.data?.room.status === 'finished' ? false : 2_000,
    staleTime: 1_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
  });
}

export function createSquadQuizRoom(input: {
  topicId: string;
  invitedUserIds: string[];
  message?: string;
}) {
  return apiRequest<SquadQuizRoomResponse>('/api/v1/me/squad-quiz-rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function joinSquadQuizRoom(roomId: string, avatarColor: SquadQuizAvatarColor) {
  return apiRequest<SquadQuizRoomResponse>(
    `/api/v1/me/squad-quiz-rooms/${encodeURIComponent(roomId)}/join`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarColor }),
    },
  );
}

export function heartbeatSquadQuizRoom(roomId: string) {
  return apiRequest<{ lastSeenAt: string }>(
    `/api/v1/me/squad-quiz-rooms/${encodeURIComponent(roomId)}/heartbeat`,
    { method: 'POST' },
  );
}

export function advanceSquadQuizRoom(roomId: string) {
  return apiRequest<SquadQuizRoomResponse>(
    `/api/v1/me/squad-quiz-rooms/${encodeURIComponent(roomId)}/advance`,
    { method: 'POST' },
  );
}

export function restartSquadQuizRoom(roomId: string) {
  return apiRequest<SquadQuizRoomResponse>(
    `/api/v1/me/squad-quiz-rooms/${encodeURIComponent(roomId)}/restart`,
    { method: 'POST' },
  );
}

export function inviteSquadQuizParticipants(roomId: string, userIds: string[]) {
  return apiRequest<SquadQuizRoomResponse>(
    `/api/v1/me/squad-quiz-rooms/${encodeURIComponent(roomId)}/invitations`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds }),
    },
  );
}
