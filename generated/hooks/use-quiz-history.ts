import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QuizHistoryService } from "../services/quiz-history-service";
import type { QuizHistory } from "../models/quiz-history-model";
import type { IOperationOptions } from '../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all QuizHistory records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, quizname, datetaken, scorepercentage
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useQuizHistoryList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["quizHistory-list", options],
    queryFn: () => QuizHistoryService.getAll(options),
  });
}

/**
 * Retrieve a single QuizHistory record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useQuizHistory(id: string) {
  return useQuery({
    queryKey: ["quizHistory", id],
    queryFn: () => QuizHistoryService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new QuizHistory record.
 * @remarks Form validation: use CreateQuizHistorySchema with zodResolver for type-safe create forms
 */
export function useCreateQuizHistory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<QuizHistory, "id">) => QuizHistoryService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["quizHistory-list"] });
    },
  });
}

/**
 * Update an existing QuizHistory record.
 * @remarks Form validation: use UpdateQuizHistorySchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateQuizHistory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<QuizHistory, "id">>;
    }) => QuizHistoryService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["quizHistory-list"] });
      client.invalidateQueries({ queryKey: ["quizHistory", variables.id] });
    },
  });
}

/**
 * Delete a QuizHistory record by its unique identifier.
 */
export function useDeleteQuizHistory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => QuizHistoryService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["quizHistory-list"] });
      client.invalidateQueries({ queryKey: ["quizHistory", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const QuizHistory_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { QuizHistorySchema, CreateQuizHistorySchema, UpdateQuizHistorySchema } from "../validators/quiz-history-validator";
export type { QuizHistoryInput, CreateQuizHistoryInput, UpdateQuizHistoryInput } from "../validators/quiz-history-validator";
