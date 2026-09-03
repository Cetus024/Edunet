'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCurrentAccount } from '@/lib/api/me';
import {
  joinSquadQuizRoom,
  squadQuizRoomQueryKey,
  useSquadQuizRoom,
  type SquadQuizAvatarColor,
} from '@/lib/api/squad-quiz';
import { useNavigate, useSearchParams } from '@/lib/navigation';

const avatarColors: SquadQuizAvatarColor[] = ['Yellow', 'LightBlue', 'White'];

function avatarClass(color: SquadQuizAvatarColor): string {
  if (color === 'Yellow') return 'bg-secondary text-secondary-foreground';
  if (color === 'LightBlue') return 'bg-accent text-accent-foreground';
  return 'bg-card text-card-foreground';
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'SN';
}

export default function RescueJoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: account } = useCurrentAccount();
  const roomId = searchParams.get('roomId') ?? searchParams.get('ctxRoomId');
  const roomQuery = useSquadQuizRoom(roomId, account?.user.id ?? null);
  const room = roomQuery.data?.room ?? null;
  const [avatarIndex, setAvatarIndex] = useState(0);
  const avatarColor = avatarColors[avatarIndex] ?? 'Yellow';
  const joinMutation = useMutation({
    mutationFn: () => joinSquadQuizRoom(roomId ?? '', avatarColor),
    onSuccess: (result) => {
      if (roomId && account) {
        queryClient.setQueryData(
          [...squadQuizRoomQueryKey, roomId, account.user.id],
          result,
        );
      }
      toast.success('Joined Rescue quiz');
      navigate(`/rescue-room?roomId=${encodeURIComponent(result.room.id)}`);
    },
    onError: (error) => {
      toast.error('Could not join this room', {
        description: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    },
  });

  useEffect(() => {
    if (room?.hasJoined && room.status === 'active') {
      navigate(`/rescue-room?roomId=${encodeURIComponent(room.id)}`);
    }
  }, [navigate, room?.hasJoined, room?.id, room?.status]);

  const cycleAvatar = (direction: -1 | 1) => {
    setAvatarIndex((current) => (current + direction + avatarColors.length) % avatarColors.length);
  };

  if (!roomId) {
    return <RoomMessage title="Missing room link" body="Open the invitation from Notifications and try again." />;
  }
  if (roomQuery.isPending || !account) {
    return <RoomMessage title="Loading Rescue quiz…" body="Checking your squad access and room status." loading />;
  }
  if (roomQuery.isError || !room) {
    return <RoomMessage title="Room unavailable" body={roomQuery.error instanceof Error ? roomQuery.error.message : 'This room could not be opened.'} />;
  }
  if (room.status === 'finished') {
    return <RoomMessage title="This Rescue quiz has finished" body="Open the final leaderboard to see the results." action={() => navigate(`/rescue-room?roomId=${encodeURIComponent(room.id)}`)} />;
  }
  if (room.hasJoined) {
    return <RoomMessage title="Opening your room…" body="You already joined this Rescue quiz." loading />;
  }

  const displayName = account.user.name;
  return (
    <div className="edunets-gradient flex items-center justify-center p-4 text-foreground sm:p-6 lg:p-8">
      <Card className="card-shadow w-full max-w-[460px] rounded-[20px] border-border bg-card text-card-foreground">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="text-center">
            <Badge className="mb-4 rounded-full border-0 bg-secondary text-secondary-foreground">Live Rescue Quiz</Badge>
            <h1 className="text-2xl font-bold">Join {room.hostName}&apos;s Rescue</h1>
            <p className="mt-2 text-muted-foreground">{room.subjectName} · {room.topicName}</p>
          </div>
          <div className="rounded-[16px] border border-border bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Joining as</p>
            <p className="mt-1 font-black">{displayName}</p>
          </div>
          <div className="flex items-center justify-center gap-4 rounded-[18px] bg-background p-5 text-foreground">
            <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => cycleAvatar(-1)} aria-label="Previous avatar color"><ChevronLeft className="h-5 w-5" /></Button>
            <div className={`flex h-24 w-24 items-center justify-center rounded-[28px] border border-border text-3xl font-black shadow-lg ${avatarClass(avatarColor)}`}>{initialsFor(displayName)}</div>
            <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => cycleAvatar(1)} aria-label="Next avatar color"><ChevronRight className="h-5 w-5" /></Button>
          </div>
          <Button disabled={joinMutation.isPending} onClick={() => joinMutation.mutate()} className="h-12 w-full rounded-full bg-primary text-primary-foreground hover:bg-accent">
            {joinMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Join Rescue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function RoomMessage({ title, body, loading = false, action }: {
  title: string;
  body: string;
  loading?: boolean;
  action?: () => void;
}) {
  return (
    <div className="edunets-gradient flex items-center justify-center p-4 text-foreground sm:p-6 lg:p-8">
      <Card className="card-shadow w-full max-w-[460px] rounded-[20px] border-border bg-card text-card-foreground">
        <CardContent className="space-y-4 p-8 text-center">
          {loading && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
          <h1 className="text-2xl font-black">{title}</h1>
          <p className="text-muted-foreground">{body}</p>
          {action && <Button onClick={action} className="rounded-full">Open leaderboard</Button>}
        </CardContent>
      </Card>
    </div>
  );
}
