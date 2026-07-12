import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { PubSub } from '@/lit/PubSubCompat';
import { getCtxName } from '../utils/getCtxName';
import { cleanup } from '../utils/test-renderer';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('uc-modal teardown', () => {
  it('ignores a native dialog "close" event arriving after the ctx is torn down', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();

    // Capture the live dialog before unmounting; the Modal's "close" listener
    // stays attached to it after removal.
    const dialog = document.querySelector('uc-modal dialog');
    expect(dialog).toBeTruthy();

    // Unmount everything; the ctx destroys via a deferred task once the last
    // block disconnects. Wait for the destruction fact, not a fixed delay.
    cleanup();
    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(false);

    // The native <dialog> "close" event is dispatched from a queued task and
    // can land exactly here in real teardowns. It must be a no-op, not an
    // uncaught "context manager for key \"*router\" is not available" error.
    const errors: string[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(String(event.error?.message ?? event.message));
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    try {
      dialog?.dispatchEvent(new Event('close'));
    } finally {
      window.removeEventListener('error', onError);
    }
    expect(errors).toEqual([]);
  });
});
