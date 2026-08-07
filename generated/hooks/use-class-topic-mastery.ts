import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClassTopicMasteryService } from "../services/class-topic-mastery-service";
import type { ClassTopicMastery } from "../models/class-topic-mastery-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all ClassTopicMastery records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, topicName, classID, masteryStatusKey, percentBelowMastery, questionsAttempted, studentsBelowMastery, subject, suggestedAction, topicID
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useClassTopicMasteryList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["classTopicMastery-list", options],
    queryFn: () => ClassTopicMasteryService.getAll(options),
  });
}

/**
 * Retrieve a single ClassTopicMastery record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useClassTopicMastery(id: string) {
  return useQuery({
    queryKey: ["classTopicMastery", id],
    queryFn: () => ClassTopicMasteryService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new ClassTopicMastery record.
 * @remarks Form validation: use CreateClassTopicMasterySchema with zodResolver for type-safe create forms
 */
export function useCreateClassTopicMastery() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ClassTopicMastery, "id">) => ClassTopicMasteryService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["classTopicMastery-list"] });
    },
  });
}

/**
 * Update an existing ClassTopicMastery record.
 * @remarks Form validation: use UpdateClassTopicMasterySchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateClassTopicMastery() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<ClassTopicMastery, "id">>;
    }) => ClassTopicMasteryService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["classTopicMastery-list"] });
      client.invalidateQueries({ queryKey: ["classTopicMastery", variables.id] });
    },
  });
}

/**
 * Delete a ClassTopicMastery record by its unique identifier.
 */
export function useDeleteClassTopicMastery() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ClassTopicMasteryService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["classTopicMastery-list"] });
      client.invalidateQueries({ queryKey: ["classTopicMastery", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const ClassTopicMastery_DATA_SOURCE_TYPE = 'InMemory' as const;

export { ClassTopicMasterySchema, CreateClassTopicMasterySchema, UpdateClassTopicMasterySchema } from "../validators/class-topic-mastery-validator";
export type { ClassTopicMasteryInput, CreateClassTopicMasteryInput, UpdateClassTopicMasteryInput } from "../validators/class-topic-mastery-validator";