import type { PlacementQuestion, PlacementResult, PlacementSetResponse } from '@/lib/api/study';
import type { OnboardingRole } from './types';

export const ONBOARDING_DRAFT_KEY = 'edunets:onboarding-draft:v2';
export const PLACEMENT_RESULT_KEY = 'edunets:placement-result:v1';

export type OnboardingDraft = {
  step: number;
  role: OnboardingRole | null;
  schoolId: string;
  subjectId: string;
  topicId: string;
  teachingSubjectIds: string[];
  classroomNames: Record<string, string>;
  placementSet: PlacementSetResponse | null;
  placementAnswers: Record<string, number>;
  placementStartedAt: string | null;
  placementQuestionIndex: number;
};

export type StoredPlacementResult = {
  subjectName: string;
  topicName: string;
  questions: PlacementQuestion[];
  result: PlacementResult;
};
