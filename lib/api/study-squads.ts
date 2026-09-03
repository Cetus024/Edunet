'use client';

import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api/client';

export type StudySquadMember = {
  id: string;
  name: string;
  image: string | null;
  role: 'owner' | 'member';
  joinedAt: string;
  streakDays: number;
  overallMemoryScore: number | null;
  subjects: Array<{
    id: string;
    name: string;
    score: number;
    topics: Array<{ id: string; name: string; score: number }>;
  }>;
};

export type StudySquadInvitation = {
  id: string;
  email: string;
  userId: string | null;
  name: string | null;
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'in_app';
  expiresAt: string;
  createdAt: string;
};

export type StudySquad = {
  id: string;
  name: string;
  role: 'owner' | 'member';
  members: StudySquadMember[];
  pendingInvitations: StudySquadInvitation[];
  streak: {
    currentDays: number;
    activeToday: boolean;
    restoresUsedThisMonth: number;
    restoresLimit: number;
    canRestore: boolean;
    restoreDate: string | null;
  };
  createdAt: string;
};

export type StudySquadResponse = { squad: StudySquad | null };

export type StudySquadInvitationPreview = {
  squadName: string;
  inviterName: string;
  expiresAt: string;
};

export const studySquadQueryKey = ['study-squad'] as const;
export const studySquadInvitationQueryKey = ['study-squad-invitation'] as const;
export const schoolDirectoryQueryKey = ['school-directory'] as const;

export type SchoolDirectoryPerson = {
  id: string;
  name: string;
  image: string | null;
  role: 'student' | 'teacher';
  status: 'available' | 'invited' | 'member' | 'in_other_squad' | 'teacher';
  canInvite: boolean;
};

export type SchoolDirectoryResponse = {
  school: { id: string; name: string };
  people: SchoolDirectoryPerson[];
};

export function useStudySquad(userId: string | null) {
  return useQuery({
    queryKey: [...studySquadQueryKey, userId ?? 'anonymous'],
    queryFn: () => apiRequest<StudySquadResponse>('/api/v1/me/study-squad'),
    enabled: Boolean(userId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function createStudySquad(name: string) {
  return apiRequest<StudySquadResponse>('/api/v1/me/study-squad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function inviteToStudySquad(email: string) {
  return apiRequest<{ invitation: StudySquadInvitation }>('/api/v1/me/study-squad/invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export function useSchoolDirectory(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...schoolDirectoryQueryKey, userId ?? 'anonymous'],
    queryFn: () => apiRequest<SchoolDirectoryResponse>('/api/v1/me/school-directory'),
    enabled: enabled && Boolean(userId),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function inviteSchoolUserToStudySquad(userId: string) {
  return apiRequest<{ invitation: StudySquadInvitation }>('/api/v1/me/study-squad/invitations/in-app', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
}

export function acceptInAppStudySquadInvitation(invitationId: string) {
  return apiRequest<StudySquadResponse>(
    `/api/v1/me/study-squad/invitations/${encodeURIComponent(invitationId)}/accept`,
    { method: 'POST' },
  );
}

export function declineInAppStudySquadInvitation(invitationId: string) {
  return apiRequest<{ invitationId: string; status: 'declined' }>(
    `/api/v1/me/study-squad/invitations/${encodeURIComponent(invitationId)}/decline`,
    { method: 'POST' },
  );
}

export function restoreStudySquadStreak() {
  return apiRequest<StudySquadResponse>('/api/v1/me/study-squad/streak/restore', {
    method: 'POST',
  });
}

export function useStudySquadInvitation(token: string | null) {
  return useQuery({
    queryKey: [...studySquadInvitationQueryKey, token ?? 'missing'],
    queryFn: () => apiRequest<{ invitation: StudySquadInvitationPreview }>(
      `/api/v1/study-squad-invitations/${encodeURIComponent(token ?? '')}`,
    ),
    enabled: Boolean(token),
    retry: false,
  });
}

export function acceptStudySquadInvitation(token: string) {
  return apiRequest<StudySquadResponse>(
    `/api/v1/study-squad-invitations/${encodeURIComponent(token)}/accept`,
    { method: 'POST' },
  );
}
