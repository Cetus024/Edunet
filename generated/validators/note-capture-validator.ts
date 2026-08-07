import { z } from 'zod';

/**
 * Zod schema for NoteCapture validation
 */
export const NoteCaptureSchema = z.object({
  id: z.string().uuid(),
  notetitle: z.string().min(1, { message: "Note Title is required" }),
  content: z.string().optional(),
  datecreated: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "DateTime must be in ISO format").optional(),
  studentname: z.object({ id: z.string().uuid(), firstname: z.string() }).optional(),
});

/**
 * Schema for creating a new NoteCapture (omits system-generated ID)
 */
export const CreateNoteCaptureSchema = NoteCaptureSchema.omit({ id: true });

/**
 * Schema for updating an existing NoteCapture
 */
export const UpdateNoteCaptureSchema = NoteCaptureSchema;

export type NoteCaptureInput = z.infer<typeof NoteCaptureSchema>;
export type CreateNoteCaptureInput = z.infer<typeof CreateNoteCaptureSchema>;
export type UpdateNoteCaptureInput = z.infer<typeof UpdateNoteCaptureSchema>;