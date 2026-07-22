import type { OutputFileStatus } from '../types/exported';
import type { UploadEntryData } from './uploadEntrySchema';

/** The subset of entry fields the status ladder reads. */
export type EntryStatusFields = Pick<UploadEntryData, 'isRemoved' | 'errors' | 'fileInfo' | 'isUploading'>;

/**
 * Single source of the output-entry status ladder — used by
 * `UploaderPublicApi.getOutputItem` (which builds the full `OutputFileEntry`) AND
 * by UploadList's cheap toolbar-count pass, so the two can never drift.
 *
 * Precedence: removed > failed > success > uploading > idle.
 */
export function deriveEntryStatus(fields: EntryStatusFields): OutputFileStatus {
  if (fields.isRemoved) {
    return 'removed';
  }
  if (fields.errors.length > 0) {
    return 'failed';
  }
  if (fields.fileInfo) {
    return 'success';
  }
  if (fields.isUploading) {
    return 'uploading';
  }
  return 'idle';
}
