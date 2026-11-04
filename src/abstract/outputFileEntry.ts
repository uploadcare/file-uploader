import type { OutputFileEntry, OutputFileStatus, UploadcareFile } from '../types/index';
import { UploadCollectionController } from './controllers/UploadCollectionController';
import { deriveEntryStatus } from './deriveEntryStatus';
import type { ControllerContainer } from './di/ControllerContainer';
import type { TypedData } from './TypedData';
import type { UploadEntryData } from './uploadEntrySchema';

/** The documented `OutputFileEntry` for an upload entry: what events, `getOutputItem` and the collection state hand out. */
export const toOutputFileEntry = <TStatus extends OutputFileStatus>(
  entry: TypedData<UploadEntryData>,
): OutputFileEntry<TStatus> => {
  const uploadEntryData = entry.values;
  const fileInfo = uploadEntryData.fileInfo as UploadcareFile | null;

  // Shared status ladder (single source with UploadList's toolbar counts).
  const status = deriveEntryStatus(uploadEntryData);

  const outputItem = {
    uuid: fileInfo?.uuid ?? uploadEntryData.uuid ?? null,
    internalId: entry.uid as string,
    // An explicit entry `fileName` (e.g. a caller-supplied name on add/replace)
    // wins over the uploaded file's own name; otherwise fall back to it.
    name: uploadEntryData.fileName ?? fileInfo?.originalFilename ?? null,
    size: fileInfo?.size ?? uploadEntryData.fileSize,
    isImage: fileInfo?.isImage ?? uploadEntryData.isImage,
    mimeType: fileInfo?.mimeType ?? uploadEntryData.mimeType,
    file: uploadEntryData.file,
    externalUrl: uploadEntryData.externalUrl,
    cdnUrlModifiers: uploadEntryData.cdnUrlModifiers,
    cdnUrl: uploadEntryData.cdnUrl ?? fileInfo?.cdnUrl ?? null,
    fullPath: uploadEntryData.fullPath,
    uploadProgress: uploadEntryData.uploadProgress,
    fileInfo: fileInfo ?? null,
    metadata: uploadEntryData.metadata ?? fileInfo?.metadata ?? null,
    tags: uploadEntryData.tags ?? fileInfo?.tags ?? null,
    isSuccess: status === 'success',
    isUploading: status === 'uploading',
    isFailed: status === 'failed',
    isRemoved: status === 'removed',
    isValidationPending: uploadEntryData.isValidationPending,
    errors: uploadEntryData.errors as OutputFileEntry['errors'],
    status,
    source: uploadEntryData?.source,
  };

  return outputItem as OutputFileEntry<TStatus>;
};

/** Every entry of the ctx's collection as an `OutputFileEntry`, in collection order. */
export const outputEntries = (container: ControllerContainer): OutputFileEntry[] => {
  const collection = container.get(UploadCollectionController);
  return collection.items().flatMap((id) => {
    const entry = collection.read(id);
    return entry ? [toOutputFileEntry(entry)] : [];
  });
};
