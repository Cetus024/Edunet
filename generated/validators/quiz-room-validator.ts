import { z } from 'zod';

/**
 * Zod schema for QuizRoom validation
 */
export const QuizRoomSchema = z.object({
  id: z.string().uuid(),
  roomID: z.string().min(1, { message: "Room ID is required" }),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "DateTime must be in ISO format").min(1, { message: "Created At is required" }),
  currentQuestionIndex: z.number().int(),
  hostUserID: z.string().min(1, { message: "Host User ID is required" }),
  questionSetID: z.string().min(1, { message: "Question Set ID is required" }),
  questionStartedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "DateTime must be in ISO format").min(1, { message: "Question Started At is required" }),
  roundNumber: z.number().int(),
  statusKey: z.enum(['StatusKey0', 'StatusKey1']),
  subject: z.string().min(1, { message: "Subject is required" }),
  topic: z.string().min(1, { message: "Topic is required" }),
  totalRounds: z.number().int(),
});

/**
 * Schema for creating a new QuizRoom (omits system-generated ID)
 */
export const CreateQuizRoomSchema = QuizRoomSchema.omit({ id: true });

/**
 * Schema for updating an existing QuizRoom
 */
export const UpdateQuizRoomSchema = QuizRoomSchema;

export type QuizRoomInput = z.infer<typeof QuizRoomSchema>;
export type CreateQuizRoomInput = z.infer<typeof CreateQuizRoomSchema>;
export type UpdateQuizRoomInput = z.infer<typeof UpdateQuizRoomSchema>;