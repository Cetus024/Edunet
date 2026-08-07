import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopicMisconceptionService } from "../services/topic-misconception-service";
import type { TopicMisconception } from "../models/topic-misconception-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all TopicMisconception records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, misconceptionName, exampleWrongAnswers, misconceptionText, percentOfWrongAnswers, rank, studentCount
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useTopicMisconceptionList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["topicMisconception-list", options],
    queryFn: () => TopicMisconceptionService.getAll(options),
  });
}

/**
 * Retrieve a single TopicMisconception record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useTopicMisconception(id: string) {
  return useQuery({
    queryKey: ["topicMisconception", id],
    queryFn: () => TopicMisconceptionService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new TopicMisconception record.
 * @remarks Form validation: use CreateTopicMisconceptionSchema with zodResolver for type-safe create forms
 */
export function useCreateTopicMisconception() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<TopicMisconception, "id">) => TopicMisconceptionService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["topicMisconception-list"] });
    },
  });
}

/**
 * Update an existing TopicMisconception record.
 * @remarks Form validation: use UpdateTopicMisconceptionSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateTopicMisconception() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<TopicMisconception, "id">>;
    }) => TopicMisconceptionService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["topicMisconception-list"] });
      client.invalidateQueries({ queryKey: ["topicMisconception", variables.id] });
    },
  });
}

/**
 * Delete a TopicMisconception record by its unique identifier.
 */
export function useDeleteTopicMisconception() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => TopicMisconceptionService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["topicMisconception-list"] });
      client.invalidateQueries({ queryKey: ["topicMisconception", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const TopicMisconception_DATA_SOURCE_TYPE = 'InMemory' as const;

export { TopicMisconceptionSchema, CreateTopicMisconceptionSchema, UpdateTopicMisconceptionSchema } from "../validators/topic-misconception-validator";
export type { TopicMisconceptionInput, CreateTopicMisconceptionInput, UpdateTopicMisconceptionInput } from "../validators/topic-misconception-validator";