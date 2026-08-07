import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QuizRoomParticipantService } from "../services/quiz-room-participant-service";
import type { QuizRoomParticipant } from "../models/quiz-room-participant-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all QuizRoomParticipant records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, displayName, avatarColorKey, joinedAt, lastAnswerCorrect, score, userID
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useQuizRoomParticipantList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["quizRoomParticipant-list", options],
    queryFn: () => QuizRoomParticipantService.getAll(options),
  });
}

/**
 * Retrieve a single QuizRoomParticipant record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useQuizRoomParticipant(id: string) {
  return useQuery({
    queryKey: ["quizRoomParticipant", id],
    queryFn: () => QuizRoomParticipantService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new QuizRoomParticipant record.
 * @remarks Form validation: use CreateQuizRoomParticipantSchema with zodResolver for type-safe create forms
 */
export function useCreateQuizRoomParticipant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<QuizRoomParticipant, "id">) => QuizRoomParticipantService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["quizRoomParticipant-list"] });
    },
  });
}

/**
 * Update an existing QuizRoomParticipant record.
 * @remarks Form validation: use UpdateQuizRoomParticipantSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateQuizRoomParticipant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<QuizRoomParticipant, "id">>;
    }) => QuizRoomParticipantService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["quizRoomParticipant-list"] });
      client.invalidateQueries({ queryKey: ["quizRoomParticipant", variables.id] });
    },
  });
}

/**
 * Delete a QuizRoomParticipant record by its unique identifier.
 */
export function useDeleteQuizRoomParticipant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => QuizRoomParticipantService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["quizRoomParticipant-list"] });
      client.invalidateQueries({ queryKey: ["quizRoomParticipant", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const QuizRoomParticipant_DATA_SOURCE_TYPE = 'InMemory' as const;

export { QuizRoomParticipantSchema, CreateQuizRoomParticipantSchema, UpdateQuizRoomParticipantSchema } from "../validators/quiz-room-participant-validator";
export type { QuizRoomParticipantInput, CreateQuizRoomParticipantInput, UpdateQuizRoomParticipantInput } from "../validators/quiz-room-participant-validator";