import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { subjects, topics } from '../../../../database/schema/catalog.js';
import { quizAttemptAnswers, quizAttempts, questionReviews } from '../../../../database/schema/learning.js';
import { users } from '../../../../database/schema/auth.js';
import { ApiError } from '../errors.js';
import { getQuestionByKey, getQuestionsForTopic } from '../lib/question-bank.js';
import { loadTeacherActor, listStudentsInScope } from './teacher-students.js';

export type ReviewQuestion = {
  questionKey: string;
  questionText: string;
  correctAnswer: string | number;
  aiGeneratedExplanation: string;
  teacherEditedExplanation: string | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  studentsWrong: number;
};

export type ReviewTopic = {
  topicId: string;
  topicName: string;
  questions: ReviewQuestion[];
};

export type QuizReviewResponse = {
  subject: { id: string; name: string };
  topics: ReviewTopic[];
};

/**
 * Aggregates real wrong answers from the roster's MCQ attempts,
 * grouped by topic, so teachers can review/refine the explanation shown for
 * each question. Essay self-marks are excluded until trusted AI grading is
 * introduced.
 */
export async function getQuizReviewForTeacher(
  teacherUserId: string,
  scopeId?: string,
): Promise<QuizReviewResponse> {
  const teacher = await loadTeacherActor(teacherUserId, scopeId);
  const roster = await listStudentsInScope(teacher);

  const [subjectRow] = await db.select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(eq(subjects.id, teacher.subjectId))
    .limit(1);
  if (!subjectRow) throw new ApiError(404, 'SUBJECT_NOT_FOUND', 'Subject was not found.');

  if (roster.length === 0) return { subject: subjectRow, topics: [] };

  const wrongRows = await db.select({
    topicId: quizAttempts.topicId,
    questionKey: quizAttemptAnswers.questionKey,
    studentsWrong: sql<number>`count(distinct ${quizAttempts.userId})`.mapWith(Number),
  })
    .from(quizAttempts)
    .innerJoin(quizAttemptAnswers, eq(quizAttemptAnswers.attemptId, quizAttempts.id))
    .where(and(
      inArray(quizAttempts.userId, roster.map((student) => student.id)),
      eq(quizAttempts.quizMode, 'mcq'),
      eq(quizAttempts.subjectId, subjectRow.id),
      eq(quizAttemptAnswers.isCorrect, false),
    ))
    .groupBy(quizAttempts.topicId, quizAttemptAnswers.questionKey);

  if (wrongRows.length === 0) return { subject: subjectRow, topics: [] };

  const topicIds = [...new Set(wrongRows.map((row) => row.topicId))];
  const topicRows = await db.select({ id: topics.id, name: topics.name })
    .from(topics)
    .where(inArray(topics.id, topicIds));
  const topicNameById = new Map(topicRows.map((topic) => [topic.id, topic.name]));

  const allQuestionKeys = wrongRows.map((row) => row.questionKey);
  const reviewRows = await db.select({
    questionKey: questionReviews.questionKey,
    editedExplanation: questionReviews.editedExplanation,
    reviewedAt: questionReviews.reviewedAt,
    reviewedByName: users.name,
  })
    .from(questionReviews)
    .innerJoin(users, eq(users.id, questionReviews.reviewedByUserId))
    .where(inArray(questionReviews.questionKey, allQuestionKeys));
  const reviewByKey = new Map(reviewRows.map((row) => [row.questionKey, row]));

  const wrongByTopic = new Map<string, typeof wrongRows>();
  for (const row of wrongRows) {
    const list = wrongByTopic.get(row.topicId) ?? [];
    list.push(row);
    wrongByTopic.set(row.topicId, list);
  }

  const reviewTopics: ReviewTopic[] = [];
  for (const [topicId, rows] of wrongByTopic.entries()) {
    const topicName = topicNameById.get(topicId);
    if (!topicName) continue;

    const keyedQuestions = await getQuestionsForTopic(topicId);
    if (keyedQuestions.length === 0) continue;
    const questionByKey = new Map(keyedQuestions.map((question) => [question.questionKey, question]));

    const questions: ReviewQuestion[] = [];
    for (const row of rows) {
      const question = questionByKey.get(row.questionKey);
      if (!question) continue;
      const review = reviewByKey.get(row.questionKey);
      questions.push({
        questionKey: row.questionKey,
        questionText: question.text,
        correctAnswer: question.correctAnswer,
        aiGeneratedExplanation: question.explanation,
        teacherEditedExplanation: review?.editedExplanation ?? null,
        reviewedByName: review?.reviewedByName ?? null,
        reviewedAt: review?.reviewedAt ?? null,
        studentsWrong: row.studentsWrong,
      });
    }
    if (questions.length > 0) reviewTopics.push({ topicId, topicName, questions });
  }

  return { subject: subjectRow, topics: reviewTopics };
}

export async function saveQuestionReview(
  teacherUserId: string,
  questionKey: string,
  explanation: string,
): Promise<void> {
  await loadTeacherActor(teacherUserId); // throws TEACHER_ONLY for non-teaching roles

  const question = await getQuestionByKey(questionKey);
  if (!question) throw new ApiError(400, 'INVALID_QUESTION_KEY', 'This question was not found.');

  await db.insert(questionReviews).values({
    questionKey,
    editedExplanation: explanation,
    reviewedByUserId: teacherUserId,
    reviewedAt: new Date(),
  }).onConflictDoUpdate({
    target: questionReviews.questionKey,
    set: { editedExplanation: explanation, reviewedByUserId: teacherUserId, reviewedAt: new Date() },
  });
}
