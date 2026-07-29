import type { UploadcareFile } from '@uploadcare/upload-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyInitialCrop } from './applyInitialCrop';
import { UploadCollectionController } from './controllers/UploadCollectionController';

const imageInfo = (width: number, height: number) => ({ width, height }) as UploadcareFile['imageInfo'];

const fileInfo = (width: number, height: number) => ({ imageInfo: imageInfo(width, height) }) as UploadcareFile;

describe('applyInitialCrop', () => {
  let collection: UploadCollectionController;

  beforeEach(() => {
    vi.useFakeTimers();
    collection = new UploadCollectionController();
  });

  afterEach(() => {
    collection.destroy();
    vi.useRealTimers();
  });

  it('is a no-op when cropPreset is empty or fully invalid — eligible entries stay uncropped', () => {
    const cdnUrl = 'https://cdn.example.com/c2499162-eb07-4b93-b31e-94a89a47e858/';
    const id = collection.add({
      isImage: true,
      fileInfo: fileInfo(800, 600),
      cdnUrl,
      cdnUrlModifiers: null,
    });

    expect(() => applyInitialCrop(collection, '')).not.toThrow();

    // 'not-a-preset' is unparseable and makes parseCropPreset itself warn —
    // suppress that unrelated noise so the assertion stays about applyInitialCrop.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => applyInitialCrop(collection, 'not-a-preset')).not.toThrow();
    warnSpy.mockRestore();

    // A rejected preset must not fall through to the 1:1 default crop.
    const entry = collection.read(id);
    expect(entry?.get('cdnUrlModifiers')).toBeNull();
    expect(entry?.get('cdnUrl')).toBe(cdnUrl);
  });

  it('applies a centered crop modifier + rewritten cdnUrl to an image entry without an existing crop modifier', () => {
    const cdnUrl = 'https://cdn.example.com/c2499162-eb07-4b93-b31e-94a89a47e858/';
    const id = collection.add({
      isImage: true,
      fileInfo: fileInfo(800, 600),
      cdnUrl,
      cdnUrlModifiers: null,
    });

    applyInitialCrop(collection, '4:3');

    const entry = collection.read(id);
    // Literal expected strings (not computed via `withOperations`/
    // `operationsFromModifiers` — the functions under migration — so this
    // test can actually detect a change in what they produce). 800x600 at a
    // 4:3 aspect ratio is already 4:3 — full-frame centered crop.
    expect(entry?.get('cdnUrlModifiers')).toBe('-/crop/800x600/0,0/-/preview/');
    expect(entry?.get('cdnUrl')).toBe(
      'https://cdn.example.com/c2499162-eb07-4b93-b31e-94a89a47e858/-/crop/800x600/0,0/-/preview/',
    );
  });

  it('skips entries that already have /crop/ in cdnUrlModifiers (values unchanged)', () => {
    const cdnUrl = 'https://cdn.example.com/c2499162-eb07-4b93-b31e-94a89a47e858/';
    const existingModifiers = '-/crop/100x100/0,0/';
    const id = collection.add({
      isImage: true,
      fileInfo: fileInfo(800, 600),
      cdnUrl,
      cdnUrlModifiers: existingModifiers,
    });

    applyInitialCrop(collection, '4:3');

    const entry = collection.read(id);
    expect(entry?.get('cdnUrlModifiers')).toBe(existingModifiers);
    expect(entry?.get('cdnUrl')).toBe(cdnUrl);
  });

  it('skips non-image entries and entries without fileInfo', () => {
    const nonImageId = collection.add({
      isImage: false,
      fileInfo: fileInfo(800, 600),
      cdnUrl: 'https://cdn.example.com/a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d/',
      cdnUrlModifiers: null,
    });
    const noFileInfoId = collection.add({
      isImage: true,
      fileInfo: null,
      cdnUrl: 'https://cdn.example.com/b7c8d9e0-1f2a-4b3c-8d4e-5f6a7b8c9d0e/',
      cdnUrlModifiers: null,
    });

    applyInitialCrop(collection, '4:3');

    expect(collection.read(nonImageId)?.get('cdnUrlModifiers')).toBeNull();
    expect(collection.read(noFileInfoId)?.get('cdnUrlModifiers')).toBeNull();
  });

  it('warns + skips when fileInfo.imageInfo is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const id = collection.add({
      isImage: true,
      fileInfo: {} as UploadcareFile,
      cdnUrl: 'https://cdn.example.com/c2499162-eb07-4b93-b31e-94a89a47e858/',
      cdnUrlModifiers: null,
    });

    applyInitialCrop(collection, '4:3');

    const entry = collection.read(id);
    expect(entry?.get('cdnUrlModifiers')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('[uc][initial-crop]', 'Failed to get image info for entry', entry?.uid);

    warnSpy.mockRestore();
  });

  it('warns + skips when cdnUrl is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const id = collection.add({
      isImage: true,
      fileInfo: fileInfo(800, 600),
      cdnUrl: null,
      cdnUrlModifiers: null,
    });

    applyInitialCrop(collection, '4:3');

    const entry = collection.read(id);
    expect(entry?.get('cdnUrlModifiers')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('[uc][initial-crop]', 'Failed to get cdnUrl for entry', entry?.uid);

    warnSpy.mockRestore();
  });

  it('falls back to a 1:1 aspect ratio when the preset lacks numeric width/height (square crop for a square source)', () => {
    const cdnUrl = 'https://cdn.example.com/c2499162-eb07-4b93-b31e-94a89a47e858/';
    const id = collection.add({
      isImage: true,
      fileInfo: fileInfo(500, 500),
      cdnUrl,
      cdnUrlModifiers: null,
    });

    // 'free' is parsed by parseCropPreset into a preset with hasFreeform=true
    // and width/height forced to 0 (not numeric-positive) — triggering the
    // 1:1 fallback in applyInitialCrop.
    applyInitialCrop(collection, 'free');

    const entry = collection.read(id);
    const cdnUrlModifiers = entry?.get('cdnUrlModifiers');
    // A 500x500 source at aspect ratio 1 crops to the full square: 500x500 at 0,0.
    expect(cdnUrlModifiers).toContain('crop/500x500/0,0');
  });
});
