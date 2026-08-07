import { useQuery } from '@tanstack/react-query';

import { getDemoCurrentAccount } from '@/lib/demo-auth';

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export type OnboardingProfileResponse = {
  role: 'student' | 'teacher' | 'tutor' | 'parent';
  schoolId: string;
  schoolName: string;
  learningSource: 'material' | 'recording' | 'none';
  material: unknown | null;
  recording: unknown | null;
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  familiarity: 'new' | 'some' | 'well';
  initialMemoryScore: number;
  completedAt: string;
};

export type CurrentAccount = {
  user: CurrentUser;
  onboardingCompleted: boolean;
  profile: OnboardingProfileResponse | null;
};

export const currentAccountQueryKey = ['current-account'] as const;

export async function getCurrentAccount(): Promise<CurrentAccount | null> {
  return getDemoCurrentAccount();
}

export function useCurrentAccount() {
  return useQuery({
    queryKey: currentAccountQueryKey,
    queryFn: getCurrentAccount,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}
