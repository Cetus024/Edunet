import { z } from 'zod';

/**
 * Zod schema for ClassTopicMastery validation
 */
export const ClassTopicMasterySchema = z.object({
  id: z.string().uuid(),
  topicName: z.string().min(1, { message: "Topic Name is required" }),
  classID: z.string().min(1, { message: "Class ID is required" }),
  masteryStatusKey: z.enum(['MasteryStatusKey0', 'MasteryStatusKey1', 'MasteryStatusKey2']),
  percentBelowMastery: z.number(),
  questionsAttempted: z.number().int(),
  studentsBelowMastery: z.number().int(),
  subject: z.string().min(1, { message: "Subject is required" }),
  suggestedAction: z.string().optional(),
  topicID: z.string().min(1, { message: "Topic ID is required" }),
});

/**
 * Schema for creating a new ClassTopicMastery (omits system-generated ID)
 */
export const CreateClassTopicMasterySchema = ClassTopicMasterySchema.omit({ id: true });

/**
 * Schema for updating an existing ClassTopicMastery
 */
export const UpdateClassTopicMasterySchema = ClassTopicMasterySchema;

export type ClassTopicMasteryInput = z.infer<typeof ClassTopicMasterySchema>;
export type CreateClassTopicMasteryInput = z.infer<typeof CreateClassTopicMasterySchema>;
export type UpdateClassTopicMasteryInput = z.infer<typeof UpdateClassTopicMasterySchema>;