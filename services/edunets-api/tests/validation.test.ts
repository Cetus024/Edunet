import { describe, expect, it } from 'vitest';
import {
  createEnquirySchema,
  onboardingRequestSchema,
  questionRecipientsQuerySchema,
  quizOptionsQuerySchema,
  quizSetRequestSchema,
  quizSubmissionSchema,
  sendEnquiryMessageSchema,
  updateTeachingScopesSchema,
} from '../src/validation.js';

describe('onboarding validation', () => {
  const valid = {
    role: 'student',
    schoolId: 'example-school',
    subjectId: 'amath',
    topicId: 'amath-trig',
    familiarity: 'some',
  } as const;

  it('accepts a catalog ID without requesting a learning artifact', () => {
    expect(onboardingRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('temporarily accepts legacy artifact metadata for rollout compatibility', () => {
    expect(onboardingRequestSchema.safeParse({
      ...valid,
      learningSource: 'material',
      material: { name: 'notes.pdf', type: 'application/pdf', size: 100, lastModified: 1 },
    }).success).toBe(true);
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
      subjectId: 'biology',
      topicId: 'biology-cells',
      familiarity: 'well',
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
      familiarity: 'some',
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
