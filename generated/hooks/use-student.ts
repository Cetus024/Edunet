import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StudentService } from "../services/student-service";
import type { Student } from "../models/student-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';
import { hasPowerAppsHost } from '../../../app-gen-sdk/constants';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all Student records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, firstname, avatarurl, email, lastname, studypreferences
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useStudentList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["student-list", options],
    queryFn: () => StudentService.getAll(options),
    enabled: hasPowerAppsHost(),
  });
}

/**
 * Retrieve a single Student record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useStudent(id: string) {
  return useQuery({
    queryKey: ["student", id],
    queryFn: () => StudentService.get(id),
    enabled: hasPowerAppsHost() && !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new Student record.
 * @remarks Form validation: use CreateStudentSchema with zodResolver for type-safe create forms
 */
export function useCreateStudent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Student, "id">) => StudentService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["student-list"] });
    },
  });
}

/**
 * Update an existing Student record.
 * @remarks Form validation: use UpdateStudentSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateStudent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<Student, "id">>;
    }) => StudentService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["student-list"] });
      client.invalidateQueries({ queryKey: ["student", variables.id] });
    },
  });
}

/**
 * Delete a Student record by its unique identifier.
 */
export function useDeleteStudent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => StudentService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["student-list"] });
      client.invalidateQueries({ queryKey: ["student", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const Student_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { StudentSchema, CreateStudentSchema, UpdateStudentSchema } from "../validators/student-validator";
export type { StudentInput, CreateStudentInput, UpdateStudentInput } from "../validators/student-validator";
