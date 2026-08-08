import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConceptWebService } from "../services/concept-web-service";
import type { ConceptWeb } from "../models/concept-web-model";
import type { IOperationOptions } from '../../app-gen-sdk/data/common/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieve all ConceptWeb records with optional filtering and sorting.
 * @param options Optional filtering and sorting options
 *   Available properties for sorting: id, title, description, imageurl, subject
 *   Filtering supports OData syntax, e.g., "status eq 'active'"
 */
export function useConceptWebList(options?: IOperationOptions) {
  return useQuery({
    queryKey: ["conceptWeb-list", options],
    queryFn: () => ConceptWebService.getAll(options),
  });
}

/**
 * Retrieve a single ConceptWeb record by its unique identifier.
 * @param id The id of the record (must be a valid UUID)
 */
export function useConceptWeb(id: string) {
  return useQuery({
    queryKey: ["conceptWeb", id],
    queryFn: () => ConceptWebService.get(id),
    enabled: !!id && UUID_REGEX.test(id),
  });
}

/**
 * Create a new ConceptWeb record.
 * @remarks Form validation: use CreateConceptWebSchema with zodResolver for type-safe create forms
 */
export function useCreateConceptWeb() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<ConceptWeb, "id">) => ConceptWebService.create(data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["conceptWeb-list"] });
    },
  });
}

/**
 * Update an existing ConceptWeb record.
 * @remarks Form validation: use UpdateConceptWebSchema.partial().omit({ id: true }) with zodResolver for edit forms (matches changedFields input)
 */
export function useUpdateConceptWeb() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      changedFields,
    }: {
      id: string;
      changedFields: Partial<Omit<ConceptWeb, "id">>;
    }) => ConceptWebService.update(id, changedFields),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: ["conceptWeb-list"] });
      client.invalidateQueries({ queryKey: ["conceptWeb", variables.id] });
    },
  });
}

/**
 * Delete a ConceptWeb record by its unique identifier.
 */
export function useDeleteConceptWeb() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ConceptWebService.delete(id),
    onSuccess: (_data, id) => {
      client.invalidateQueries({ queryKey: ["conceptWeb-list"] });
      client.invalidateQueries({ queryKey: ["conceptWeb", id] });
    },
  });
}

/** Data source type for this table — drives InMemoryDataBanner visibility. */
export const ConceptWeb_DATA_SOURCE_TYPE = 'Dataverse' as const;

export { ConceptWebSchema, CreateConceptWebSchema, UpdateConceptWebSchema } from "../validators/concept-web-validator";
export type { ConceptWebInput, CreateConceptWebInput, UpdateConceptWebInput } from "../validators/concept-web-validator";
