import { describe, expect, it } from 'vitest';
import {
  createEnquirySchema,
  captureOcrSchema,
  onboardingRequestSchema,
  placementSetRequestSchema,
  questionRecipientsQuerySchema,
  quizOptionsQuerySchema,
  quizSetRequestSchema,
  assessmentAnswerSchema,
  sendEnquiryMessageSchema,
  signupReferralCodeSchema,
  createStudySquadSchema,
  createSquadQuizRoomSchema,
  createRevisionRoomSchema,
  inviteSquadQuizParticipantsSchema,
  inviteToStudySquadSchema,
  inviteSchoolUserToStudySquadSchema,
  notificationIdSchema,
  notificationsQuerySchema,
  revisionRoomIdSchema,
  revisionRoomInviteSchema,
  revisionUtteranceSchema,
  joinSquadQuizRoomSchema,
  squadQuizRoomIdSchema,
  studySquadInvitationIdSchema,
  studySquadInvitationTokenSchema,
  updateTeachingScopesSchema,
} from '../src/validation.js';

describe('Capture Hub OCR validation', () => {
  it('accepts the compressed Base64 ceiling and rejects payloads above it', () => {
    const base = { mimeType: 'image/jpeg' as const };

    expect(captureOcrSchema.safeParse({
      ...base,
      imageBase64: 'a'.repeat(4_194_304),
    }).success).toBe(true);
    expect(captureOcrSchema.safeParse({
      ...base,
      imageBase64: 'a'.repeat(4_200_001),
    }).success).toBe(false);
  });
});

describe('authentication extension validation', () => {
  it('normalizes a referral code and enforces its OAuth-safe limit', () => {
    expect(signupReferralCodeSchema.parse('  SCHOOL-2026  ')).toBe('SCHOOL-2026');
    expect(signupReferralCodeSchema.safeParse('x'.repeat(65)).success).toBe(false);
    expect(signupReferralCodeSchema.safeParse({ code: 'SCHOOL-2026' }).success).toBe(false);
  });
});

describe('onboarding validation', () => {
  const answers = Array.from({ length: 10 }, (_, index) => ({
    questionKey: `math-number-algebra:v2:q${String(index + 1).padStart(2, '0')}`,
    answer: index % 4,
  }));
  const valid = {
    role: 'student',
    schoolId: 'example-school',
    subjectId: 'e-math',
    topicId: 'math-number-algebra',
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
  it('accepts only MCQ and Essay assessment-set requests', () => {
    expect(quizOptionsQuerySchema.safeParse({ subjectId: 'chemistry', topicId: 'chemistry-organic-chemistry' }).success).toBe(true);
    expect(quizSetRequestSchema.safeParse({
      submissionId: '4b375843-c273-4e7d-bfe7-ac20dbdaf47d',
      topicId: 'chemistry-organic-chemistry',
      mode: 'mcq',
    }).success).toBe(true);
    expect(quizSetRequestSchema.safeParse({
      submissionId: '4b375843-c273-4e7d-bfe7-ac20dbdaf47d',
      topicId: 'chemistry-organic-chemistry',
      mode: 'essay',
    }).success).toBe(true);
    expect(quizSetRequestSchema.safeParse({
      submissionId: '4b375843-c273-4e7d-bfe7-ac20dbdaf47d',
      topicId: 'chemistry-organic-chemistry',
      mode: 'past-paper',
    }).success).toBe(false);
    expect(quizSetRequestSchema.safeParse({
      submissionId: '4b375843-c273-4e7d-bfe7-ac20dbdaf47d',
      topicId: 'chemistry-organic-chemistry',
      mode: 'speed-round',
    }).success).toBe(false);
  });

  it('accepts typed answers and enforces Essay mark precision and range', () => {
    expect(assessmentAnswerSchema.safeParse({
      questionKey: 'chemistry-organic-chemistry:v2:q01',
      questionIndex: 0,
      answer: 2,
    }).success).toBe(true);
    expect(assessmentAnswerSchema.safeParse({
      questionKey: 'chemistry-organic-chemistry:v2:q13',
      questionIndex: 0,
      answer: 'A supported written response.',
      marksObtained: 7.25,
    }).success).toBe(true);
    for (const marksObtained of [-0.01, 10.01, 7.123, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(assessmentAnswerSchema.safeParse({
        questionKey: 'chemistry-organic-chemistry:v2:q13', questionIndex: 0,
        answer: 'A supported written response.', marksObtained,
      }).success).toBe(false);
    }
    expect(assessmentAnswerSchema.safeParse({
      questionKey: 'chemistry-organic-chemistry:q1', questionIndex: 0, answer: 2,
    }).success).toBe(false);
  });
});

describe('teaching context validation', () => {
  it('accepts multiple named subjects for a teacher', () => {
    expect(onboardingRequestSchema.safeParse({
      role: 'teacher',
      schoolId: 'example-school',
      teachingScopes: [
        { subjectId: 'e-math', classroomName: 'Mathematics 4A' },
        { subjectId: 'chemistry', classroomName: 'Chemistry 4B' },
      ],
    }).success).toBe(true);
  });

  it('rejects teaching contexts for learners and requires at least one on profile updates', () => {
    expect(onboardingRequestSchema.safeParse({
      role: 'student',
      schoolId: 'example-school',
      subjectId: 'e-math',
      topicId: 'math-number-algebra',
      teachingScopes: [{ subjectId: 'e-math', classroomName: '4A' }],
    }).success).toBe(false);
    expect(updateTeachingScopesSchema.safeParse({ scopes: [] }).success).toBe(false);
  });
});

describe('enquiry validation', () => {
  const submissionId = '4b375843-c273-4e7d-bfe7-ac20dbdaf47d';

  it('requires a subject for the recipient directory', () => {
    expect(questionRecipientsQuerySchema.safeParse({ subjectId: 'e-math' }).success).toBe(true);
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
      subjectId: 'e-math',
      topicId: null,
      body: 'How do I start this question?',
    }).success).toBe(true);

    expect(createEnquirySchema.safeParse({
      submissionId,
      recipientUserId: 'teacher-1',
      subjectId: 'e-math',
      body: 'Question',
      userId: 'someone-else',
    }).success).toBe(false);
  });
});

describe('study squad validation', () => {
  it('normalizes squad names and invited email addresses', () => {
    expect(createStudySquadSchema.parse({ name: '  Memory Makers  ' })).toEqual({
      name: 'Memory Makers',
    });
    expect(inviteToStudySquadSchema.parse({ email: '  FRIEND@Example.COM  ' })).toEqual({
      email: 'friend@example.com',
    });
  });

  it('rejects extra identity fields and malformed invitation tokens', () => {
    expect(createStudySquadSchema.safeParse({ name: 'Squad', ownerUserId: 'other-user' }).success)
      .toBe(false);
    expect(inviteToStudySquadSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(studySquadInvitationTokenSchema.safeParse('short-token').success).toBe(false);
    expect(studySquadInvitationTokenSchema.safeParse('a'.repeat(43)).success).toBe(true);
    expect(inviteSchoolUserToStudySquadSchema.parse({ userId: 'student-2' }))
      .toEqual({ userId: 'student-2' });
    expect(studySquadInvitationIdSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});

describe('notification validation', () => {
  it('defaults and bounds the list size while requiring UUID notification ids', () => {
    expect(notificationsQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(notificationsQuerySchema.parse({ limit: '100' })).toEqual({ limit: 100 });
    expect(notificationsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(notificationIdSchema.safeParse('4b375843-c273-4e7d-bfe7-ac20dbdaf47d').success).toBe(true);
  });
});

describe('live Squad quiz validation', () => {
  const roomId = '4b375843-c273-4e7d-bfe7-ac20dbdaf47d';

  it('accepts bounded room creation, join, and invitation payloads', () => {
    expect(createSquadQuizRoomSchema.parse({
      topicId: 'chemistry-chemical-bonding-structure',
      invitedUserIds: ['student-2'],
      message: 'Quick rescue?',
    }).invitedUserIds).toEqual(['student-2']);
    expect(joinSquadQuizRoomSchema.safeParse({ avatarColor: 'LightBlue' }).success).toBe(true);
    expect(inviteSquadQuizParticipantsSchema.safeParse({ userIds: ['student-2'] }).success).toBe(true);
    expect(squadQuizRoomIdSchema.safeParse(roomId).success).toBe(true);
  });

  it('rejects spoofed identity fields and invalid join or invitation payloads', () => {
    expect(createSquadQuizRoomSchema.safeParse({
      topicId: 'chemistry-chemical-bonding-structure',
      invitedUserIds: [],
      hostUserId: 'someone-else',
    }).success).toBe(false);
    expect(joinSquadQuizRoomSchema.safeParse({ avatarColor: 'Red' }).success).toBe(false);
    expect(inviteSquadQuizParticipantsSchema.safeParse({ userIds: [] }).success).toBe(false);
  });
});

describe('multiplayer Revision Room validation', () => {
  const roomId = '4b375843-c273-4e7d-bfe7-ac20dbdaf47d';

  it('accepts bounded room, invitation, and attributed transcript payloads', () => {
    expect(createRevisionRoomSchema.parse({
      topicId: 'chemistry-redox-chemistry',
      invitedUserIds: ['student-2'],
    }).invitedUserIds).toEqual(['student-2']);
    expect(revisionRoomInviteSchema.safeParse({ userIds: ['student-2'] }).success).toBe(true);
    expect(revisionUtteranceSchema.parse({
      submissionId: roomId,
      text: 'Oxidation is electron loss while reduction is electron gain.',
    })).toMatchObject({ locale: 'en', provider: 'browser', speakingMs: 0 });
    expect(revisionRoomIdSchema.safeParse(roomId).success).toBe(true);
  });

  it('rejects spoofed identity fields and empty transcripts', () => {
    expect(createRevisionRoomSchema.safeParse({
      topicId: 'chemistry-redox-chemistry',
      invitedUserIds: [],
      hostUserId: 'someone-else',
    }).success).toBe(false);
    expect(revisionUtteranceSchema.safeParse({ submissionId: roomId, text: '   ' }).success).toBe(false);
    expect(revisionRoomInviteSchema.safeParse({ userIds: [] }).success).toBe(false);
  });
});
