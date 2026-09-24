// Shapes and presentation helpers for squad UI. The squad roster, per-topic
// scores and streaks all come from the authenticated /me/study-squad payload
// (see lib/api/study-squads.ts) -- this module deliberately holds no sample
// members, so nothing can render an invented friend or score.
export type SquadColor = 'yellow' | 'blue' | 'white';

export interface SubjectScore { subject: string; score: number; topics?: string[] }
export interface SquadMember {
  id: string; name: string; fullName: string; initials: string; score: number;
  overallMemoryScore: number; streak: number; color: SquadColor; subjects: SubjectScore[];
  /** Average quality of this member's whiteboard work, null before their first submission. */
  scribbleScore: number | null;
  scribbleCount: number;
}
export interface WeakTopic { id: string; topicId: string; topic: string; subject: string; memberId: string; score: number }
export interface StrugglingFriend { memberId: string; name: string; initials: string; score: number }

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0] ?? '').slice(0, 2).toUpperCase() || '??';
}

export function normalizeTopic(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Consistency deliberately measures showing up, not being right: a streak you
// kept and work you actually submitted. Correctness lives on the studying
// board, which stays a pure Memory Score so grinding cannot buy a rank there.
export const CONSISTENCY_STREAK_TARGET = 30;
export const CONSISTENCY_WORK_TARGET = 10;

export function getConsistencyScore(member: Pick<SquadMember, 'streak' | 'scribbleCount'>): number {
  const streakPoints = Math.min(member.streak / CONSISTENCY_STREAK_TARGET, 1) * 60;
  const workPoints = Math.min(member.scribbleCount / CONSISTENCY_WORK_TARGET, 1) * 40;
  return Math.round(streakPoints + workPoints);
}

export function getAvatarClass(color: SquadColor): string {
  if (color === 'yellow') return 'bg-secondary text-secondary-foreground';
  if (color === 'blue') return 'bg-accent text-accent-foreground';
  return 'bg-card text-card-foreground';
}
