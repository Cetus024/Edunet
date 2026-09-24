'use client';

import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, CheckCheck, GraduationCap, Loader2, Users, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentAccount } from '@/lib/api/me';
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationsQueryKey,
  useNotifications,
  type AppNotification,
} from '@/lib/api/notifications';
import {
  acceptInAppStudySquadInvitation,
  declineInAppStudySquadInvitation,
  schoolDirectoryQueryKey,
  studySquadQueryKey,
} from '@/lib/api/study-squads';
import { useNavigate } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: account } = useCurrentAccount();
  const notificationQuery = useNotifications(account?.user.id ?? null);

  const refreshNotifications = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
      queryClient.invalidateQueries({ queryKey: studySquadQueryKey }),
      queryClient.invalidateQueries({ queryKey: schoolDirectoryQueryKey }),
    ]);
  };

  const readMutation = useMutation({
    mutationFn: (notification: AppNotification) => markNotificationRead(notification.id),
    onSuccess: async (_result, notification) => {
      await refreshNotifications();
      navigate(notification.href);
    },
  });
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: refreshNotifications,
  });
  const acceptMutation = useMutation({
    mutationFn: (invitationId: string) => acceptInAppStudySquadInvitation(invitationId),
    onSuccess: async (result) => {
      await refreshNotifications();
      toast.success(`You joined ${result.squad?.name ?? 'the study squad'}.`);
      navigate('/study-squad');
    },
    onError: (error) => toast.error('Invitation not accepted', {
      description: error instanceof Error ? error.message : 'Try again.',
    }),
  });
  const declineMutation = useMutation({
    mutationFn: (invitationId: string) => declineInAppStudySquadInvitation(invitationId),
    onSuccess: async () => {
      await refreshNotifications();
      toast.success('Squad invitation declined.');
    },
    onError: (error) => toast.error('Invitation not declined', {
      description: error instanceof Error ? error.message : 'Try again.',
    }),
  });

  const notifications = notificationQuery.data?.notifications ?? [];
  const isResponding = acceptMutation.isPending || declineMutation.isPending;

  return (
    <div className="pattern-overlay min-h-screen bg-background p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card className="card-shadow border-border bg-card text-card-foreground">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl"><Bell className="h-6 w-6" /> Notifications</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">Teacher messages and Study Squad activity in one place.</p>
            </div>
            {(notificationQuery.data?.unreadCount ?? 0) > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={readAllMutation.isPending}
                onClick={() => readAllMutation.mutate()}
                className="rounded-full"
              >
                <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
              </Button>
            )}
          </CardHeader>
        </Card>

        {notificationQuery.isPending ? (
          <Card><CardContent className="flex items-center justify-center gap-3 p-10 font-bold"><Loader2 className="h-5 w-5 animate-spin" /> Loading notifications…</CardContent></Card>
        ) : notificationQuery.error ? (
          <Card><CardContent className="p-8 text-center"><p className="font-bold">Couldn’t load notifications.</p><Button onClick={() => void notificationQuery.refetch()} variant="outline" className="mt-4 rounded-full">Try again</Button></CardContent></Card>
        ) : notifications.length === 0 ? (
          <Card><CardContent className="p-10 text-center"><CheckCheck className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-4 text-lg font-black">You’re all caught up</p><p className="mt-1 text-sm text-muted-foreground">New teacher messages and squad invitations will appear here.</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const isSquadInvitation = notification.type === 'squad_invitation' && notification.resourceId;
              const ChannelIcon = notification.channel === 'teacher' ? GraduationCap : Users;
              return (
                <Card key={notification.id} className={cn('border-border bg-card', !notification.readAt && 'border-l-4 border-l-primary')}>
                  <CardContent className="flex gap-4 p-5">
                    <span className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                      notification.channel === 'teacher' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground',
                    )}>
                      <ChannelIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-black">{notification.title}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full">
                          {notification.channel === 'teacher' ? 'Teacher' : 'Study Squad'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {isSquadInvitation ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={isResponding}
                              onClick={() => acceptMutation.mutate(notification.resourceId!)}
                              className="rounded-full"
                            >
                              <Check className="mr-2 h-4 w-4" /> Accept
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isResponding}
                              onClick={() => declineMutation.mutate(notification.resourceId!)}
                              className="rounded-full"
                            >
                              <X className="mr-2 h-4 w-4" /> Decline
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={readMutation.isPending}
                            onClick={() => readMutation.mutate(notification)}
                            className="rounded-full"
                          >
                            Open
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
