import { afterEach, beforeAll, beforeEach, expect } from 'vitest';
import { page } from 'vitest/browser';
import type { UploadCtxProvider } from '@/index';
import { resetEmulator } from '~/tests/utils/emulator.browser';
import '~/tests/utils/test-renderer';

/**
 * Points Uploadcare's hosts at a fresh emulator session and refuses other third-party requests; does nothing when
 * `E2E_NET=live`.
 */
beforeEach(resetEmulator);

/**
 * Registers every custom element once per file, so no spec has to. `<uc-img>` ships from its own entry. A
 * `*.bundle.e2e.test.tsx` file registers them from the built bundle it tests instead: whichever class defines a tag
 * first wins, so these would leave the bundle's own classes unused.
 */
beforeAll(async () => {
  if (expect.getState().testPath?.endsWith('.bundle.e2e.test.tsx')) return;
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
  await import('@/solutions/adaptive-image/index.js');
});

/** Uploads keep running after a test ends; drop them so they cannot leak events into the next one. */
afterEach(() => {
  for (const provider of page.getByTestId('uc-upload-ctx-provider').elements() as UploadCtxProvider[]) {
    provider.api.removeAllFiles();
  }
});
