import { z } from 'zod';

/**
 * Zod schema for QuizRoomParticipant validation
 */
export const QuizRoomParticipantSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1, { message: "Display Name is required" }),
  avatarColorKey: z.enum(['AvatarColorKey0', 'AvatarColorKey1', 'AvatarColorKey2']),
  joinedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "DateTime must be in ISO format").min(1, { message: "Joined At is required" }),
  lastAnswerCorrect: z.boolean(),
  roomID: z.object({ id: z.string().uuid(), roomID: z.string() }),
  score: z.number().int(),
  userID: z.string().min(1, { message: "User ID is required" }),
});

/**
 * Schema for creating a new QuizRoomParticipant (omits system-generated ID)
 */
export const CreateQuizRoomParticipantSchema = QuizRoomParticipantSchema.omit({ id: true });

/**
 * Schema for updating an existing QuizRoomParticipant
 */
export const UpdateQuizRoomParticipantSchema = QuizRoomParticipantSchema;

export type QuizRoomParticipantInput = z.infer<typeof QuizRoomParticipantSchema>;
export type CreateQuizRoomParticipantInput = z.infer<typeof CreateQuizRoomParticipantSchema>;
export type UpdateQuizRoomParticipantInput = z.infer<typeof UpdateQuizRoomParticipantSchema>;