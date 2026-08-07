import { z } from 'zod';

const optionalNullable = <T extends z.ZodType>(schema: T) => schema.nullish();

export const signUpExtensionSchema = z.looseObject({
  name: z.string().max(120).refine((name) => name.trim().length > 0),
  signupReferralCode: z.string().max(64).optional(),
});

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

export const onboardingRequestSchema = z.strictObject({
  role: z.enum(['student', 'teacher', 'tutor', 'parent']),
  schoolId: z.string().trim().min(1).max(128).optional(),
  // Accepted as a compatibility input for the existing selector. It is always
  // resolved against the fixed schools table; arbitrary values remain invalid.
  school: z.string().trim().min(1).max(255).optional(),
  learningSource: z.enum(['material', 'recording', 'none']),
  material: optionalNullable(materialMetadataSchema),
  recording: optionalNullable(recordingMetadataSchema),
  subjectId: z.string().trim().min(1).max(64),
  topicId: z.string().trim().min(1).max(128),
  familiarity: z.enum(['new', 'some', 'well']),
}).superRefine((value, context) => {
  if (!value.schoolId && !value.school) {
    context.addIssue({ code: 'custom', path: ['schoolId'], message: 'Select a school.' });
  }
  if (value.schoolId && value.school) {
    context.addIssue({ code: 'custom', path: ['school'], message: 'Supply either schoolId or school, not both.' });
  }

  if (value.learningSource === 'material' && (!value.material || value.recording)) {
    context.addIssue({ code: 'custom', path: ['material'], message: 'Material metadata is required exclusively.' });
  }
  if (value.learningSource === 'recording' && (!value.recording || value.material)) {
    context.addIssue({ code: 'custom', path: ['recording'], message: 'Recording metadata is required exclusively.' });
  }
  if (value.learningSource === 'none' && (value.material || value.recording)) {
    context.addIssue({ code: 'custom', path: ['learningSource'], message: 'No metadata is allowed for this source.' });
  }
});

export const quizSubmissionSchema = z.strictObject({
  submissionId: z.uuid(),
  topicId: z.string().trim().min(1).max(128),
  mode: z.enum(['past-paper', 'concept-check', 'speed-round']),
  startedAt: z.iso.datetime({ offset: true }).optional(),
  answers: z.array(z.strictObject({
    questionKey: z.string().regex(/^[a-z0-9-]+:v1:q\d{2}$/),
    answer: z.union([z.string().max(4_000), z.number().int().nonnegative()]),
  })).min(1).max(50),
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

export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;
export type QuizSubmission = z.infer<typeof quizSubmissionSchema>;
export type CreateEnquiryRequest = z.infer<typeof createEnquirySchema>;
export type SendEnquiryMessageRequest = z.infer<typeof sendEnquiryMessageSchema>;
