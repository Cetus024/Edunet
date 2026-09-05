export type SquadColor = 'yellow' | 'blue' | 'white';

export interface SubjectScore { subject: string; score: number; topics?: string[] }
export interface SquadMember {
  id: string; name: string; fullName: string; initials: string; score: number;
  overallMemoryScore: number; streak: number; color: SquadColor; subjects: SubjectScore[];
}
export interface SquadMemberTopicScore { memberId: string; subject: string; topic: string; memoryScore: number }
export interface WeakTopic { id: string; topicId: string; topic: string; subject: string; memberId: string; score: number }
export interface StrugglingFriend { memberId: string; name: string; initials: string; score: number }

export const squadMembers: SquadMember[] = [
  { id: 'maya', name: 'Maya', fullName: 'Maya Tan', initials: 'MT', score: 89, overallMemoryScore: 89, streak: 18, color: 'yellow', subjects: [
    { subject: 'Mathematics', score: 91, topics: ['NUMBER AND ALGEBRA', 'STATISTICS AND PROBABILITY'] },
    { subject: 'Chemistry', score: 87, topics: ['Chemical Calculations', 'Organic Chemistry'] },
  ] },
  { id: 'ben', name: 'Ben', fullName: 'Ben Lee', initials: 'BL', score: 74, overallMemoryScore: 74, streak: 14, color: 'blue', subjects: [
    { subject: 'Mathematics', score: 71, topics: ['NUMBER AND ALGEBRA', 'GEOMETRY AND MEASUREMENT'] },
    { subject: 'Chemistry', score: 77, topics: ['Chemical Bonding and Structure', 'The Particulate Nature of Matter'] },
  ] },
  { id: 'aisha', name: 'Aisha', fullName: 'Aisha Rahman', initials: 'AR', score: 76, overallMemoryScore: 76, streak: 11, color: 'white', subjects: [
    { subject: 'Mathematics', score: 79, topics: ['STATISTICS AND PROBABILITY', 'GEOMETRY AND MEASUREMENT'] },
    { subject: 'Chemistry', score: 73, topics: ['Acid-Base Chemistry', 'Redox Chemistry'] },
  ] },
  { id: 'leo', name: 'Leo', fullName: 'Leo Chen', initials: 'LC', score: 58, overallMemoryScore: 58, streak: 8, color: 'blue', subjects: [
    { subject: 'Mathematics', score: 61, topics: ['GEOMETRY AND MEASUREMENT', 'NUMBER AND ALGEBRA'] },
    { subject: 'Chemistry', score: 55, topics: ['Chemical Bonding and Structure', 'Rate of Reactions'] },
  ] },
  { id: 'nora', name: 'Nora', fullName: 'Nora Lee', initials: 'NL', score: 55, overallMemoryScore: 55, streak: 6, color: 'yellow', subjects: [
    { subject: 'Mathematics', score: 54, topics: ['STATISTICS AND PROBABILITY', 'NUMBER AND ALGEBRA'] },
    { subject: 'Chemistry', score: 56, topics: ['Redox Chemistry', 'The Particulate Nature of Matter'] },
  ] },
];

export const squadMemberTopicScores: SquadMemberTopicScore[] = [
  { memberId: 'maya', subject: 'Mathematics', topic: 'NUMBER AND ALGEBRA', memoryScore: 94 },
  { memberId: 'maya', subject: 'Mathematics', topic: 'STATISTICS AND PROBABILITY', memoryScore: 88 },
  { memberId: 'maya', subject: 'Chemistry', topic: 'Chemical Calculations', memoryScore: 92 },
  { memberId: 'maya', subject: 'Chemistry', topic: 'Organic Chemistry', memoryScore: 82 },
  { memberId: 'ben', subject: 'Mathematics', topic: 'NUMBER AND ALGEBRA', memoryScore: 82 },
  { memberId: 'ben', subject: 'Mathematics', topic: 'GEOMETRY AND MEASUREMENT', memoryScore: 60 },
  { memberId: 'ben', subject: 'Chemistry', topic: 'Chemical Bonding and Structure', memoryScore: 86 },
  { memberId: 'ben', subject: 'Chemistry', topic: 'The Particulate Nature of Matter', memoryScore: 68 },
  { memberId: 'aisha', subject: 'Mathematics', topic: 'STATISTICS AND PROBABILITY', memoryScore: 88 },
  { memberId: 'aisha', subject: 'Mathematics', topic: 'GEOMETRY AND MEASUREMENT', memoryScore: 70 },
  { memberId: 'aisha', subject: 'Chemistry', topic: 'Acid-Base Chemistry', memoryScore: 82 },
  { memberId: 'aisha', subject: 'Chemistry', topic: 'Redox Chemistry', memoryScore: 64 },
  { memberId: 'leo', subject: 'Mathematics', topic: 'GEOMETRY AND MEASUREMENT', memoryScore: 75 },
  { memberId: 'leo', subject: 'Mathematics', topic: 'NUMBER AND ALGEBRA', memoryScore: 47 },
  { memberId: 'leo', subject: 'Chemistry', topic: 'Chemical Bonding and Structure', memoryScore: 71 },
  { memberId: 'leo', subject: 'Chemistry', topic: 'Rate of Reactions', memoryScore: 39 },
  { memberId: 'nora', subject: 'Mathematics', topic: 'STATISTICS AND PROBABILITY', memoryScore: 70 },
  { memberId: 'nora', subject: 'Mathematics', topic: 'NUMBER AND ALGEBRA', memoryScore: 38 },
  { memberId: 'nora', subject: 'Chemistry', topic: 'Redox Chemistry', memoryScore: 69 },
  { memberId: 'nora', subject: 'Chemistry', topic: 'The Particulate Nature of Matter', memoryScore: 43 },
];

export const weakTopics: WeakTopic[] = [
  { id: 'rate-of-reactions', topicId: 'chemistry-rate-reactions', topic: 'Rate of Reactions', subject: 'Chemistry', memberId: 'leo', score: 39 },
  { id: 'number-and-algebra', topicId: 'math-number-algebra', topic: 'NUMBER AND ALGEBRA', subject: 'Mathematics', memberId: 'nora', score: 38 },
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0] ?? '').slice(0, 2).toUpperCase() || '??';
}

export function normalizeTopic(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getSquadMember(memberId: string): SquadMember {
  return squadMembers.find((member) => member.id === memberId) ?? squadMembers[0];
}

export function getWeakTopicsForMember(memberId: string): WeakTopic[] {
  return weakTopics.filter((topic) => topic.memberId === memberId);
}

export function getWeakestTopicForMember(memberId: string): SquadMemberTopicScore | null {
  const rows = squadMemberTopicScores.filter((row) => row.memberId === memberId);
  return rows.length === 0 ? null : rows.reduce((weakest, row) => (row.memoryScore < weakest.memoryScore ? row : weakest));
}

export function getStrugglingFriendsForTopic(subject: string, topic: string): StrugglingFriend[] {
  const normalizedTopic = normalizeTopic(topic);
  return squadMemberTopicScores
    .filter((score) => score.subject === subject && normalizeTopic(score.topic) === normalizedTopic && score.memoryScore < 40)
    .map((score) => {
      const member = squadMembers.find((candidate) => candidate.id === score.memberId);
      return member ? { memberId: member.id, name: member.fullName, initials: member.initials, score: score.memoryScore } : null;
    })
    .filter((friend): friend is StrugglingFriend => friend !== null)
    .sort((first, second) => first.score - second.score);
}

export function getAvatarClass(color: SquadColor): string {
  if (color === 'yellow') return 'bg-secondary text-secondary-foreground';
  if (color === 'blue') return 'bg-accent text-accent-foreground';
  return 'bg-card text-card-foreground';
}
