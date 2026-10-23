import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFileUploaderFrom, UC_WINDOW_KEY } from './loadFileUploaderFrom';

const URL_A = 'https://cdn.example/file-uploader.iife.min.js';

describe('loadFileUploaderFrom', () => {
  // Captured instead of appended: happy-dom answers every appended script with an error event of its own.
  let appended: HTMLScriptElement[];

  beforeEach(() => {
    appended = [];
    vi.spyOn(document.head, 'appendChild').mockImplementation(<T extends Node>(node: T) => {
      appended.push(node as unknown as HTMLScriptElement);
      return node;
    });
  });

  afterEach(() => {
    delete window[UC_WINDOW_KEY];
  });

  it('rejects with an Error naming the url, and removes the script that failed', async () => {
    const loading = loadFileUploaderFrom(URL_A);
    const [script] = appended;
    const remove = vi.spyOn(script as HTMLScriptElement, 'remove');
    script?.onerror?.(new Event('error'));

    await expect(loading).rejects.toThrow(`Failed to load ${URL_A}`);
    expect(remove).toHaveBeenCalled();
  });

  it('shares one script between calls made before it loads', async () => {
    const first = loadFileUploaderFrom(URL_A);
    const second = loadFileUploaderFrom(URL_A);
    expect(appended).toHaveLength(1);

    const module = {};
    window[UC_WINDOW_KEY] = module;
    appended[0]?.onload?.(new Event('load'));

    await expect(first).resolves.toBe(module);
    await expect(second).resolves.toBe(module);
  });
});
