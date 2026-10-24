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

describe('deriveEntryStatus edge cases', () => {
  it('handles all status states independently', () => {
    const states = [
      { value: fields(), expected: 'idle' },
      { value: fields({ isUploading: true }), expected: 'uploading' },
      { value: fields({ fileInfo }), expected: 'success' },
      { value: fields({ errors: [err] }), expected: 'failed' },
      { value: fields({ isRemoved: true }), expected: 'removed' },
    ];

    for (const { value, expected } of states) {
      expect(deriveEntryStatus(value)).toBe(expected);
    }
  });

  it('handles entry with both errors and fileInfo (errors take precedence)', () => {
    const entry = fields({ errors: [err], fileInfo });
    expect(deriveEntryStatus(entry)).toBe('failed');
  });

  it('handles multiple errors', () => {
    const entry = fields({
      errors: [
        { type: 'UPLOAD_ERROR', message: 'Network failed' } as never,
        { type: 'FORBIDDEN_FILE_TYPE', message: 'Not allowed' } as never,
      ],
    });
    expect(deriveEntryStatus(entry)).toBe('failed');
  });

  it('removed status takes precedence over all other states', () => {
    const maximallyConflicted = fields({
      isRemoved: true,
      errors: [err],
      fileInfo,
      isUploading: true,
    });
    expect(deriveEntryStatus(maximallyConflicted)).toBe('removed');
  });

  it('returns correct status for transitioning entry states', () => {
    let entry = fields(); // idle
    expect(deriveEntryStatus(entry)).toBe('idle');

    entry = fields({ isUploading: true }); // start uploading
    expect(deriveEntryStatus(entry)).toBe('uploading');

    entry = fields({ fileInfo }); // finish successfully
    expect(deriveEntryStatus(entry)).toBe('success');
  });
});
