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

// Topic names below intentionally mirror the real, seeded O-Level catalog
// (Biology/Chemistry/Physics, see database/seed) so getStrugglingFriendsForTopic
// can match them against a signed-in student's authenticated concept web
// nodes. Keep these in sync with the catalog if topic names ever change there.
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
      { subject: 'Biology', score: 88, topics: ['Nutrition', 'Ecology'] },
      { subject: 'Chemistry', score: 85, topics: ['Stoichiometry', 'Organic Chemistry'] },
      { subject: 'Physics', score: 90, topics: ['Electricity'] },
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
      { subject: 'Biology', score: 62, topics: ['Cell Division (Mitosis)', 'Reproduction'] },
      { subject: 'Chemistry', score: 74, topics: ['Covalent Bonding', 'Atomic Structure'] },
      { subject: 'Physics', score: 78, topics: ['Dynamics', 'Waves'] },
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
      { subject: 'Biology', score: 84, topics: ['Genetics', 'Respiration'] },
      { subject: 'Chemistry', score: 69, topics: ['Acids & Bases', 'Redox Reactions'] },
      { subject: 'Physics', score: 72, topics: ['Electromagnetism', 'Nuclear Physics'] },
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
      { subject: 'Biology', score: 61, topics: ['Cell Division (Mitosis)', 'Transport'] },
      { subject: 'Chemistry', score: 54, topics: ['Covalent Bonding', 'Rate of Reaction'] },
      { subject: 'Physics', score: 76, topics: ['Waves', 'Electricity'] },
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
      { subject: 'Biology', score: 52, topics: ['Respiration', 'Genetics'] },
      { subject: 'Chemistry', score: 63, topics: ['Redox Reactions', 'Atomic Structure'] },
      { subject: 'Physics', score: 68, topics: ['Nuclear Physics', 'Speed & Acceleration'] },
    ],
  },
];

export const squadMemberTopicScores: SquadMemberTopicScore[] = [
  // Biology
  { memberId: 'maya', subject: 'Biology', topic: 'Nutrition', memoryScore: 34 },
  { memberId: 'maya', subject: 'Biology', topic: 'Ecology', memoryScore: 29 },
  { memberId: 'ben', subject: 'Biology', topic: 'Cell Division (Mitosis)', memoryScore: 31 },
  { memberId: 'ben', subject: 'Biology', topic: 'Reproduction', memoryScore: 35 },
  { memberId: 'aisha', subject: 'Biology', topic: 'Genetics', memoryScore: 37 },
  { memberId: 'aisha', subject: 'Biology', topic: 'Respiration', memoryScore: 33 },
  { memberId: 'leo', subject: 'Biology', topic: 'Cell Division (Mitosis)', memoryScore: 28 },
  { memberId: 'leo', subject: 'Biology', topic: 'Transport', memoryScore: 36 },
  { memberId: 'nora', subject: 'Biology', topic: 'Respiration', memoryScore: 30 },
  { memberId: 'nora', subject: 'Biology', topic: 'Genetics', memoryScore: 38 },
  // Chemistry
  { memberId: 'maya', subject: 'Chemistry', topic: 'Stoichiometry', memoryScore: 24 },
  { memberId: 'maya', subject: 'Chemistry', topic: 'Organic Chemistry', memoryScore: 31 },
  { memberId: 'ben', subject: 'Chemistry', topic: 'Covalent Bonding', memoryScore: 33 },
  { memberId: 'ben', subject: 'Chemistry', topic: 'Atomic Structure', memoryScore: 29 },
  { memberId: 'aisha', subject: 'Chemistry', topic: 'Acids & Bases', memoryScore: 37 },
  { memberId: 'aisha', subject: 'Chemistry', topic: 'Redox Reactions', memoryScore: 33 },
  { memberId: 'leo', subject: 'Chemistry', topic: 'Covalent Bonding', memoryScore: 26 },
  { memberId: 'leo', subject: 'Chemistry', topic: 'Rate of Reaction', memoryScore: 39 },
  { memberId: 'nora', subject: 'Chemistry', topic: 'Redox Reactions', memoryScore: 36 },
  { memberId: 'nora', subject: 'Chemistry', topic: 'Atomic Structure', memoryScore: 32 },
  // Physics
  { memberId: 'maya', subject: 'Physics', topic: 'Electricity', memoryScore: 31 },
  { memberId: 'ben', subject: 'Physics', topic: 'Dynamics', memoryScore: 34 },
  { memberId: 'ben', subject: 'Physics', topic: 'Waves', memoryScore: 38 },
  { memberId: 'aisha', subject: 'Physics', topic: 'Electromagnetism', memoryScore: 38 },
  { memberId: 'aisha', subject: 'Physics', topic: 'Nuclear Physics', memoryScore: 32 },
  { memberId: 'leo', subject: 'Physics', topic: 'Waves', memoryScore: 32 },
  { memberId: 'leo', subject: 'Physics', topic: 'Electricity', memoryScore: 35 },
  { memberId: 'nora', subject: 'Physics', topic: 'Nuclear Physics', memoryScore: 29 },
  { memberId: 'nora', subject: 'Physics', topic: 'Speed & Acceleration', memoryScore: 34 },
];

export const weakTopics: WeakTopic[] = [
  { id: 'cell-division-mitosis', topic: 'Cell Division (Mitosis)', subject: 'Biology', memberId: 'ben', score: 31 },
  { id: 'genetics', topic: 'Genetics', subject: 'Biology', memberId: 'aisha', score: 37 },
  { id: 'covalent-bonding', topic: 'Covalent Bonding', subject: 'Chemistry', memberId: 'leo', score: 26 },
  { id: 'dynamics', topic: 'Dynamics', subject: 'Physics', memberId: 'ben', score: 34 },
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

/**
 * A member's single weakest tracked topic across every subject - used by the
 * concept web's "Find your friend" search to jump straight to wherever that
 * friend needs the most help, regardless of which subject map is currently
 * open (switching subject first if needed).
 */
export function getWeakestTopicForMember(memberId: string): SquadMemberTopicScore | null {
  const rows = squadMemberTopicScores.filter((row) => row.memberId === memberId);
  if (rows.length === 0) return null;
  return rows.reduce((weakest, row) => (row.memoryScore < weakest.memoryScore ? row : weakest));
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
