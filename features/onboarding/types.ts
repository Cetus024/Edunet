export type OnboardingRole = 'student' | 'teacher' | 'tutor' | 'parent';

export type OnboardingLearningSource = 'material' | 'recording' | 'none';

export type OnboardingFamiliarity = 'new' | 'some' | 'well';

export interface OnboardingMaterialMetadata {
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

export interface OnboardingRecordingMetadata {
  durationSeconds: number;
  mimeType: string;
}
