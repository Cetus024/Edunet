import { z } from 'zod';

/**
 * Zod schema for QuizQuestion validation
 */
export const QuizQuestionSchema = z.object({
  id: z.string().uuid(),
  quizquestionname: z.string().min(1, { message: "Quiz Question Name is required" }),
  difficultylevelKey: z.enum(['DifficultylevelKey0', 'DifficultylevelKey1', 'DifficultylevelKey2']).optional(),
  questiontext: z.string().min(1, { message: "Question Text is required" }),
  subject: z.string().optional(),
  teachername: z.object({ id: z.string().uuid(), fullname: z.string() }).optional(),
  topic: z.string().optional(),
});

/**
 * Schema for creating a new QuizQuestion (omits system-generated ID)
 */
export const CreateQuizQuestionSchema = QuizQuestionSchema.omit({ id: true });

/**
 * Schema for updating an existing QuizQuestion
 */
export const UpdateQuizQuestionSchema = QuizQuestionSchema;

export type QuizQuestionInput = z.infer<typeof QuizQuestionSchema>;
export type CreateQuizQuestionInput = z.infer<typeof CreateQuizQuestionSchema>;
export type UpdateQuizQuestionInput = z.infer<typeof UpdateQuizQuestionSchema>;