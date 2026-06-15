import { describe, expect, it, vi } from 'vitest';
import type { UploadcareFile } from '../../../types/exported';
import { buildPluginApi } from './buildPluginApi';

function makePluginApi(entry: { setMultipleValues: ReturnType<typeof vi.fn> } | null) {
  const uploadCollection = { read: vi.fn(() => entry) };
  // biome-ignore lint/suspicious/noExplicitAny: minimal mocks — files.replace only touches uploadCollection.
  const sharedInstancesBag = { uploadCollection } as any;
  // biome-ignore lint/suspicious/noExplicitAny: registry/ctx are unused by files.replace.
  const api = buildPluginApi({} as any, {} as any, sharedInstancesBag, 'p', []);
  return { api, uploadCollection };
}

const sampleFile = {
  uuid: 'new-uuid',
  cdnUrl: 'https://cdn.example.com/new-uuid/',
  originalFilename: 'edited.png',
  size: 4242,
  isImage: true,
  mimeType: 'image/png',
  contentInfo: { mime: { mime: 'image/png' } },
} as unknown as UploadcareFile;

describe('buildPluginApi — files.replace', () => {
  it('swaps the file in place: uuid-derived fields from the file, stale state reset, marked as replacement', () => {
    const setMultipleValues = vi.fn();
    const { api } = makePluginApi({ setMultipleValues });

    api.files.replace('entry-1', sampleFile);

    expect(setMultipleValues).toHaveBeenCalledOnce();
    expect(setMultipleValues.mock.calls[0]![0]).toMatchObject({
      // derived from the new file
      fileInfo: sampleFile,
      uuid: 'new-uuid',
      cdnUrl: 'https://cdn.example.com/new-uuid/',
      fileName: 'edited.png',
      fileSize: 4242,
      isImage: true,
      mimeType: 'image/png',
      uploadProgress: 100,
      // stale state reset
      cdnUrlModifiers: '',
      file: null,
      errors: [],
      uploadError: null,
      isUploading: false,
      // observer signal
      isReplacement: true,
    });
  });

  it('no-ops when the entry does not exist', () => {
    const { api, uploadCollection } = makePluginApi(null);
    expect(() => api.files.replace('missing', sampleFile)).not.toThrow();
    expect(uploadCollection.read).toHaveBeenCalledWith('missing');
  });
});
