import { describe, expect, it } from 'vitest';
import { fileIsImage, isBlob, isFile, matchExtension, matchMimeType, mergeFileTypes } from './fileTypes';

describe('mergeFileTypes', () => {
  it('should join input strings with comma', () => {
    expect(mergeFileTypes(['text/html,text/plain', 'image/*,image/heic', 'text/markdown'])).toEqual([
      'text/html',
      'text/plain',
      'image/*',
      'image/heic',
      'text/markdown',
    ]);
  });

  it('should skip empty values', () => {
    expect(mergeFileTypes()).toEqual([]);
    expect(
      mergeFileTypes([
        'text/html',
        '',
        // @ts-expect-error
        undefined,
        'text/plain',
      ]),
    ).toEqual(['text/html', 'text/plain']);
  });

  it('should trim values', () => {
    expect(mergeFileTypes([' text/html , text/plain ', ' image/*, image/heic ', ' text/markdown '])).toEqual([
      'text/html',
      'text/plain',
      'image/*',
      'image/heic',
      'text/markdown',
    ]);
  });
});

describe('matchMimeType', () => {
  it('should return true if file type is exactly matched', () => {
    expect(matchMimeType('image/jpeg', ['image/jpeg'])).toBe(true);
  });
  it('should return true if file type is wildcard matched', () => {
    expect(matchMimeType('image/jpeg', ['image/*'])).toBe(true);
  });
  it('should return false if file type is not matched', () => {
    expect(matchMimeType('text/plain', ['image/*'])).toBe(false);
  });
});

describe('matchExtension', () => {
  it('should return true if file extension is exactly matched', () => {
    expect(matchExtension('image.jpeg', ['.jpeg'])).toBe(true);
    expect(matchExtension('image.avif', ['.avif'])).toBe(true);
  });
  it('should return false if file extension is not matched', () => {
    expect(matchExtension('image.jpeg', ['.png'])).toBe(false);
    expect(matchExtension('image.avifs', ['.avif'])).toBe(false);
  });
  it('should be case insensitive', () => {
    expect(matchExtension('image.PNG', ['.png'])).toBe(true);
  });
});

describe('fileIsImage', () => {
  it('should return true if file is image', () => {
    const file = new File([''], 'name', { type: 'image/jpeg' });
    expect(fileIsImage(file)).toBe(true);
  });
  it('should return false if file is not image', () => {
    const file = new File([''], 'name', { type: 'text/plain' });
    expect(fileIsImage(file)).toBe(false);
  });
});

describe('isBlob', () => {
  it('should return true if Blob is passed', () => {
    expect(isBlob(new Blob(['']))).toBe(true);
  });
  it('should return true if File is passed', () => {
    expect(isBlob(new File([''], 'test.txt'))).toBe(true);
  });
  it('should return false if something else passed', () => {
    expect(isBlob('test')).toBe(false);
    expect(isBlob({ uri: 'test' })).toBe(false);
  });
});

describe('isFile', () => {
  it('should return true if File is passed', () => {
    expect(isFile(new File([''], 'test.txt'))).toBe(true);
  });
  it('should return false if something else passed', () => {
    expect(isFile(new Blob(['']))).toBe(false);
    expect(isFile('test')).toBe(false);
    expect(isFile({ uri: 'test' })).toBe(false);
  });
});
