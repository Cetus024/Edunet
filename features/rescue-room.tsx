'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import { CheckCircle2, Flame, LogOut, RotateCcw, Send, Settings, Timer, Trophy, Users, XCircle } from 'lucide-react';
import { useAtom } from 'jotai';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  quizRoomParticipantsAtom,
  quizRoomsAtom,
  rescueActivityCompletionsAtom,
  rescueNudgeLogsAtom,
  type QuizRoomDraft,
  type QuizRoomParticipantDraft,
  type AvatarColor,
  type RescueActivityCompletion,
  type RescueNudgeLog,
} from '@/lib/study-data';
import { useUser } from '@/hooks/use-user';
import { getInitials, normalizeTopic, squadMembers, type SquadMember } from '@/lib/squad-data';
import { useMascotFeedback } from '@/features/mascot';

type RoomQuestionType = 'mcq' | 'fill-blank' | 'structured';
type AnswerState = 'idle' | 'correct' | 'incorrect';

type RoomQuestion = {
  id: number;
  type: RoomQuestionType;
  text: string;
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
};


const questionSeconds = 45;
const successFlashClass = 'border-primary bg-primary text-primary-foreground';

const rescueQuestions: RoomQuestion[] = [
  {
    id: 1,
    type: 'mcq',
    text: 'Which particle pair is shared in a covalent bond?',
    options: ['Protons', 'Neutrons', 'Electrons', 'Ions'],
    correctAnswer: 2,
    explanation: 'Covalent bonding happens when atoms share pairs of electrons.',
  },
  {
    id: 2,
    type: 'mcq',
    text: 'Which substance has a simple molecular structure?',
    options: ['Diamond', 'Graphite', 'Water', 'Sodium chloride'],
    correctAnswer: 2,
    explanation: 'Water exists as small molecules with covalent bonds inside each molecule.',
  },
  {
    id: 3,
    type: 'fill-blank',
    text: 'Covalent compounds usually have low melting points because intermolecular forces are _____.',
    correctAnswer: 'weak',
    explanation: 'The covalent bonds are strong, but forces between simple molecules are weak.',
  },
];

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SN';
  return parts.slice(0, 2).map((part: string) => part[0]?.toUpperCase() ?? '').join('');
}

function avatarClass(color: AvatarColor): string {
  if (color === 'Yellow') return 'bg-secondary text-secondary-foreground';
  if (color === 'LightBlue') return 'bg-accent text-accent-foreground';
  return 'bg-card text-card-foreground';
}

function avatarColorForSquadMember(member: SquadMember): AvatarColor {
  if (member.color === 'yellow') return 'Yellow';
  if (member.color === 'blue') return 'LightBlue';
  return 'White';
}

function isAnswerCorrect(question: RoomQuestion, answer: string | number): boolean {
  if (question.type === 'mcq') return answer === question.correctAnswer;
  return String(answer).toLowerCase().includes(String(question.correctAnswer).toLowerCase());
}

function formatSeconds(value: number): string {
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export default function RescueRoomPage() {
  const { notify } = useMascotFeedback();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedRoomId = searchParams.get('roomId') ?? searchParams.get('ctxRoomId') ?? 'demo-room-chemical-bonding';
  const role = searchParams.get('role');
  const joinedParam = searchParams.get('joined') === '1';
  const { data: user } = useUser();
  const [rooms, setRooms] = useAtom(quizRoomsAtom);
  const [participants, setParticipants] = useAtom(quizRoomParticipantsAtom);
  const [rescueLogs, setRescueLogs] = useAtom(rescueNudgeLogsAtom);
  const [activityCompletions, setActivityCompletions] = useAtom(rescueActivityCompletionsAtom);
  const notifiedRescueRoomsRef = useRef<Set<string>>(new Set());
  const [inviteSquadOpen, setInviteSquadOpen] = useState(false);
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([]);
  const [activeRoomId, setActiveRoomId] = useState(requestedRoomId);
  const matchedRoom = rooms.find((item) => item.roomId === activeRoomId);
  const fallbackRoom = useMemo<QuizRoomDraft>(() => {
    const now = Date.now();
    return {
      roomId: activeRoomId,
      hostUserId: 'maya',
      hostName: 'Maya',
      invitedName: 'Ben Lee',
      subject: 'Chemistry',
      topic: 'Covalent Bonding',
      questionSetId: 'bonding-rescue',
      status: 'active',
      currentQuestionIndex: 0,
      roundNumber: 1,
      totalRounds: rescueQuestions.length,
      questionStartedAt: now,
      createdAt: now,
    };
  }, [activeRoomId]);
  const room = useMemo<QuizRoomDraft>(() => {
    if (!matchedRoom) return fallbackRoom;
    if (matchedRoom.totalRounds === rescueQuestions.length) return matchedRoom;
    return { ...matchedRoom, totalRounds: rescueQuestions.length };
  }, [fallbackRoom, matchedRoom]);
  const roomParticipants = useMemo(
    () => participants.filter((participant: QuizRoomParticipantDraft) => participant.roomId === activeRoomId),
    [activeRoomId, participants]
  );
  const currentUserId = role === 'host' ? room.hostUserId : user?.userPrincipalName ?? user?.objectId ?? 'current-user';
  const [hasJoined, setHasJoined] = useState(role === 'host' || joinedParam || roomParticipants.some((participant: QuizRoomParticipantDraft) => participant.userId === currentUserId));
  const [answer, setAnswer] = useState<string | number>('');
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, questionSeconds - Math.floor((Date.now() - room.questionStartedAt) / 1000)));
  const [flashingParticipantId, setFlashingParticipantId] = useState<string | null>(null);
  const [advancedQuestionIds, setAdvancedQuestionIds] = useState<number[]>([]);
  const [syncTick, setSyncTick] = useState(0);
  const currentQuestion = rescueQuestions[room.currentQuestionIndex] ?? rescueQuestions[0];
  const currentParticipant = roomParticipants.find((participant: QuizRoomParticipantDraft) => participant.userId === currentUserId);
  const sortedParticipants = useMemo(() => {
    return [...roomParticipants].sort((a: QuizRoomParticipantDraft, b: QuizRoomParticipantDraft) => b.score - a.score || a.joinedAt - b.joinedAt);
  }, [roomParticipants]);
  const roomCoordinatorId = useMemo(() => {
    return [...roomParticipants].sort((a: QuizRoomParticipantDraft, b: QuizRoomParticipantDraft) => a.userId.localeCompare(b.userId))[0]?.userId;
  }, [roomParticipants]);
  const remainingSquadMembers = useMemo(() => {
    const joinedUserIds = new Set(roomParticipants.map((participant: QuizRoomParticipantDraft) => participant.userId));
    const joinedNames = new Set(roomParticipants.map((participant: QuizRoomParticipantDraft) => normalizeTopic(participant.displayName)));
    const invitedMemberIds = new Set(
      rescueLogs
        .filter((log: RescueNudgeLog) => log.roomId === activeRoomId && log.rescueStatus === 'pending')
        .map((log: RescueNudgeLog) => log.memberId)
    );
    const currentUserName = normalizeTopic(user?.fullName ?? room.hostName);

    return squadMembers.filter((member: SquadMember) => (
      member.id !== currentUserId
      && normalizeTopic(member.name) !== currentUserName
      && normalizeTopic(member.fullName) !== currentUserName
      && !joinedUserIds.has(member.id)
      && !joinedNames.has(normalizeTopic(member.name))
      && !joinedNames.has(normalizeTopic(member.fullName))
      && !invitedMemberIds.has(member.id)
    ));
  }, [activeRoomId, currentUserId, rescueLogs, room.hostName, roomParticipants, user?.fullName]);
  const canAdvanceQuestion = currentUserId === roomCoordinatorId;
  const hasAnsweredCurrent = answeredQuestionIds.includes(currentQuestion.id);

  const progressValue = (timeLeft / questionSeconds) * 100;
  const finishRoom = useCallback(() => {
    const completedAt = Date.now();
    const participantIds = Array.from(new Set(
      roomParticipants.map((participant: QuizRoomParticipantDraft) => participant.participantId)
    ));
    const completionAlreadyRecorded = activityCompletions.some(
      (completion: RescueActivityCompletion) => completion.roomId === room.roomId
    );

    setRooms((currentRooms) => currentRooms.map((item) => (
      item.roomId === room.roomId && item.status !== 'finished'
        ? { ...item, status: 'finished' }
        : item
    )));
    setRescueLogs((currentLogs: RescueNudgeLog[]) => currentLogs.map((log: RescueNudgeLog) => (
      log.roomId === room.roomId && log.rescueStatus !== 'completed'
        ? { ...log, pendingRescue: false, rescueStatus: 'completed', resolvedAt: completedAt }
        : log
    )));
    setActivityCompletions((currentCompletions: RescueActivityCompletion[]) => (
      currentCompletions.some((completion: RescueActivityCompletion) => completion.roomId === room.roomId)
        ? currentCompletions
        : [{ roomId: room.roomId, participantIds, completedAt, countedForStreak: true }, ...currentCompletions]
    ));
    if (!completionAlreadyRecorded) {
      toast.success('+1 squad streak', {
        description: 'Rescue room counted as today\'s qualifying activity.',
      });
      if (!notifiedRescueRoomsRef.current.has(room.roomId)) {
        notifiedRescueRoomsRef.current.add(room.roomId);
        notify({ type: 'rescueCompleted' });
      }
    }
  }, [activityCompletions, notify, room.roomId, roomParticipants, setActivityCompletions, setRescueLogs, setRooms]);

  const advanceQuestionFromTimer = useCallback(() => {
    setParticipants((currentParticipants: QuizRoomParticipantDraft[]) => currentParticipants.map((participant: QuizRoomParticipantDraft) => participant.roomId === room.roomId ? { ...participant, lastAnswerCorrect: false } : participant));
    if (room.currentQuestionIndex >= rescueQuestions.length - 1) {
      finishRoom();
      return;
    }
    setRooms((currentRooms) => currentRooms.map((item) => item.roomId === room.roomId ? { ...item, currentQuestionIndex: item.currentQuestionIndex + 1, roundNumber: item.currentQuestionIndex + 2, questionStartedAt: Date.now() } : item));
  }, [finishRoom, room.currentQuestionIndex, room.roomId, setParticipants, setRooms]);

  useEffect(() => {
    setActiveRoomId(requestedRoomId);
  }, [requestedRoomId]);

  useEffect(() => {
    setRooms((currentRooms: QuizRoomDraft[]) => {
      const existingRoom = currentRooms.find((item: QuizRoomDraft) => item.roomId === activeRoomId);
      if (!existingRoom) return [fallbackRoom, ...currentRooms];
      if (existingRoom.totalRounds === rescueQuestions.length) return currentRooms;
      return currentRooms.map((item: QuizRoomDraft) => (
        item.roomId === activeRoomId ? { ...item, totalRounds: rescueQuestions.length } : item
      ));
    });
  }, [activeRoomId, fallbackRoom, setRooms]);



  useEffect(() => {
    if (role === 'host' || joinedParam || roomParticipants.some((participant: QuizRoomParticipantDraft) => participant.userId === currentUserId)) {
      setHasJoined(true);
    }
  }, [currentUserId, joinedParam, role, roomParticipants]);

  useEffect(() => {
    if (room.status !== 'active' || !hasJoined) return;
    const pollingTimer = window.setInterval(() => {
      setSyncTick((current: number) => current + 1);
      setParticipants((currentParticipants: QuizRoomParticipantDraft[]) => currentParticipants.map((participant: QuizRoomParticipantDraft) => ({ ...participant })));
      setRooms((currentRooms) => currentRooms.map((item) => ({ ...item })));
    }, 2500);
    return () => window.clearInterval(pollingTimer);
  }, [hasJoined, room.status, setParticipants, setRooms]);

  useEffect(() => {
    setTimeLeft(Math.max(0, questionSeconds - Math.floor((Date.now() - room.questionStartedAt) / 1000)));
    setAnswer('');
    setSelectedOption(null);
    setAnswerState('idle');
  }, [room.currentQuestionIndex, room.questionStartedAt]);

  useEffect(() => {
    if (room.status !== 'active' || !hasJoined) return;
    const countdownTimer = window.setInterval(() => {
      setTimeLeft(Math.max(0, questionSeconds - Math.floor((Date.now() - room.questionStartedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(countdownTimer);
  }, [hasJoined, room.questionStartedAt, room.status, room.currentQuestionIndex, syncTick]);

  useEffect(() => {
    if (timeLeft > 0 || room.status !== 'active' || !hasJoined || !canAdvanceQuestion || advancedQuestionIds.includes(currentQuestion.id)) return;
    setAdvancedQuestionIds((currentIds: number[]) => [...currentIds, currentQuestion.id]);
    window.setTimeout(() => advanceQuestionFromTimer(), 250);
  }, [advancedQuestionIds, advanceQuestionFromTimer, canAdvanceQuestion, currentQuestion.id, hasJoined, room.status, timeLeft]);



  const submitAnswer = (submittedAnswer: string | number) => {
    if (hasAnsweredCurrent || room.status !== 'active') return;
    const correct = isAnswerCorrect(currentQuestion, submittedAnswer);
    const participantId = currentParticipant?.participantId ?? `${currentUserId}-${room.roomId}`;
    setParticipants((currentParticipants: QuizRoomParticipantDraft[]) => currentParticipants.map((participant: QuizRoomParticipantDraft) => {
      if (participant.roomId !== room.roomId || participant.userId !== currentUserId) return participant;
      return { ...participant, score: participant.score + (correct ? 10 : 0), lastAnswerCorrect: correct };
    }));
    setAnsweredQuestionIds((currentIds: number[]) => [...currentIds, currentQuestion.id]);
    setAnswerState(correct ? 'correct' : 'incorrect');
    if (correct) {
      setFlashingParticipantId(participantId);
      window.setTimeout(() => setFlashingParticipantId(null), 2500);
      toast.success('+10 points');
    } else {
      toast.error('Not quite');
    }
  };

  const toggleInviteSelection = (memberId: string, checked: boolean) => {
    setSelectedInviteIds((currentIds: string[]) => {
      if (checked) return currentIds.includes(memberId) ? currentIds : [...currentIds, memberId];
      return currentIds.filter((currentId: string) => currentId !== memberId);
    });
  };

  const sendSquadInvites = () => {
    const selectedMembers = remainingSquadMembers.filter((member: SquadMember) => selectedInviteIds.includes(member.id));
    if (selectedMembers.length === 0) {
      toast.info('Choose at least one squad member');
      return;
    }

    const now = Date.now();
    const inviteLogs: RescueNudgeLog[] = selectedMembers.map((member: SquadMember) => ({
      id: `${member.id}-${room.roomId}-squad-${now}`,
      memberId: member.id,
      memberName: member.name,
      senderName: currentParticipant?.displayName ?? room.hostName,
      subject: room.subject,
      topic: room.topic,
      message: `Join ${room.hostName}'s live Rescue room`,
      pendingRescue: true,
      rescueStatus: 'pending',
      roomId: room.roomId,
      createdAt: now,
    }));
    setRescueLogs((currentLogs: RescueNudgeLog[]) => [...inviteLogs, ...currentLogs]);
    toast.success(`Invite sent to ${selectedMembers.length} squad member${selectedMembers.length === 1 ? '' : 's'}`, {
      description: `Join link: /rescue-join?roomId=${room.roomId}`,
    });
    setSelectedInviteIds([]);
    setInviteSquadOpen(false);
  };

  const restartRoom = () => {
    setRooms((currentRooms) => currentRooms.map((item) => item.roomId === room.roomId ? { ...item, status: 'active', currentQuestionIndex: 0, roundNumber: 1, questionStartedAt: Date.now() } : item));
    setParticipants((currentParticipants: QuizRoomParticipantDraft[]) => currentParticipants.map((participant: QuizRoomParticipantDraft) => participant.roomId === room.roomId ? { ...participant, score: 0, lastAnswerCorrect: false } : participant));
    setAnsweredQuestionIds([]);
    setAdvancedQuestionIds([]);
    setAnswer('');
    setSelectedOption(null);
    setAnswerState('idle');
    setTimeLeft(questionSeconds);
  };

  if (hasJoined && room.status === 'finished') {
    return (
      <div className="edunets-gradient p-4 text-foreground sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-5">
          <Card className="card-shadow rounded-[20px] border-border bg-card text-card-foreground">
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="text-center">
                <Badge className="mb-4 rounded-full border-0 bg-primary text-primary-foreground"><Trophy className="mr-2 h-4 w-4" /> Rescue complete</Badge>
                <h1 className="text-3xl font-black">Final ranks</h1>
                <p className="mt-2 text-muted-foreground">+1 squad streak kept alive for every participant. Bee says: strong save.</p>
              </div>
              <div className="space-y-3">
                {sortedParticipants.map((participant: QuizRoomParticipantDraft, index: number) => (
                  <div key={participant.participantId} className="flex items-center gap-3 rounded-[18px] border border-border bg-background p-4 text-foreground">
                    <div className="w-8 text-center text-xl font-black">#{index + 1}</div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-[16px] border border-border font-bold ${avatarClass(participant.avatarColor)}`}>{initialsFor(participant.displayName)}</div>
                    <div className="min-w-0 flex-1"><p className="font-bold">{participant.displayName}</p><p className="text-sm text-muted-foreground">Qualified activity completed</p></div>
                    <p className="text-2xl font-black">{participant.score}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={() => navigate('/study-squad')} className="rounded-full bg-primary text-primary-foreground hover:bg-accent"><Flame className="mr-2 h-4 w-4" /> Back to squad</Button>
                <Button onClick={restartRoom} variant="outline" className="rounded-full"><RotateCcw className="mr-2 h-4 w-4" /> Reset room</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (hasJoined && room.status === 'active') {
    return (
      <div className="edunets-gradient p-4 text-foreground sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <header className="grid items-center gap-3 rounded-[20px] bg-card p-4 text-card-foreground shadow-lg md:grid-cols-[1fr_auto_1fr]">
            <div className="flex items-center gap-3 font-black text-primary"><span>Round {room.roundNumber} of {room.totalRounds}</span></div>
            <div className="flex items-center justify-center gap-3 rounded-full bg-secondary px-5 py-3 text-secondary-foreground">
              <Timer className="h-5 w-5" />
              <span className="font-mono text-xl font-black">{formatSeconds(timeLeft)}</span>
            </div>
            <p className="md:col-span-3 text-center text-sm font-bold text-muted-foreground">Near-real-time sync refreshes room and participant state every 2.5 seconds while this screen is active.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => setInviteSquadOpen(true)}><Users className="mr-2 h-4 w-4" /> Invite Squad</Button>
              <Button variant="outline" size="icon" className="rounded-full" aria-label="Room settings"><Settings className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" className="rounded-full" onClick={() => navigate('/study-squad')} aria-label="Exit room"><LogOut className="h-4 w-4" /></Button>
            </div>
            <div className="md:col-span-3"><Progress value={progressValue} className="h-2" /></div>
          </header>

          <div className="grid gap-5 xl:grid-cols-[20%_1fr_30%]">
            <Card className="card-shadow rounded-[20px] border-border bg-card text-card-foreground">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-black"><Trophy className="h-5 w-5" /> Rank</h2><Badge className="rounded-full border-0 bg-secondary text-secondary-foreground">Room only</Badge></div>
                <div className="space-y-3">
                  {sortedParticipants.map((participant: QuizRoomParticipantDraft, index: number) => {
                    const isFlashing = flashingParticipantId === participant.participantId || participant.lastAnswerCorrect;
                    return (
                      <motion.div
                        key={participant.participantId}
                        animate={isFlashing ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                        transition={{ duration: 0.45, ease: 'easeOut' as const }}
                        className={`flex items-center gap-3 rounded-[16px] border p-3 transition-colors ${isFlashing ? successFlashClass : 'border-border bg-card text-card-foreground'}`}
                      >
                        <div className="w-6 text-center font-black">{index + 1}</div>
                        <div className={`flex h-11 w-11 items-center justify-center rounded-[14px] border border-border font-bold ${avatarClass(participant.avatarColor)}`}>{initialsFor(participant.displayName)}</div>
                        <div className="min-w-0 flex-1"><p className="truncate font-bold">{participant.displayName}</p><p className="text-sm font-bold">{participant.score} pts</p></div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow rounded-[20px] border-border bg-card text-card-foreground">
              <CardContent className="flex min-h-[440px] flex-col justify-center space-y-6 p-6 sm:p-8">
                <Badge className="w-fit rounded-full border-0 bg-accent text-accent-foreground">{room.subject} · {room.topic}</Badge>
                <h1 className="text-3xl font-black leading-tight text-foreground md:text-5xl">{currentQuestion.text}</h1>
                <p className="max-w-2xl text-lg text-muted-foreground">Answer in the panel on the right. Everyone advances together when the timer reaches zero.</p>
              </CardContent>
            </Card>

            <Card className="card-shadow rounded-[20px] border-border bg-card text-card-foreground">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div>
                  <Badge className="mb-3 rounded-full border-0 bg-primary text-primary-foreground">Answer panel</Badge>
                  <h2 className="text-2xl font-black">Lock your answer</h2>
                </div>

                {currentQuestion.type === 'mcq' && currentQuestion.options && (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    {currentQuestion.options.map((option: string, index: number) => {
                      const selected = selectedOption === index;
                      return (
                        <Button
                          key={option}
                          disabled={hasAnsweredCurrent}
                          variant="outline"
                          onClick={() => { setSelectedOption(index); submitAnswer(index); }}
                          className={`h-auto min-h-20 justify-start rounded-[18px] border-2 p-4 text-left text-base font-bold ${selected ? 'border-accent bg-accent text-accent-foreground' : 'border-primary bg-card text-card-foreground'}`}
                        >
                          <span className="mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-black text-secondary-foreground">{String.fromCharCode(65 + index)}</span>{option}
                        </Button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === 'fill-blank' && (
                  <div className="space-y-3"><Input value={typeof answer === 'string' ? answer : ''} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setAnswer(event.target.value)} disabled={hasAnsweredCurrent} placeholder="Type the missing word" className="h-12 rounded-[16px]" /><Button disabled={hasAnsweredCurrent} onClick={() => submitAnswer(answer)} className="w-full rounded-full bg-primary text-primary-foreground hover:bg-accent">Submit</Button></div>
                )}

                {currentQuestion.type === 'structured' && (
                  <div className="space-y-3"><Textarea value={typeof answer === 'string' ? answer : ''} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setAnswer(event.target.value)} disabled={hasAnsweredCurrent} placeholder="Type your explanation" className="min-h-32 rounded-[16px]" /><Button disabled={hasAnsweredCurrent} onClick={() => submitAnswer(answer)} className="w-full rounded-full bg-primary text-primary-foreground hover:bg-accent">Submit</Button></div>
                )}

                <AnimatePresence>
                  {hasAnsweredCurrent && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-[16px] p-4 ${answerState === 'correct' ? 'bg-primary text-primary-foreground' : 'bg-destructive text-primary-foreground'}`}>
                      <p className="flex items-center gap-2 font-black">{answerState === 'correct' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}{answerState === 'correct' ? 'Correct — answer locked' : 'Incorrect — answer locked'}</p>
                      <p className="mt-1 text-sm font-semibold">{currentQuestion.explanation}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>

          <Dialog
            open={inviteSquadOpen}
            onOpenChange={(open: boolean) => {
              setInviteSquadOpen(open);
              if (!open) setSelectedInviteIds([]);
            }}
          >
            <DialogContent className="max-w-[430px] border-border bg-card text-card-foreground">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Invite Squad</DialogTitle>
                <DialogDescription className="text-muted-foreground">Pick squad members who have not joined or already received an invite for this room.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {remainingSquadMembers.length === 0 ? (
                  <div className="rounded-[16px] bg-secondary p-4 text-secondary-foreground">Everyone in your squad is already invited or in the room.</div>
                ) : (
                  remainingSquadMembers.map((member: SquadMember) => (
                    <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-border bg-background p-3 text-foreground">
                      <Checkbox checked={selectedInviteIds.includes(member.id)} onCheckedChange={(checked: boolean | 'indeterminate') => toggleInviteSelection(member.id, checked === true)} />
                      <div className={`flex h-9 w-9 items-center justify-center rounded-[12px] border border-border text-sm font-bold ${avatarClass(avatarColorForSquadMember(member))}`}>{getInitials(member.fullName)}</div>
                      <div className="min-w-0 flex-1"><p className="truncate font-bold">{member.fullName}</p><p className="text-sm text-muted-foreground">Join link: /rescue-join?roomId={room.roomId}</p></div>
                    </label>
                  ))
                )}
              </div>
              <Button disabled={remainingSquadMembers.length === 0} onClick={sendSquadInvites} className="w-full rounded-full bg-primary text-primary-foreground hover:bg-accent"><Send className="mr-2 h-4 w-4" /> Send selected invites</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="edunets-gradient flex items-center justify-center p-4 text-foreground sm:p-6 lg:p-8">
      <Card className="card-shadow w-full max-w-[460px] rounded-[20px] border-border bg-card text-card-foreground">
        <CardContent className="space-y-5 p-6 text-center sm:p-8">
          <Badge className="mx-auto w-fit rounded-full border-0 bg-secondary text-secondary-foreground">Join first</Badge>
          <h1 className="text-2xl font-bold">Open the Rescue join screen</h1>
          <p className="text-muted-foreground">Choose your name and avatar before entering this shared live room.</p>
          <Button onClick={() => navigate(`/rescue-join?roomId=${encodeURIComponent(room.roomId)}`)} className="h-12 w-full rounded-full bg-primary text-primary-foreground hover:bg-accent">Go to Join Rescue →</Button>
        </CardContent>
      </Card>
    </div>
  );
}
