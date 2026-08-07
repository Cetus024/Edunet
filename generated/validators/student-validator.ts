import { z } from 'zod';

/**
 * Zod schema for Student validation
 */
export const StudentSchema = z.object({
  id: z.string().uuid(),
  firstname: z.string().min(1, { message: "First Name is required" }),
  avatarurl: z.string().optional(),
  email: z.string().email().optional(),
  lastname: z.string().min(1, { message: "Last Name is required" }),
  studypreferences: z.string().optional(),
});

/**
 * Schema for creating a new Student (omits system-generated ID)
 */
export const CreateStudentSchema = StudentSchema.omit({ id: true });

/**
 * Schema for updating an existing Student
 */
export const UpdateStudentSchema = StudentSchema;

export type StudentInput = z.infer<typeof StudentSchema>;
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;