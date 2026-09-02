import { z } from 'zod';

export const signupReferralCodeSchema = z.string().trim().max(64);

export const teachingScopeInputSchema = z.strictObject({
  subjectId: z.string().trim().min(1).max(64),
  classroomName: z.string().trim().min(1).max(80),
});

const onboardingSchoolFields = {
  schoolId: z.string().trim().min(1).max(128).optional(),
  school: z.string().trim().min(1).max(255).optional(),
} as const;

const placementAnswerSchema = z.strictObject({
  questionKey: z.string().regex(/^[a-z0-9-]+:v1:q\d{2,3}$/),
  answer: z.number().int().min(0).max(3),
});

const studentOnboardingSchema = z.strictObject({
  role: z.literal('student'),
  ...onboardingSchoolFields,
  subjectId: z.string().trim().min(1).max(64),
  topicId: z.string().trim().min(1).max(128),
  placement: z.strictObject({
    submissionId: z.uuid(),
    startedAt: z.iso.datetime({ offset: true }).optional(),
    answers: z.array(placementAnswerSchema).length(10),
  }),
});

const teacherOnboardingSchema = z.strictObject({
  role: z.literal('teacher'),
  ...onboardingSchoolFields,
  teachingScopes: z.array(teachingScopeInputSchema).min(1).max(16),
});

export const onboardingRequestSchema = z.discriminatedUnion('role', [
  studentOnboardingSchema,
  teacherOnboardingSchema,
]).superRefine((value, context) => {
  if (!value.schoolId && !value.school) {
    context.addIssue({ code: 'custom', path: ['schoolId'], message: 'Select a school.' });
  }
  if (value.schoolId && value.school) {
    context.addIssue({ code: 'custom', path: ['school'], message: 'Supply either schoolId or school, not both.' });
  }
});

export const placementSetRequestSchema = z.strictObject({
  submissionId: z.uuid(),
  subjectId: z.string().trim().min(1).max(64),
  topicId: z.string().trim().min(1).max(128),
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

export const quizOptionsQuerySchema = z.strictObject({
  subjectId: z.string().trim().min(1).max(64),
  topicId: z.string().trim().min(1).max(128),
});

export const quizSetRequestSchema = z.strictObject({
  submissionId: z.uuid(),
  topicId: z.string().trim().min(1).max(128),
  mode: z.enum(['mcq', 'essay']),
});

export const assessmentAnswerSchema = z.strictObject({
  questionKey: z.string().regex(/^[a-z0-9-]+:v1:q\d{2,3}$/),
  questionIndex: z.number().int().min(0).max(9),
  answer: z.union([z.string().trim().min(1).max(4_000), z.number().int().min(0).max(3)]),
  marksObtained: z.number().min(0).max(10).multipleOf(0.01).optional(),
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
export type QuizSetRequest = z.infer<typeof quizSetRequestSchema>;
export type CreateEnquiryRequest = z.infer<typeof createEnquirySchema>;
export type SendEnquiryMessageRequest = z.infer<typeof sendEnquiryMessageSchema>;
