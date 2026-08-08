import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QuizQuestionService } from "../services/quiz-question-service";
import type { QuizQuestion } from "../models/quiz-question-model";
import type { IOperationOptions } from '../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all QuizQuestion records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, quizquestionname, difficultylevelKey, questiontext, subject, topic
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useQuizQuestionList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["quizQuestion-list", options],
    queryFn: () => QuizQuestionService.getAll(options),
  });
}

/**
 * Retrieve a single QuizQuestion record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useQuizQuestion(id: string) {
  return useQuery({
    queryKey: ["quizQuestion", id],
    queryFn: () => QuizQuestionService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new QuizQuestion record.
 * @remarks Form validation: use CreateQuizQuestionSchema with zodResolver for type-safe create forms
 */
export function useCreateQuizQuestion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<QuizQuestion, "id">) => QuizQuestionService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["quizQuestion-list"] });
    },
  });
}

/**
 * Update an existing QuizQuestion record.
 * @remarks Form validation: use UpdateQuizQuestionSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateQuizQuestion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<QuizQuestion, "id">>;
    }) => QuizQuestionService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["quizQuestion-list"] });
      client.invalidateQueries({ queryKey: ["quizQuestion", variables.id] });
    },
  });
}

/**
 * Delete a QuizQuestion record by its unique identifier.
 */
export function useDeleteQuizQuestion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => QuizQuestionService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["quizQuestion-list"] });
      client.invalidateQueries({ queryKey: ["quizQuestion", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const QuizQuestion_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { QuizQuestionSchema, CreateQuizQuestionSchema, UpdateQuizQuestionSchema } from "../validators/quiz-question-validator";
export type { QuizQuestionInput, CreateQuizQuestionInput, UpdateQuizQuestionInput } from "../validators/quiz-question-validator";
