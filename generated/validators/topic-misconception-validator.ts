import { z } from 'zod';

/**
 * Zod schema for TopicMisconception validation
 */
export const TopicMisconceptionSchema = z.object({
  id: z.string().uuid(),
  misconceptionName: z.string().min(1, { message: "Misconception Name is required" }),
  exampleWrongAnswers: z.string().optional(),
  misconceptionText: z.string().min(1, { message: "Misconception Text is required" }),
  percentOfWrongAnswers: z.number(),
  rank: z.number().int(),
  studentCount: z.number().int(),
  topic: z.object({ id: z.string().uuid(), topicName: z.string() }),
});

/**
 * Schema for creating a new TopicMisconception (omits system-generated ID)
 */
export const CreateTopicMisconceptionSchema = TopicMisconceptionSchema.omit({ id: true });

/**
 * Schema for updating an existing TopicMisconception
 */
export const UpdateTopicMisconceptionSchema = TopicMisconceptionSchema;

export type TopicMisconceptionInput = z.infer<typeof TopicMisconceptionSchema>;
export type CreateTopicMisconceptionInput = z.infer<typeof CreateTopicMisconceptionSchema>;
export type UpdateTopicMisconceptionInput = z.infer<typeof UpdateTopicMisconceptionSchema>;