import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponents } from '../defineComponents';
import { loadFileUploaderFrom, UC_WINDOW_KEY } from '../loadFileUploaderFrom';

vi.mock('../defineComponents', () => ({
  defineComponents: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();

  delete (window as any)[UC_WINDOW_KEY];
});

afterEach(() => {
  const scripts = document.querySelectorAll('script[src]');
  for (const script of scripts) {
    script.remove();
  }

  delete (window as any)[UC_WINDOW_KEY];
});

describe('loadFileUploaderFrom', async () => {
  const { default: testUrl } = await import('~/web/file-uploader.iife.min.js?url');

  describe('UC_WINDOW_KEY', () => {
    it('should export UC_WINDOW_KEY as "UC"', () => {
      expect(UC_WINDOW_KEY).toBe('UC');
    });
  });

  describe('when window.UC already exists', () => {
    it('should resolve with existing window.UC immediately', async () => {
      const mockBlocks = { TestBlock: { reg: vi.fn() } };
      (window as any)[UC_WINDOW_KEY] = mockBlocks;

      const result = await loadFileUploaderFrom(testUrl);

      expect(result).toBe(mockBlocks);
    });

    it('should not create a new script element', async () => {
      const mockBlocks = { TestBlock: { reg: vi.fn() } };
      (window as any)[UC_WINDOW_KEY] = mockBlocks;
      const initialScriptCount = document.querySelectorAll('script').length;

      await loadFileUploaderFrom(testUrl);

      expect(document.querySelectorAll('script').length).toBe(initialScriptCount);
    });

    it('should not call defineComponents even if register is true', async () => {
      const mockBlocks = { TestBlock: { reg: vi.fn() } };
      (window as any)[UC_WINDOW_KEY] = mockBlocks;

      await loadFileUploaderFrom(testUrl, true);

      expect(defineComponents).not.toHaveBeenCalled();
    });
  });

  describe('when loading script', () => {
    it('should append script to document head', async () => {
      const loadPromise = loadFileUploaderFrom(testUrl);

      const script = document.head.querySelector(`script[src="${testUrl}"]`);
      expect(script).not.toBeNull();

      const mockBlocks = { TestBlock: { reg: vi.fn() } };
      (window as any)[UC_WINDOW_KEY] = mockBlocks;
      (script as HTMLScriptElement).onload?.(new Event('load'));

      await loadPromise;
    });

    it('should resolve with window.UC on successful load', async () => {
      const loadPromise = loadFileUploaderFrom(testUrl);
      const mockBlocks = { TestBlock: { reg: vi.fn() }, AnotherBlock: { reg: vi.fn() } };

      const script = document.querySelector(`script[src="${testUrl}"]`) as HTMLScriptElement;
      (window as any)[UC_WINDOW_KEY] = mockBlocks;
      script.onload?.(new Event('load'));

      const result = await loadPromise;
      expect(result).toBe(mockBlocks);
    });

    it('should call defineComponents when register is true', async () => {
      const loadPromise = loadFileUploaderFrom(testUrl, true);
      const mockBlocks = { TestBlock: { reg: vi.fn() } };

      const script = document.querySelector(`script[src="${testUrl}"]`) as HTMLScriptElement;
      (window as any)[UC_WINDOW_KEY] = mockBlocks;
      script.onload?.(new Event('load'));

      await loadPromise;
      expect(defineComponents).toHaveBeenCalledWith(mockBlocks);
    });

    it('should not call defineComponents when register is false', async () => {
      const loadPromise = loadFileUploaderFrom(testUrl, false);
      const mockBlocks = { TestBlock: { reg: vi.fn() } };

      const script = document.querySelector(`script[src="${testUrl}"]`) as HTMLScriptElement;
      (window as any)[UC_WINDOW_KEY] = mockBlocks;
      script.onload?.(new Event('load'));

      await loadPromise;
      expect(defineComponents).not.toHaveBeenCalled();
    });

    it('should not call defineComponents by default', async () => {
      const loadPromise = loadFileUploaderFrom(testUrl);
      const mockBlocks = { TestBlock: { reg: vi.fn() } };

      const script = document.querySelector(`script[src="${testUrl}"]`) as HTMLScriptElement;
      (window as any)[UC_WINDOW_KEY] = mockBlocks;
      script.onload?.(new Event('load'));

      await loadPromise;
      expect(defineComponents).not.toHaveBeenCalled();
    });

    it('should reject on script error', async () => {
      const loadPromise = loadFileUploaderFrom(testUrl);

      const script = document.querySelector(`script[src="${testUrl}"]`) as HTMLScriptElement;
      script.onerror?.(new Event('error'));

      await expect(loadPromise).rejects.toBeUndefined();
    });
  });

  describe('non-browser environment', () => {
    it('should resolve with null when document is not an object', async () => {
      const originalDocument = global.document;

      // @ts-expect-error - intentionally setting to non-object for test
      global.document = undefined;

      const result = await loadFileUploaderFrom(testUrl);

      expect(result).toBeNull();

      global.document = originalDocument;
    });
  });
});
