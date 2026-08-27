import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import { ControllerContainer } from '../abstract/di/ControllerContainer';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { getOutputData } from './getOutputData';

/**
 * Tests for getOutputData — the flat output-entry list feeding
 * `getOutputCollectionState().allEntries` and the upload-events host bridge.
 */
describe('getOutputData', () => {
  let container: ControllerContainer;
  let collection: UploadCollectionController;
  let _api: UploaderPublicApi;

  beforeEach(() => {
    container = new ControllerContainer();
    collection = container.get(UploadCollectionController);
    _api = container.get(UploaderPublicApi);
  });

  afterEach(() => {
    container.dispose();
    vi.restoreAllMocks();
  });

  it('returns an empty array when the collection is empty', () => {
    const data = getOutputData(container);
    expect(data).toEqual([]);
    expect(Array.isArray(data)).toBe(true);
  });

  it('returns output entries mapped through the public API for each item in the collection', () => {
    const id1 = collection.add({});
    const id2 = collection.add({});

    const data = getOutputData(container);

    expect(data).toHaveLength(2);
    expect(data[0]!.internalId).toBe(id1);
    expect(data[1]!.internalId).toBe(id2);
  });

  it('preserves file metadata from getOutputItem', () => {
    const uuid = 'test-uuid-123';
    const fileName = 'document.pdf';
    const fileSize = 5242880;

    collection.add({
      uuid,
      fileName,
      fileSize,
      mimeType: 'application/pdf',
      isImage: false,
    });

    const [entry] = getOutputData(container);

    expect(entry!.uuid).toBe(uuid);
    expect(entry!.name).toBe(fileName);
    expect(entry!.size).toBe(fileSize);
    expect(entry!.mimeType).toBe('application/pdf');
    expect(entry!.isImage).toBe(false);
  });

  it('handles entries with null file metadata gracefully', () => {
    collection.add({ fileSize: 1024, mimeType: 'text/plain', isImage: false });

    const [entry] = getOutputData(container);

    expect(entry!.uuid).toBeNull();
    expect(entry!.name).toBeNull();
    expect(entry!.cdnUrl).toBeNull();
    expect(entry!.fileInfo).toBeNull();
  });

  it('maintains insertion order of entries', () => {
    const ids = [collection.add({ uuid: 'a' }), collection.add({ uuid: 'b' }), collection.add({ uuid: 'c' })];

    const data = getOutputData(container);

    expect(data.map((e) => e.internalId)).toEqual(ids);
  });

  it('includes status derived from entry fields', () => {
    collection.add({ isUploading: true }); // uploading
    collection.add({ fileInfo: { uuid: 'done' } as never }); // success

    const data = getOutputData(container);

    expect(data[0]!.status).toBe('uploading');
    expect(data[1]!.status).toBe('success');
  });
});
