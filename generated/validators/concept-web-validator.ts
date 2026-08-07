import { z } from 'zod';

/**
 * Zod schema for ConceptWeb validation
 */
export const ConceptWebSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  imageurl: z.string().optional(),
  subject: z.string().optional(),
  teachername: z.object({ id: z.string().uuid(), fullname: z.string() }).optional(),
});

/**
 * Schema for creating a new ConceptWeb (omits system-generated ID)
 */
export const CreateConceptWebSchema = ConceptWebSchema.omit({ id: true });

/**
 * Schema for updating an existing ConceptWeb
 */
export const UpdateConceptWebSchema = ConceptWebSchema;

export type ConceptWebInput = z.infer<typeof ConceptWebSchema>;
export type CreateConceptWebInput = z.infer<typeof CreateConceptWebSchema>;
export type UpdateConceptWebInput = z.infer<typeof UpdateConceptWebSchema>;