import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QuizRoomService } from "../services/quiz-room-service";
import type { QuizRoom } from "../models/quiz-room-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all QuizRoom records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, roomID, createdAt, currentQuestionIndex, hostUserID, questionSetID, questionStartedAt, roundNumber, statusKey, subject, topic, totalRounds
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useQuizRoomList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["quizRoom-list", options],
    queryFn: () => QuizRoomService.getAll(options),
  });
}

/**
 * Retrieve a single QuizRoom record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useQuizRoom(id: string) {
  return useQuery({
    queryKey: ["quizRoom", id],
    queryFn: () => QuizRoomService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new QuizRoom record.
 * @remarks Form validation: use CreateQuizRoomSchema with zodResolver for type-safe create forms
 */
export function useCreateQuizRoom() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<QuizRoom, "id">) => QuizRoomService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["quizRoom-list"] });
    },
  });
}

/**
 * Update an existing QuizRoom record.
 * @remarks Form validation: use UpdateQuizRoomSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateQuizRoom() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<QuizRoom, "id">>;
    }) => QuizRoomService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["quizRoom-list"] });
      client.invalidateQueries({ queryKey: ["quizRoom", variables.id] });
    },
  });
}

/**
 * Delete a QuizRoom record by its unique identifier.
 */
export function useDeleteQuizRoom() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => QuizRoomService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["quizRoom-list"] });
      client.invalidateQueries({ queryKey: ["quizRoom", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const QuizRoom_DATA_SOURCE_TYPE = 'InMemory' as const;

export { QuizRoomSchema, CreateQuizRoomSchema, UpdateQuizRoomSchema } from "../validators/quiz-room-validator";
export type { QuizRoomInput, CreateQuizRoomInput, UpdateQuizRoomInput } from "../validators/quiz-room-validator";