import { z } from 'zod';

/**
 * Zod schema for QuizHistory validation
 */
export const QuizHistorySchema = z.object({
  id: z.string().uuid(),
  quizname: z.string().min(1, { message: "Quiz Name is required" }),
  datetaken: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "DateTime must be in ISO format").optional(),
  scorepercentage: z.number().optional(),
  studentname: z.object({ id: z.string().uuid(), firstname: z.string() }).optional(),
  teachername: z.object({ id: z.string().uuid(), fullname: z.string() }).optional(),
});

/**
 * Schema for creating a new QuizHistory (omits system-generated ID)
 */
export const CreateQuizHistorySchema = QuizHistorySchema.omit({ id: true });

/**
 * Schema for updating an existing QuizHistory
 */
export const UpdateQuizHistorySchema = QuizHistorySchema;

export type QuizHistoryInput = z.infer<typeof QuizHistorySchema>;
export type CreateQuizHistoryInput = z.infer<typeof CreateQuizHistorySchema>;
export type UpdateQuizHistoryInput = z.infer<typeof UpdateQuizHistorySchema>;