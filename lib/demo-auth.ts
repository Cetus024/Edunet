'use client';

import type { CurrentAccount } from '@/lib/api/me';
import type { StudyStateResponse } from '@/lib/api/study';
import { createEmptySubjectData } from '@/lib/study-data';

const DEMO_SESSION_KEY = 'edunets-demo-account-id';
const DEMO_PASSWORD = 'EduNets2026!';

/**
 * Temporary, public demo snapshots exported from Neon on 31 July 2026.
 * Personal names and email addresses are deliberately replaced with aliases.
 */
const DEMO_ACCOUNTS: CurrentAccount[] = [
  {
    user: {
      id: 'neon-demo-student',
      name: 'EduNets Student',
      email: 'student@edunets.demo',
      image: null,
    },
    onboardingCompleted: true,
    profile: {
      role: 'student',
      schoolId: 'school-admiralty-secondary-school',
      schoolName: 'Admiralty Secondary School',
      learningSource: 'none',
      material: null,
      recording: null,
      subjectId: 'chem',
      subjectName: 'Chemistry',
      topicId: 'chem-bonding',
      topicName: 'Covalent Bonding',
      familiarity: 'some',
      initialMemoryScore: 50,
      completedAt: '2026-07-31T00:00:00.000Z',
    },
  },
  {
    user: {
      id: 'neon-demo-teacher',
      name: 'EduNets Teacher',
      email: 'teacher@edunets.demo',
      image: null,
    },
    onboardingCompleted: true,
    profile: {
      role: 'teacher',
      schoolId: 'school-ahmad-ibrahim-secondary-school',
      schoolName: 'Ahmad Ibrahim Secondary School',
      learningSource: 'none',
      material: null,
      recording: null,
      subjectId: 'geo',
      subjectName: 'Geography',
      topicId: 'geo-tectonics',
      topicName: 'Plate Tectonics',
      familiarity: 'well',
      initialMemoryScore: 80,
      completedAt: '2026-07-31T00:00:00.000Z',
    },
  },
];

export const DEMO_LOGIN_OPTIONS = DEMO_ACCOUNTS.map((account) => ({
  email: account.user.email,
  label: account.profile?.role === 'teacher' ? 'Teacher Demo' : 'Student Demo',
  password: DEMO_PASSWORD,
}));

function findAccountById(userId: string | null) {
  return DEMO_ACCOUNTS.find((account) => account.user.id === userId) ?? null;
}

export function getDemoCurrentAccount(): CurrentAccount | null {
  if (typeof window === 'undefined') return null;
  return findAccountById(window.localStorage.getItem(DEMO_SESSION_KEY));
}

export function signInToDemo(email: string, password: string): CurrentAccount | null {
  if (typeof window === 'undefined' || password !== DEMO_PASSWORD) return null;

  const normalizedEmail = email.trim().toLowerCase();
  const account = DEMO_ACCOUNTS.find(
    (candidate) => candidate.user.email.toLowerCase() === normalizedEmail,
  ) ?? null;

  if (account) window.localStorage.setItem(DEMO_SESSION_KEY, account.user.id);
  return account;
}

export function signOutOfDemo() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(DEMO_SESSION_KEY);
}

export function getDemoStudyState(): StudyStateResponse {
  const account = getDemoCurrentAccount();
  const subjects = createEmptySubjectData();
  const profile = account?.profile;

  if (!profile) return { subjects };

  return {
    subjects: subjects.map((subject) => ({
      ...subject,
      topics: subject.topics.map((topic) => {
        if (topic.id !== profile.topicId) return topic;
        return {
          ...topic,
          memoryScore: profile.initialMemoryScore,
          lastReviewedAt: profile.completedAt,
          nextReviewAt: null,
          quizAttempts: 0,
        };
      }),
    })),
  };
}
