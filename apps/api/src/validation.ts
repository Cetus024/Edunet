import { z } from 'zod';

const optionalNullable = <T extends z.ZodType>(schema: T) => schema.nullish();

export const signupReferralCodeSchema = z.string().trim().max(64);

export const materialMetadataSchema = z.strictObject({
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(127),
  size: z.number().int().min(0).max(25 * 1024 * 1024),
  lastModified: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});

export const recordingMetadataSchema = z.strictObject({
  durationSeconds: z.number().int().min(1).max(600),
  mimeType: z.string().trim().min(1).max(127),
});

export const childInfoSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  email: z.email().trim().toLowerCase().max(255),
});

export const teachingScopeInputSchema = z.strictObject({
  subjectId: z.string().trim().min(1).max(64),
  classroomName: z.string().trim().min(1).max(80),
});

export const onboardingRequestSchema = z.strictObject({
  role: z.enum(['student', 'teacher', 'tutor', 'parent']),
  schoolId: z.string().trim().min(1).max(128).optional(),
  // Accepted as a compatibility input for the existing selector. It is always
  // resolved against the fixed schools table; arbitrary values remain invalid.
  school: z.string().trim().min(1).max(255).optional(),
  // Compatibility-only fields for clients cached before the simplified
  // onboarding rollout. The route normalizes every new profile to `none` and
  // ignores artifact metadata.
  learningSource: z.enum(['material', 'recording', 'none']).optional(),
  material: optionalNullable(materialMetadataSchema),
  recording: optionalNullable(recordingMetadataSchema),
  subjectId: z.string().trim().min(1).max(64),
  topicId: z.string().trim().min(1).max(128),
  familiarity: z.enum(['new', 'some', 'well']),
  teachingScopes: z.array(teachingScopeInputSchema).min(1).max(16).optional(),
  // Parent role only: who they want to follow.
  child: optionalNullable(childInfoSchema),
}).superRefine((value, context) => {
  if (!value.schoolId && !value.school) {
    context.addIssue({ code: 'custom', path: ['schoolId'], message: 'Select a school.' });
  }
  if (value.schoolId && value.school) {
    context.addIssue({ code: 'custom', path: ['school'], message: 'Supply either schoolId or school, not both.' });
  }

  if (value.role === 'parent' && !value.child) {
    context.addIssue({ code: 'custom', path: ['child'], message: "A parent must provide their child's name and email." });
  }
  if (value.role !== 'parent' && value.child) {
    context.addIssue({ code: 'custom', path: ['child'], message: 'Only parents provide child details.' });
  }
  const isTeachingRole = value.role === 'teacher' || value.role === 'tutor';
  if (!isTeachingRole && value.teachingScopes) {
    context.addIssue({ code: 'custom', path: ['teachingScopes'], message: 'Only teachers and tutors provide teaching scopes.' });
  }
  if (isTeachingRole && value.teachingScopes && value.teachingScopes[0]?.subjectId !== value.subjectId) {
    context.addIssue({ code: 'custom', path: ['teachingScopes', 0, 'subjectId'], message: 'The primary teaching context must match the primary subject.' });
  }
});

export const updateTeachingScopesSchema = z.strictObject({
  scopes: z.array(teachingScopeInputSchema).min(1).max(16),
});

export const updateQuestionReviewSchema = z.strictObject({
  questionKey: z.string().regex(/^[a-z0-9-]+:v1:q\d{2,3}$/),
  explanation: z.string().trim().min(1).max(2_000),
});

export const updateSchoolSchema = z.strictObject({
  schoolId: z.string().trim().min(1).max(128),
});

export const quizSubmissionSchema = z.strictObject({
  submissionId: z.uuid(),
  topicId: z.string().trim().min(1).max(128),
  mode: z.enum(['past-paper', 'concept-check', 'speed-round']),
  paperId: z.enum(['paper-1', 'paper-2']).optional(),
  startedAt: z.iso.datetime({ offset: true }).optional(),
  answers: z.array(z.strictObject({
    questionKey: z.string().regex(/^[a-z0-9-]+:v1:q\d{2,3}$/),
    answer: z.union([z.string().max(4_000), z.number().int().nonnegative()]),
  })).min(1).max(50),
});

export const quizOptionsQuerySchema = z.strictObject({
  subjectId: z.string().trim().min(1).max(64),
  topicId: z.string().trim().min(1).max(128),
});

export const quizSetRequestSchema = z.strictObject({
  submissionId: z.uuid(),
  topicId: z.string().trim().min(1).max(128),
  mode: z.enum(['past-paper', 'concept-check', 'speed-round']),
  paperId: z.enum(['paper-1', 'paper-2']).optional(),
});

export const quizHistoryQuerySchema = z.object({
  topicId: z.string().trim().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const enquiryBodySchema = z.string()
  .max(4_000)
  .transform((body) => body.trim())
  .pipe(z.string().min(1));

export const questionRecipientsQuerySchema = z.strictObject({
  subjectId: z.string().trim().min(1).max(32),
});

export const createEnquirySchema = z.strictObject({
  submissionId: z.uuid(),
  recipientUserId: z.string().trim().min(1).max(255),
  subjectId: z.string().trim().min(1).max(32),
  topicId: z.string().trim().min(1).max(64).nullish(),
  body: enquiryBodySchema,
});

export const sendEnquiryMessageSchema = z.strictObject({
  submissionId: z.uuid(),
  body: enquiryBodySchema,
});

export const enquiryThreadIdSchema = z.uuid();

export const studentSearchQuerySchema = z.strictObject({
  q: z.string().trim().min(1).max(120),
  scopeId: z.string().trim().min(1).max(64),
});

export const addStudentToScopeSchema = z.strictObject({
  studentId: z.string().trim().min(1).max(255),
  scopeId: z.string().trim().min(1).max(64),
});

export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;
export type QuizSubmission = z.infer<typeof quizSubmissionSchema>;
export type QuizSetRequest = z.infer<typeof quizSetRequestSchema>;
export type CreateEnquiryRequest = z.infer<typeof createEnquirySchema>;
export type SendEnquiryMessageRequest = z.infer<typeof sendEnquiryMessageSchema>;
