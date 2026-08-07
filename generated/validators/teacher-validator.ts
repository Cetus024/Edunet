import { z } from 'zod';

/**
 * Zod schema for Teacher validation
 */
export const TeacherSchema = z.object({
  id: z.string().uuid(),
  fullname: z.string().min(1, { message: "Full Name is required" }),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

/**
 * Schema for creating a new Teacher (omits system-generated ID)
 */
export const CreateTeacherSchema = TeacherSchema.omit({ id: true });

/**
 * Schema for updating an existing Teacher
 */
export const UpdateTeacherSchema = TeacherSchema;

export type TeacherInput = z.infer<typeof TeacherSchema>;
export type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof UpdateTeacherSchema>;