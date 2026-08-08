import { getClient } from '../../app-gen-sdk/data';
import type { NoteCapture } from '../models/note-capture-model';
import type { IOperationOptions } from '../../app-gen-sdk/data/common/types';

const DATA_SOURCE_NAME = 'NoteCapture';

export class NoteCaptureService {
  static async create(record: Omit<NoteCapture, 'id'>): Promise<NoteCapture> {
    const result = await getClient().createRecordAsync(DATA_SOURCE_NAME, record);
    if (!result.success) throw result.error;
    return result.data as NoteCapture;
  }

  static async update(
    id: string,
    changedFields: Partial<Omit<NoteCapture, 'id'>>
  ): Promise<NoteCapture> {
    const result = await getClient().updateRecordAsync(DATA_SOURCE_NAME, id, changedFields);
    if (!result.success) throw result.error;
    return result.data as NoteCapture;
  }

  static async delete(id: string): Promise<void> {
    const result = await getClient().deleteRecordAsync(DATA_SOURCE_NAME, id);
    if (!result.success) throw result.error;
  }

  static async get(id: string): Promise<NoteCapture> {
    const result = await getClient().retrieveRecordAsync(DATA_SOURCE_NAME, id);
    if (!result.success) throw result.error;
    return result.data as NoteCapture;
  }

  static async getAll(options?: IOperationOptions): Promise<NoteCapture[]> {
    const result = await getClient().retrieveMultipleRecordsAsync(DATA_SOURCE_NAME, options);
    if (!result.success) throw result.error;
    return result.data as NoteCapture[];
  }
}
