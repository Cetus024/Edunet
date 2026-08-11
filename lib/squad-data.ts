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
      { subject: 'English', score: 86, topics: ['Comprehension', 'Summary Writing'] },
      { subject: 'History', score: 89, topics: ['World War I', 'United Nations'] },
      { subject: 'Geography', score: 87, topics: ['Weather & Climate', 'Food Resources'] },
      { subject: 'A-Math', score: 85, topics: ['Quadratics', 'Integration'] },
      { subject: 'E-Math', score: 88, topics: ['Numbers', 'Probability'] },
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
      { subject: 'English', score: 71, topics: ['Situational Writing', 'Continuous Writing'] },
      { subject: 'History', score: 73, topics: ['World War II', 'Singapore History'] },
      { subject: 'Geography', score: 69, topics: ['Plate Tectonics', 'Coasts'] },
      { subject: 'A-Math', score: 70, topics: ['Polynomials', 'Coordinate Geometry'] },
      { subject: 'E-Math', score: 68, topics: ['Algebra', 'Mensuration'] },
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
      { subject: 'English', score: 78, topics: ['Editing', 'Visual Text'] },
      { subject: 'History', score: 75, topics: ['The Cold War', 'Decolonisation'] },
      { subject: 'Geography', score: 74, topics: ['Rivers', 'Tourism'] },
      { subject: 'A-Math', score: 76, topics: ['Trigonometry', 'Differentiation'] },
      { subject: 'E-Math', score: 73, topics: ['Statistics', 'Geometry'] },
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
      { subject: 'English', score: 63, topics: ['Comprehension', 'Continuous Writing'] },
      { subject: 'History', score: 58, topics: ['World War I', 'Singapore History'] },
      { subject: 'Geography', score: 66, topics: ['Coasts', 'Weather & Climate'] },
      { subject: 'A-Math', score: 60, topics: ['Quadratics', 'Coordinate Geometry'] },
      { subject: 'E-Math', score: 65, topics: ['Geometry', 'Algebra'] },
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
      { subject: 'English', score: 55, topics: ['Editing', 'Visual Text'] },
      { subject: 'History', score: 61, topics: ['The Cold War', 'United Nations'] },
      { subject: 'Geography', score: 57, topics: ['Plate Tectonics', 'Rivers'] },
      { subject: 'A-Math', score: 59, topics: ['Trigonometry', 'Polynomials'] },
      { subject: 'E-Math', score: 62, topics: ['Statistics', 'Numbers'] },
    ],
  },
];

// Per-topic scores are derived from each member's real leaderboard subject
// score (squadMembers[].subjects[].score) with a bounded spread per pair, so
// the average of a member's tracked topics in a subject lands back on their
// leaderboard percentage - e.g. Maya's 90% Physics score is now backed by a
// 90% Electricity score, not a contradicting ~30%. The spread narrows for
// high scorers (so nothing exceeds 99%) and widens for low scorers, which is
// what still produces genuine sub-40% "weak topic" dips for members whose
// subject score is already low (see weakTopics below) - not everyone,
// everywhere, like the old flat 24-39 range did regardless of leaderboard
// standing.
export const squadMemberTopicScores: SquadMemberTopicScore[] = [
  // Biology
  { memberId: 'maya', subject: 'Biology', topic: 'Nutrition', memoryScore: 97 },
  { memberId: 'maya', subject: 'Biology', topic: 'Ecology', memoryScore: 79 },
  { memberId: 'ben', subject: 'Biology', topic: 'Cell Division (Mitosis)', memoryScore: 77 },
  { memberId: 'ben', subject: 'Biology', topic: 'Reproduction', memoryScore: 47 },
  { memberId: 'aisha', subject: 'Biology', topic: 'Genetics', memoryScore: 97 },
  { memberId: 'aisha', subject: 'Biology', topic: 'Respiration', memoryScore: 71 },
  { memberId: 'leo', subject: 'Biology', topic: 'Cell Division (Mitosis)', memoryScore: 76 },
  { memberId: 'leo', subject: 'Biology', topic: 'Transport', memoryScore: 46 },
  { memberId: 'nora', subject: 'Biology', topic: 'Respiration', memoryScore: 67 },
  { memberId: 'nora', subject: 'Biology', topic: 'Genetics', memoryScore: 37 },
  // Chemistry
  { memberId: 'maya', subject: 'Chemistry', topic: 'Stoichiometry', memoryScore: 97 },
  { memberId: 'maya', subject: 'Chemistry', topic: 'Organic Chemistry', memoryScore: 73 },
  { memberId: 'ben', subject: 'Chemistry', topic: 'Covalent Bonding', memoryScore: 89 },
  { memberId: 'ben', subject: 'Chemistry', topic: 'Atomic Structure', memoryScore: 59 },
  { memberId: 'aisha', subject: 'Chemistry', topic: 'Acids & Bases', memoryScore: 84 },
  { memberId: 'aisha', subject: 'Chemistry', topic: 'Redox Reactions', memoryScore: 54 },
  { memberId: 'leo', subject: 'Chemistry', topic: 'Covalent Bonding', memoryScore: 69 },
  { memberId: 'leo', subject: 'Chemistry', topic: 'Rate of Reaction', memoryScore: 39 },
  { memberId: 'nora', subject: 'Chemistry', topic: 'Redox Reactions', memoryScore: 78 },
  { memberId: 'nora', subject: 'Chemistry', topic: 'Atomic Structure', memoryScore: 48 },
  // Physics
  { memberId: 'maya', subject: 'Physics', topic: 'Electricity', memoryScore: 90 },
  { memberId: 'ben', subject: 'Physics', topic: 'Dynamics', memoryScore: 93 },
  { memberId: 'ben', subject: 'Physics', topic: 'Waves', memoryScore: 63 },
  { memberId: 'aisha', subject: 'Physics', topic: 'Electromagnetism', memoryScore: 87 },
  { memberId: 'aisha', subject: 'Physics', topic: 'Nuclear Physics', memoryScore: 57 },
  { memberId: 'leo', subject: 'Physics', topic: 'Waves', memoryScore: 91 },
  { memberId: 'leo', subject: 'Physics', topic: 'Electricity', memoryScore: 61 },
  { memberId: 'nora', subject: 'Physics', topic: 'Nuclear Physics', memoryScore: 83 },
  { memberId: 'nora', subject: 'Physics', topic: 'Speed & Acceleration', memoryScore: 53 },
  // English
  { memberId: 'maya', subject: 'English', topic: 'Comprehension', memoryScore: 97 },
  { memberId: 'maya', subject: 'English', topic: 'Summary Writing', memoryScore: 75 },
  { memberId: 'ben', subject: 'English', topic: 'Situational Writing', memoryScore: 86 },
  { memberId: 'ben', subject: 'English', topic: 'Continuous Writing', memoryScore: 56 },
  { memberId: 'aisha', subject: 'English', topic: 'Editing', memoryScore: 93 },
  { memberId: 'aisha', subject: 'English', topic: 'Visual Text', memoryScore: 63 },
  { memberId: 'leo', subject: 'English', topic: 'Comprehension', memoryScore: 78 },
  { memberId: 'leo', subject: 'English', topic: 'Continuous Writing', memoryScore: 48 },
  { memberId: 'nora', subject: 'English', topic: 'Editing', memoryScore: 70 },
  { memberId: 'nora', subject: 'English', topic: 'Visual Text', memoryScore: 40 },
  // History
  { memberId: 'maya', subject: 'History', topic: 'World War I', memoryScore: 97 },
  { memberId: 'maya', subject: 'History', topic: 'United Nations', memoryScore: 81 },
  { memberId: 'ben', subject: 'History', topic: 'World War II', memoryScore: 88 },
  { memberId: 'ben', subject: 'History', topic: 'Singapore History', memoryScore: 58 },
  { memberId: 'aisha', subject: 'History', topic: 'The Cold War', memoryScore: 90 },
  { memberId: 'aisha', subject: 'History', topic: 'Decolonisation', memoryScore: 60 },
  { memberId: 'leo', subject: 'History', topic: 'World War I', memoryScore: 73 },
  { memberId: 'leo', subject: 'History', topic: 'Singapore History', memoryScore: 43 },
  { memberId: 'nora', subject: 'History', topic: 'The Cold War', memoryScore: 76 },
  { memberId: 'nora', subject: 'History', topic: 'United Nations', memoryScore: 46 },
  // Geography
  { memberId: 'maya', subject: 'Geography', topic: 'Weather & Climate', memoryScore: 97 },
  { memberId: 'maya', subject: 'Geography', topic: 'Food Resources', memoryScore: 77 },
  { memberId: 'ben', subject: 'Geography', topic: 'Plate Tectonics', memoryScore: 84 },
  { memberId: 'ben', subject: 'Geography', topic: 'Coasts', memoryScore: 54 },
  { memberId: 'aisha', subject: 'Geography', topic: 'Rivers', memoryScore: 89 },
  { memberId: 'aisha', subject: 'Geography', topic: 'Tourism', memoryScore: 59 },
  { memberId: 'leo', subject: 'Geography', topic: 'Coasts', memoryScore: 81 },
  { memberId: 'leo', subject: 'Geography', topic: 'Weather & Climate', memoryScore: 51 },
  { memberId: 'nora', subject: 'Geography', topic: 'Plate Tectonics', memoryScore: 72 },
  { memberId: 'nora', subject: 'Geography', topic: 'Rivers', memoryScore: 42 },
  // A-Math
  { memberId: 'maya', subject: 'A-Math', topic: 'Quadratics', memoryScore: 97 },
  { memberId: 'maya', subject: 'A-Math', topic: 'Integration', memoryScore: 73 },
  { memberId: 'ben', subject: 'A-Math', topic: 'Polynomials', memoryScore: 85 },
  { memberId: 'ben', subject: 'A-Math', topic: 'Coordinate Geometry', memoryScore: 55 },
  { memberId: 'aisha', subject: 'A-Math', topic: 'Trigonometry', memoryScore: 91 },
  { memberId: 'aisha', subject: 'A-Math', topic: 'Differentiation', memoryScore: 61 },
  { memberId: 'leo', subject: 'A-Math', topic: 'Quadratics', memoryScore: 75 },
  { memberId: 'leo', subject: 'A-Math', topic: 'Coordinate Geometry', memoryScore: 45 },
  { memberId: 'nora', subject: 'A-Math', topic: 'Trigonometry', memoryScore: 74 },
  { memberId: 'nora', subject: 'A-Math', topic: 'Polynomials', memoryScore: 44 },
  // E-Math
  { memberId: 'maya', subject: 'E-Math', topic: 'Numbers', memoryScore: 97 },
  { memberId: 'maya', subject: 'E-Math', topic: 'Probability', memoryScore: 79 },
  { memberId: 'ben', subject: 'E-Math', topic: 'Algebra', memoryScore: 83 },
  { memberId: 'ben', subject: 'E-Math', topic: 'Mensuration', memoryScore: 53 },
  { memberId: 'aisha', subject: 'E-Math', topic: 'Statistics', memoryScore: 88 },
  { memberId: 'aisha', subject: 'E-Math', topic: 'Geometry', memoryScore: 58 },
  { memberId: 'leo', subject: 'E-Math', topic: 'Geometry', memoryScore: 80 },
  { memberId: 'leo', subject: 'E-Math', topic: 'Algebra', memoryScore: 50 },
  { memberId: 'nora', subject: 'E-Math', topic: 'Statistics', memoryScore: 77 },
  { memberId: 'nora', subject: 'E-Math', topic: 'Numbers', memoryScore: 47 },
];

// Curated from the genuinely lowest scores in squadMemberTopicScores above
// (was previously 4 fixed picks that didn't track the real data - now the
// actual weakest topics for whichever member is weakest at them).
export const weakTopics: WeakTopic[] = [
  { id: 'genetics', topic: 'Genetics', subject: 'Biology', memberId: 'nora', score: 37 },
  { id: 'rate-of-reaction', topic: 'Rate of Reaction', subject: 'Chemistry', memberId: 'leo', score: 39 },
  { id: 'visual-text', topic: 'Visual Text', subject: 'English', memberId: 'nora', score: 40 },
  { id: 'rivers', topic: 'Rivers', subject: 'Geography', memberId: 'nora', score: 42 },
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
