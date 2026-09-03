'use client';

import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api/client';

export type NotificationChannel = 'teacher' | 'study_squad';
export type NotificationType =
  | 'teacher_enquiry'
  | 'teacher_reply'
  | 'squad_invitation'
  | 'squad_invitation_accepted'
  | 'squad_invitation_declined'
  | 'squad_streak_restored'
  | 'squad_quiz_invitation'
  | 'squad_quiz_finished'
  | 'revision_room_invitation'
  | 'revision_room_started';

export type AppNotification = {
  id: string;
  channel: NotificationChannel;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  resourceId: string | null;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; name: string; image: string | null } | null;
};

export type NotificationsResponse = {
  unreadCount: number;
  notifications: AppNotification[];
};

export const notificationsQueryKey = ['notifications'] as const;

function visiblePollingInterval() {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible' ? 15_000 : false;
}

export function useNotifications(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...notificationsQueryKey, userId ?? 'anonymous'],
    queryFn: () => apiRequest<NotificationsResponse>('/api/v1/me/notifications?limit=50'),
    enabled: enabled && Boolean(userId),
    staleTime: 5_000,
    refetchInterval: visiblePollingInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<{ notificationId: string; readAt: string }>(
    `/api/v1/me/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: 'PUT' },
  );
}

export function markAllNotificationsRead() {
  return apiRequest<{ readAt: string }>('/api/v1/me/notifications/read-all', {
    method: 'PUT',
  });
}
