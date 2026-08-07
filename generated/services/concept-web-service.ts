import { getClient } from '../../../app-gen-sdk/data';
import type { ConceptWeb } from '../models/concept-web-model';
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const DATA_SOURCE_NAME = 'ConceptWeb';

export class ConceptWebService {
  static async create(record: Omit<ConceptWeb, 'id'>): Promise<ConceptWeb> {
    const result = await getClient().createRecordAsync(DATA_SOURCE_NAME, record);
    if (!result.success) throw result.error;
    return result.data as ConceptWeb;
  }

  static async update(
    id: string,
    changedFields: Partial<Omit<ConceptWeb, 'id'>>
  ): Promise<ConceptWeb> {
    const result = await getClient().updateRecordAsync(DATA_SOURCE_NAME, id, changedFields);
    if (!result.success) throw result.error;
    return result.data as ConceptWeb;
  }

  static async delete(id: string): Promise<void> {
    const result = await getClient().deleteRecordAsync(DATA_SOURCE_NAME, id);
    if (!result.success) throw result.error;
  }

  static async get(id: string): Promise<ConceptWeb> {
    const result = await getClient().retrieveRecordAsync(DATA_SOURCE_NAME, id);
    if (!result.success) throw result.error;
    return result.data as ConceptWeb;
  }

  static async getAll(options?: IOperationOptions): Promise<ConceptWeb[]> {
    const result = await getClient().retrieveMultipleRecordsAsync(DATA_SOURCE_NAME, options);
    if (!result.success) throw result.error;
    return result.data as ConceptWeb[];
  }
}