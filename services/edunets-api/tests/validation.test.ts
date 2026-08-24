import { describe, expect, it } from 'vitest';
import {
  createEnquirySchema,
  onboardingRequestSchema,
  placementSetRequestSchema,
  questionRecipientsQuerySchema,
  quizOptionsQuerySchema,
  quizSetRequestSchema,
  quizSubmissionSchema,
  sendEnquiryMessageSchema,
  signupReferralCodeSchema,
  updateTeachingScopesSchema,
} from '../src/validation.js';

describe('authentication extension validation', () => {
  it('normalizes a referral code and enforces its OAuth-safe limit', () => {
    expect(signupReferralCodeSchema.parse('  SCHOOL-2026  ')).toBe('SCHOOL-2026');
    expect(signupReferralCodeSchema.safeParse('x'.repeat(65)).success).toBe(false);
    expect(signupReferralCodeSchema.safeParse({ code: 'SCHOOL-2026' }).success).toBe(false);
  });
});

describe('onboarding validation', () => {
  const answers = Array.from({ length: 10 }, (_, index) => ({
    questionKey: `amath-trig:v1:q${String(index + 1).padStart(2, '0')}`,
    answer: index % 4,
  }));
  const valid = {
    role: 'student',
    schoolId: 'example-school',
    subjectId: 'amath',
    topicId: 'amath-trig',
    placement: {
      submissionId: '4b375843-c273-4e7d-bfe7-ac20dbdaf47d',
      startedAt: '2026-08-24T10:00:00.000Z',
      answers,
    },
  } as const;

  it('accepts a student with exactly ten placement answers', () => {
    expect(onboardingRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects removed roles and incomplete placement answers', () => {
    expect(onboardingRequestSchema.safeParse({ ...valid, role: 'parent' }).success).toBe(false);
    expect(onboardingRequestSchema.safeParse({ ...valid, role: 'tutor' }).success).toBe(false);
    expect(onboardingRequestSchema.safeParse({
      ...valid,
      placement: { ...valid.placement, answers: answers.slice(0, 9) },
    }).success).toBe(false);
  });

  it('accepts a placement-set request without accepting client scoring data', () => {
    expect(placementSetRequestSchema.safeParse({
      submissionId: valid.placement.submissionId,
      subjectId: valid.subjectId,
      topicId: valid.topicId,
    }).success).toBe(true);
    expect(placementSetRequestSchema.safeParse({
      submissionId: valid.placement.submissionId,
      subjectId: valid.subjectId,
      topicId: valid.topicId,
      score: 100,
    }).success).toBe(false);
  });
});

describe('quiz submission validation', () => {
  it('requires a UUID submission ID and versioned question keys', () => {
    const result = quizSubmissionSchema.safeParse({
      submissionId: '4b375843-c273-4e7d-bfe7-ac20dbdaf47d',
      topicId: 'amath-trig',
      mode: 'concept-check',
      answers: [{ questionKey: 'amath-trig:v1:q01', answer: 2 }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts database quiz option and set requests', () => {
    expect(quizOptionsQuerySchema.safeParse({ subjectId: 'biology', topicId: 'biology-ecology' }).success).toBe(true);
    expect(quizSetRequestSchema.safeParse({
      submissionId: '4b375843-c273-4e7d-bfe7-ac20dbdaf47d',
      topicId: 'biology-ecology',
      mode: 'speed-round',
    }).success).toBe(true);
    expect(quizSetRequestSchema.safeParse({
      submissionId: '4b375843-c273-4e7d-bfe7-ac20dbdaf47d',
      topicId: 'biology-ecology',
      mode: 'past-paper',
      paperId: 'invented-paper',
    }).success).toBe(false);
  });

  it('rejects client-invented key formats', () => {
    const result = quizSubmissionSchema.safeParse({
      submissionId: '4b375843-c273-4e7d-bfe7-ac20dbdaf47d',
      topicId: 'amath-trig',
      mode: 'concept-check',
      answers: [{ questionKey: 'amath-trig:q1', answer: 2 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('teaching context validation', () => {
  it('accepts multiple named subjects for a teacher', () => {
    expect(onboardingRequestSchema.safeParse({
      role: 'teacher',
      schoolId: 'example-school',
      teachingScopes: [
        { subjectId: 'biology', classroomName: 'Biology 4A' },
        { subjectId: 'chemistry', classroomName: 'Chemistry 4B' },
      ],
    }).success).toBe(true);
  });

  it('rejects teaching contexts for learners and requires at least one on profile updates', () => {
    expect(onboardingRequestSchema.safeParse({
      role: 'student',
      schoolId: 'example-school',
      subjectId: 'amath',
      topicId: 'amath-trig',
      teachingScopes: [{ subjectId: 'amath', classroomName: '4A' }],
    }).success).toBe(false);
    expect(updateTeachingScopesSchema.safeParse({ scopes: [] }).success).toBe(false);
  });
});

describe('enquiry validation', () => {
  const submissionId = '4b375843-c273-4e7d-bfe7-ac20dbdaf47d';

  it('requires a subject for the recipient directory', () => {
    expect(questionRecipientsQuerySchema.safeParse({ subjectId: 'amath' }).success).toBe(true);
    expect(questionRecipientsQuerySchema.safeParse({}).success).toBe(false);
  });

  it('trims a non-empty message without accepting more than 4000 input characters', () => {
    const parsed = sendEnquiryMessageSchema.parse({ submissionId, body: '  Please help  ' });
    expect(parsed.body).toBe('Please help');
    expect(sendEnquiryMessageSchema.safeParse({ submissionId, body: ' '.repeat(4_001) }).success)
      .toBe(false);
    expect(sendEnquiryMessageSchema.safeParse({ submissionId, body: '   ' }).success).toBe(false);
  });

  it('accepts the defined create payload and rejects client identity fields', () => {
    expect(createEnquirySchema.safeParse({
      submissionId,
      recipientUserId: 'teacher-1',
      subjectId: 'amath',
      topicId: null,
      body: 'How do I start this question?',
    }).success).toBe(true);

    expect(createEnquirySchema.safeParse({
      submissionId,
      recipientUserId: 'teacher-1',
      subjectId: 'amath',
      body: 'Question',
      userId: 'someone-else',
    }).success).toBe(false);
  });
});
