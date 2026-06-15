import { describe, expect, it, vi } from 'vitest';
import type { UploadcareFile } from '../../../types/exported';
import { buildPluginApi } from './buildPluginApi';

type EntryMock = {
  setMultipleValues: ReturnType<typeof vi.fn>;
  getValue: ReturnType<typeof vi.fn>;
};

function makeEntry(values: Record<string, unknown> = {}): EntryMock {
  return {
    setMultipleValues: vi.fn(),
    getValue: vi.fn((key: string) => values[key] ?? null),
  };
}

function makePluginApi(entry: EntryMock | null) {
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
    const entry = makeEntry();
    const { api } = makePluginApi(entry);

    api.files.replace('entry-1', sampleFile);

    expect(entry.setMultipleValues).toHaveBeenCalledOnce();
    expect(entry.setMultipleValues.mock.calls[0]![0]).toMatchObject({
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
    });
  });

  it('aborts the in-flight upload and revokes a blob thumbnail before resetting', () => {
    const abort = vi.fn();
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const entry = makeEntry({ abortController: { abort }, thumbUrl: 'blob:http://x/abc' });
    const { api } = makePluginApi(entry);

    api.files.replace('entry-1', sampleFile);

    expect(abort).toHaveBeenCalledOnce();
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://x/abc');
    revokeSpy.mockRestore();
  });

  it('does not revoke a non-blob (CDN) thumbnail', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const entry = makeEntry({ thumbUrl: 'https://cdn.example.com/abc/-/preview/' });
    const { api } = makePluginApi(entry);

    api.files.replace('entry-1', sampleFile);

    expect(revokeSpy).not.toHaveBeenCalled();
    revokeSpy.mockRestore();
  });

  it('no-ops when the entry does not exist', () => {
    const { api, uploadCollection } = makePluginApi(null);
    expect(() => api.files.replace('missing', sampleFile)).not.toThrow();
    expect(uploadCollection.read).toHaveBeenCalledWith('missing');
  });
});
