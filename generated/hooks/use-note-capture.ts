import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NoteCaptureService } from "../services/note-capture-service";
import type { NoteCapture } from "../models/note-capture-model";
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all NoteCapture records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, notetitle, content, datecreated
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useNoteCaptureList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["noteCapture-list", options],
    queryFn: () => NoteCaptureService.getAll(options),
  });
}

/**
 * Retrieve a single NoteCapture record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useNoteCapture(id: string) {
  return useQuery({
    queryKey: ["noteCapture", id],
    queryFn: () => NoteCaptureService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new NoteCapture record.
 * @remarks Form validation: use CreateNoteCaptureSchema with zodResolver for type-safe create forms
 */
export function useCreateNoteCapture() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<NoteCapture, "id">) => NoteCaptureService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["noteCapture-list"] });
    },
  });
}

/**
 * Update an existing NoteCapture record.
 * @remarks Form validation: use UpdateNoteCaptureSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateNoteCapture() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<NoteCapture, "id">>;
    }) => NoteCaptureService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["noteCapture-list"] });
      client.invalidateQueries({ queryKey: ["noteCapture", variables.id] });
    },
  });
}

/**
 * Delete a NoteCapture record by its unique identifier.
 */
export function useDeleteNoteCapture() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => NoteCaptureService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["noteCapture-list"] });
      client.invalidateQueries({ queryKey: ["noteCapture", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const NoteCapture_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { NoteCaptureSchema, CreateNoteCaptureSchema, UpdateNoteCaptureSchema } from "../validators/note-capture-validator";
export type { NoteCaptureInput, CreateNoteCaptureInput, UpdateNoteCaptureInput } from "../validators/note-capture-validator";