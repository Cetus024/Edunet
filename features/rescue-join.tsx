'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { useAtom } from 'jotai';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { quizRoomParticipantsAtom, quizRoomsAtom, type AvatarColor, type QuizRoomDraft, type QuizRoomParticipantDraft } from '@/lib/study-data';
import { useUser } from '@/hooks/use-user';

const avatarColors: AvatarColor[] = ['Yellow', 'LightBlue', 'White'];

function avatarClass(color: AvatarColor): string {
  if (color === 'Yellow') return 'bg-secondary text-secondary-foreground';
  if (color === 'LightBlue') return 'bg-accent text-accent-foreground';
  return 'bg-card text-card-foreground';
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SN';
  return parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase() ?? '').join('');
}

export default function RescueJoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: user } = useUser();
  const [rooms, setRooms] = useAtom(quizRoomsAtom);
  const [, setParticipants] = useAtom(quizRoomParticipantsAtom);
  const roomId = searchParams.get('roomId') ?? searchParams.get('ctxRoomId') ?? 'demo-room-chemical-bonding';
  const room = rooms.find((item: QuizRoomDraft) => item.roomId === roomId);
  const senderName = room?.hostName ?? 'Maya';
  const defaultName = user?.fullName ?? room?.invitedName ?? 'Student';
  const userId = user?.userPrincipalName ?? user?.objectId ?? defaultName.toLowerCase().replace(/\s+/g, '-');
  const [displayName, setDisplayName] = useState(user?.fullName ?? room?.invitedName ?? 'Student');
  const [avatarIndex, setAvatarIndex] = useState(0);
  const avatarColor = avatarColors[avatarIndex] ?? 'Yellow';
  useEffect(() => {
    setDisplayName(user?.fullName ?? room?.invitedName ?? 'Student');
  }, [room?.invitedName, user?.fullName]);

  const activeRoom = useMemo<QuizRoomDraft>(() => {
    if (room) return room;
    const now = Date.now();
    return {
      roomId,
      hostUserId: 'maya',
      hostName: senderName,
      invitedName: defaultName,
      subject: 'Chemistry',
      topic: 'Covalent Bonding',
      questionSetId: 'chem-bonding-rescue',
      status: 'active',
      currentQuestionIndex: 0,
      roundNumber: 1,
      totalRounds: 3,
      questionStartedAt: now,
      createdAt: now,
    };
  }, [defaultName, room, roomId, senderName]);

  const cycleAvatar = (direction: -1 | 1) => {
    setAvatarIndex((current: number) => (current + direction + avatarColors.length) % avatarColors.length);
  };

  const joinRescue = () => {
    const name = displayName.trim() || defaultName;
    if (!room) {
      setRooms((currentRooms: QuizRoomDraft[]) => [activeRoom, ...currentRooms]);
    }
    const participant: QuizRoomParticipantDraft = {
      participantId: `${userId}-${roomId}`,
      roomId,
      userId,
      displayName: name,
      avatarColor,
      score: 0,
      lastAnswerCorrect: false,
      joinedAt: Date.now(),
    };
    setParticipants((currentParticipants: QuizRoomParticipantDraft[]) => [
      participant,
      ...currentParticipants.filter((item: QuizRoomParticipantDraft) => !(item.roomId === roomId && item.userId === userId)),
    ]);
    toast.success('Joined Rescue room');
    navigate(`/rescue-room?roomId=${encodeURIComponent(roomId)}&joined=1`);
  };

  return (
    <div className="edunets-gradient flex items-center justify-center p-4 text-foreground sm:p-6 lg:p-8">
      <Card className="card-shadow w-full max-w-[460px] rounded-[20px] border-border bg-card text-card-foreground">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="text-center">
            <Badge className="mb-4 rounded-full border-0 bg-secondary text-secondary-foreground">Rescue Sprint</Badge>
            <h1 className="text-2xl font-bold">Join {senderName}&apos;s Rescue</h1>
            <p className="mt-2 text-muted-foreground">Enter your name, choose an initials avatar, then drop into the shared live quiz room.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground" htmlFor="txt-name">Name</label>
            <Input id="txt-name" value={displayName} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDisplayName(event.target.value)} className="h-12 rounded-[16px]" />
          </div>
          <div className="flex items-center justify-center gap-4 rounded-[18px] bg-background p-5 text-foreground">
            <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => cycleAvatar(-1)} aria-label="Previous avatar color"><ChevronLeft className="h-5 w-5" /></Button>
            <div className={`flex h-24 w-24 items-center justify-center rounded-[28px] border border-border text-3xl font-black shadow-lg ${avatarClass(avatarColor)}`}>{initialsFor(displayName)}</div>
            <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => cycleAvatar(1)} aria-label="Next avatar color"><ChevronRight className="h-5 w-5" /></Button>
          </div>
          <Button onClick={joinRescue} className="h-12 w-full rounded-full bg-primary text-primary-foreground hover:bg-accent">Join Rescue <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </CardContent>
      </Card>
    </div>
  );
}
