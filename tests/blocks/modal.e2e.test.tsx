import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { EventPayload, UploadCtxProvider } from '@/index.js';
import { getCtxName } from '../utils/getCtxName';
import { hasCtx } from '../utils/registry';
import { cleanup } from '../utils/test-renderer';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('uc-modal native close routing', () => {
  it('a native dialog "close" event (Esc / native close) routes through the router as modal-close', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );
    await page.getByText('Upload files', { exact: true }).click();
    await expect.element(page.getByTestId('uc-start-from')).toBeVisible();

    const ctxProvider = page.getByTestId('uc-upload-ctx-provider').query()! as UploadCtxProvider;
    const modalCloseHandler = vi.fn<(e: CustomEvent<EventPayload['modal-close']>) => void>();
    ctxProvider.addEventListener('modal-close', modalCloseHandler);

    const dialog = document.querySelector('uc-modal dialog') as HTMLDialogElement;
    expect(dialog).toBeTruthy();

    // Simulate the browser's native close (Esc key / native dialog dismissal):
    // the <dialog> fires its own "close" event, which `Modal._handleDialogClose`
    // routes to `router.closeModal()` — this must reach the documented
    // `modal-close` event, not just flip an internal flag.
    dialog.dispatchEvent(new Event('close'));

    await expect.poll(() => modalCloseHandler.mock.calls.length).toBe(1);
    expect(modalCloseHandler.mock.calls[0][0].detail).toMatchObject({ hasActiveModals: false });
    // The router's foreground modal slot cleared: the Modal block reflects
    // that back onto the dialog's a11y state.
    await expect.poll(() => document.querySelector('uc-modal')?.getAttribute('aria-modal')).toBe('false');
  });
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
    await expect.poll(() => hasCtx(ctxName)).toBe(false);

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
