import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TeacherService } from "../services/teacher-service";
import type { Teacher } from "../models/teacher-model";
import type { IOperationOptions } from '../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all Teacher records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, fullname, email, phone
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useTeacherList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["teacher-list", options],
    queryFn: () => TeacherService.getAll(options),
  });
}

/**
 * Retrieve a single Teacher record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useTeacher(id: string) {
  return useQuery({
    queryKey: ["teacher", id],
    queryFn: () => TeacherService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new Teacher record.
 * @remarks Form validation: use CreateTeacherSchema with zodResolver for type-safe create forms
 */
export function useCreateTeacher() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Teacher, "id">) => TeacherService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["teacher-list"] });
    },
  });
}

/**
 * Update an existing Teacher record.
 * @remarks Form validation: use UpdateTeacherSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateTeacher() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<Teacher, "id">>;
    }) => TeacherService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["teacher-list"] });
      client.invalidateQueries({ queryKey: ["teacher", variables.id] });
    },
  });
}

/**
 * Delete a Teacher record by its unique identifier.
 */
export function useDeleteTeacher() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => TeacherService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["teacher-list"] });
      client.invalidateQueries({ queryKey: ["teacher", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const Teacher_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { TeacherSchema, CreateTeacherSchema, UpdateTeacherSchema } from "../validators/teacher-validator";
export type { TeacherInput, CreateTeacherInput, UpdateTeacherInput } from "../validators/teacher-validator";
