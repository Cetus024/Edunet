import { getClient } from '../../../app-gen-sdk/data';
import type { QuizHistory } from '../models/quiz-history-model';
import type { IOperationOptions } from '../../../app-gen-sdk/data/common/types';

const DATA_SOURCE_NAME = 'QuizHistory';

export class QuizHistoryService {
  static async create(record: Omit<QuizHistory, 'id'>): Promise<QuizHistory> {
    const result = await getClient().createRecordAsync(DATA_SOURCE_NAME, record);
    if (!result.success) throw result.error;
    return result.data as QuizHistory;
  }

  static async update(
    id: string,
    changedFields: Partial<Omit<QuizHistory, 'id'>>
  ): Promise<QuizHistory> {
    const result = await getClient().updateRecordAsync(DATA_SOURCE_NAME, id, changedFields);
    if (!result.success) throw result.error;
    return result.data as QuizHistory;
  }

  static async delete(id: string): Promise<void> {
    const result = await getClient().deleteRecordAsync(DATA_SOURCE_NAME, id);
    if (!result.success) throw result.error;
  }

  static async get(id: string): Promise<QuizHistory> {
    const result = await getClient().retrieveRecordAsync(DATA_SOURCE_NAME, id);
    if (!result.success) throw result.error;
    return result.data as QuizHistory;
  }

  static async getAll(options?: IOperationOptions): Promise<QuizHistory[]> {
    const result = await getClient().retrieveMultipleRecordsAsync(DATA_SOURCE_NAME, options);
    if (!result.success) throw result.error;
    return result.data as QuizHistory[];
  }
}