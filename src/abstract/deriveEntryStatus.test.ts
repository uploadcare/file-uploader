import type { UploadcareFile } from '@uploadcare/upload-client';
import { describe, expect, it } from 'vitest';
import { deriveEntryStatus, type EntryStatusFields } from './deriveEntryStatus';

const fields = (over: Partial<EntryStatusFields> = {}): EntryStatusFields => ({
  isRemoved: false,
  errors: [],
  fileInfo: null,
  isUploading: false,
  ...over,
});

const fileInfo = {} as UploadcareFile;
const err = { type: 'x', message: 'm' } as never;

describe('deriveEntryStatus (precedence: removed > failed > success > uploading > idle)', () => {
  it('idle by default', () => {
    expect(deriveEntryStatus(fields())).toBe('idle');
  });

  it('removed wins over everything', () => {
    expect(deriveEntryStatus(fields({ isRemoved: true, errors: [err], fileInfo, isUploading: true }))).toBe('removed');
  });

  it('failed wins over success/uploading', () => {
    expect(deriveEntryStatus(fields({ errors: [err], fileInfo, isUploading: true }))).toBe('failed');
  });

  it('success wins over uploading', () => {
    expect(deriveEntryStatus(fields({ fileInfo, isUploading: true }))).toBe('success');
  });

  it('uploading when only uploading', () => {
    expect(deriveEntryStatus(fields({ isUploading: true }))).toBe('uploading');
  });
});
