export type SquadColor = 'yellow' | 'blue' | 'white';

export interface SubjectScore {
  subject: string;
  score: number;
  topics?: string[];
}

export interface SquadMember {
  id: string;
  name: string;
  fullName: string;
  initials: string;
  score: number;
  overallMemoryScore: number;
  streak: number;
  color: SquadColor;
  subjects: SubjectScore[];
}

export interface SquadMemberTopicScore {
  memberId: string;
  subject: string;
  topic: string;
  memoryScore: number;
}

export interface WeakTopic {
  id: string;
  topic: string;
  subject: string;
  memberId: string;
  score: number;
}

export interface StrugglingFriend {
  memberId: string;
  name: string;
  initials: string;
  score: number;
}

export const squadMembers: SquadMember[] = [
  {
    id: 'maya',
    name: 'Maya',
    fullName: 'Maya Tan',
    initials: 'MT',
    score: 92,
    overallMemoryScore: 92,
    streak: 18,
    color: 'yellow',
    subjects: [
      { subject: 'Biology', score: 94, topics: ['Cell Biology', 'Denaturation'] },
      { subject: 'Chemistry', score: 86, topics: ['Chemical Bonding', 'Molten Electrolysis'] },
      { subject: 'History', score: 82 },
    ],
  },
  {
    id: 'ben',
    name: 'Ben',
    fullName: 'Ben Lee',
    initials: 'BL',
    score: 86,
    overallMemoryScore: 86,
    streak: 14,
    color: 'blue',
    subjects: [
      { subject: 'Biology', score: 62, topics: ['Cell Biology', 'Denaturation'] },
      { subject: 'Chemistry', score: 74, topics: ['Chemical Bonding', 'Ionic Bonding', 'Molten Electrolysis'] },
      { subject: 'Physics', score: 88, topics: ['Terminal Velocity'] },
    ],
  },
  {
    id: 'aisha',
    name: 'Aisha',
    fullName: 'Aisha Rahman',
    initials: 'AR',
    score: 81,
    overallMemoryScore: 81,
    streak: 11,
    color: 'white',
    subjects: [
      { subject: 'Biology', score: 84, topics: ['Cell Biology', 'Denaturation'] },
      { subject: 'Chemistry', score: 69, topics: ['Ionic Bonding', 'Aqueous Electrolysis'] },
      { subject: 'Physics', score: 72, topics: ['Refraction'] },
    ],
  },
  {
    id: 'leo',
    name: 'Leo',
    fullName: 'Leo Chen',
    initials: 'LC',
    score: 74,
    overallMemoryScore: 74,
    streak: 8,
    color: 'blue',
    subjects: [
      { subject: 'Biology', score: 61, topics: ['Mitosis', 'Stomata'] },
      { subject: 'Chemistry', score: 54, topics: ['Chemical Bonding', 'Covalent Bonding', 'Molten Electrolysis'] },
      { subject: 'Physics', score: 76, topics: ['Refraction'] },
    ],
  },
  {
    id: 'nora',
    name: 'Nora',
    fullName: 'Nora Lee',
    initials: 'NL',
    score: 69,
    overallMemoryScore: 69,
    streak: 6,
    color: 'yellow',
    subjects: [
      { subject: 'Biology', score: 52, topics: ['Mitosis', 'Stomata'] },
      { subject: 'Chemistry', score: 63, topics: ['Chemical Bonding', 'Covalent Bonding', 'Aqueous Electrolysis'] },
      { subject: 'Physics', score: 68, topics: ['Terminal Velocity'] },
    ],
  },
];

export const squadMemberTopicScores: SquadMemberTopicScore[] = [
  { memberId: 'maya', subject: 'Biology', topic: 'Cell Biology', memoryScore: 34 },
  { memberId: 'ben', subject: 'Biology', topic: 'Cell Biology', memoryScore: 31 },
  { memberId: 'aisha', subject: 'Biology', topic: 'Cell Biology', memoryScore: 43 },
  { memberId: 'leo', subject: 'Biology', topic: 'Mitosis', memoryScore: 28 },
  { memberId: 'nora', subject: 'Biology', topic: 'Mitosis', memoryScore: 36 },
  { memberId: 'maya', subject: 'Biology', topic: 'Denaturation', memoryScore: 29 },
  { memberId: 'ben', subject: 'Biology', topic: 'Denaturation', memoryScore: 35 },
  { memberId: 'aisha', subject: 'Biology', topic: 'Denaturation', memoryScore: 37 },
  { memberId: 'leo', subject: 'Biology', topic: 'Stomata', memoryScore: 32 },
  { memberId: 'nora', subject: 'Biology', topic: 'Stomata', memoryScore: 30 },
  { memberId: 'maya', subject: 'Chemistry', topic: 'Chemical Bonding', memoryScore: 24 },
  { memberId: 'ben', subject: 'Chemistry', topic: 'Chemical Bonding', memoryScore: 33 },
  { memberId: 'leo', subject: 'Chemistry', topic: 'Chemical Bonding', memoryScore: 42 },
  { memberId: 'nora', subject: 'Chemistry', topic: 'Chemical Bonding', memoryScore: 38 },
  { memberId: 'ben', subject: 'Chemistry', topic: 'Ionic Bonding', memoryScore: 31 },
  { memberId: 'aisha', subject: 'Chemistry', topic: 'Ionic Bonding', memoryScore: 37 },
  { memberId: 'leo', subject: 'Chemistry', topic: 'Covalent Bonding', memoryScore: 26 },
  { memberId: 'nora', subject: 'Chemistry', topic: 'Covalent Bonding', memoryScore: 32 },
  { memberId: 'aisha', subject: 'Chemistry', topic: 'Covalent Bonding', memoryScore: 59 },
  { memberId: 'ben', subject: 'Chemistry', topic: 'Molten Electrolysis', memoryScore: 29 },
  { memberId: 'maya', subject: 'Chemistry', topic: 'Molten Electrolysis', memoryScore: 31 },
  { memberId: 'leo', subject: 'Chemistry', topic: 'Molten Electrolysis', memoryScore: 39 },
  { memberId: 'nora', subject: 'Chemistry', topic: 'Aqueous Electrolysis', memoryScore: 36 },
  { memberId: 'aisha', subject: 'Chemistry', topic: 'Aqueous Electrolysis', memoryScore: 33 },
  { memberId: 'nora', subject: 'Physics', topic: 'Terminal Velocity', memoryScore: 29 },
  { memberId: 'ben', subject: 'Physics', topic: 'Terminal Velocity', memoryScore: 34 },
  { memberId: 'aisha', subject: 'Physics', topic: 'Refraction', memoryScore: 38 },
  { memberId: 'leo', subject: 'Physics', topic: 'Refraction', memoryScore: 32 },
];

export const weakTopics: WeakTopic[] = [
  { id: 'cell-biology', topic: 'Cell Biology', subject: 'Biology', memberId: 'ben', score: 31 },
  { id: 'denaturation', topic: 'Denaturation', subject: 'Biology', memberId: 'aisha', score: 37 },
  { id: 'covalent-bonding', topic: 'Covalent Bonding', subject: 'Chemistry', memberId: 'leo', score: 26 },
  { id: 'terminal-velocity', topic: 'Terminal Velocity', subject: 'Physics', memberId: 'nora', score: 29 },
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

export function getStrugglingFriendsForTopic(subject: string, topic: string): StrugglingFriend[] {
  const normalizedTopic = normalizeTopic(topic);

  return squadMemberTopicScores
    .filter((score) => (
      score.subject === subject
      && normalizeTopic(score.topic) === normalizedTopic
      && score.memoryScore < 40
    ))
    .map((score) => {
      const member = squadMembers.find((candidate) => candidate.id === score.memberId);
      return member
        ? {
            memberId: member.id,
            name: member.fullName,
            initials: member.initials,
            score: score.memoryScore,
          }
        : null;
    })
    .filter((friend): friend is StrugglingFriend => friend !== null)
    .sort((first, second) => first.score - second.score);
}

export function getAvatarClass(color: SquadColor): string {
  if (color === 'yellow') return 'bg-secondary text-secondary-foreground';
  if (color === 'blue') return 'bg-accent text-accent-foreground';
  return 'bg-card text-card-foreground';
}
