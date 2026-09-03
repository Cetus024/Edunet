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

// Transcript of a spoken explanation, marked against the topic's syllabus
// content. The upper bound is generous next to a three-minute session (~450
// words) so a longer room does not start rejecting work, while still capping
// what reaches the model.
export const discussionAnalysisSchema = z.strictObject({
  topicId: z.string().trim().min(1).max(128),
  transcript: z.string().trim().min(1).max(20_000),
});

export const createStudySquadSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
});

export const inviteToStudySquadSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
});

export const studySquadInvitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const inviteSchoolUserToStudySquadSchema = z.strictObject({
  userId: z.string().trim().min(1).max(255),
});

export const studySquadInvitationIdSchema = z.uuid();

export const notificationIdSchema = z.uuid();

export const notificationsQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const squadQuizRoomIdSchema = z.uuid();

export const createSquadQuizRoomSchema = z.strictObject({
  topicId: z.string().trim().min(1).max(128),
  invitedUserIds: z.array(z.string().trim().min(1).max(255)).max(4).default([]),
  message: z.string().trim().max(500).optional(),
});

export const joinSquadQuizRoomSchema = z.strictObject({
  avatarColor: z.enum(['Yellow', 'LightBlue', 'White']),
});

export const submitSquadQuizAnswerSchema = z.strictObject({
  questionIndex: z.number().int().min(0).max(9),
  answer: z.union([z.string().trim().min(1).max(4_000), z.number().int().min(0).max(5)]),
});

export const inviteSquadQuizParticipantsSchema = z.strictObject({
  userIds: z.array(z.string().trim().min(1).max(255)).min(1).max(4),
});

export const revisionRoomIdSchema = z.uuid();

export const createRevisionRoomSchema = z.strictObject({
  topicId: z.string().trim().min(1).max(128),
  invitedUserIds: z.array(z.string().trim().min(1).max(255)).max(4).default([]),
});

export const revisionRoomInviteSchema = z.strictObject({
  userIds: z.array(z.string().trim().min(1).max(255)).min(1).max(4),
});

export const revisionUtteranceSchema = z.strictObject({
  submissionId: z.uuid(),
  text: z.string().trim().min(1).max(20_000),
  locale: z.string().trim().min(2).max(20).default('en'),
  provider: z.enum(['browser', 'huawei']).default('browser'),
  speakingMs: z.number().int().min(0).max(1_800_000).default(0),
});
