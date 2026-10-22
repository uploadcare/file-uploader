import type { FileFromOptions } from '@uploadcare/upload-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { delay } from '@/utils/delay';
import { clearSent, sent, waitForType } from '~/tests/api/telemetry/sink';
import { IMAGE } from '~/tests/fixtures/files';
import { isLive } from '~/tests/utils/emulator.browser';
import { recordEvents } from '~/tests/utils/event-recorder';
import { inCtx, renderSolution } from '~/tests/utils/render-solution';
import '~/types/jsx';

/** Longer than the 300ms output flush, so trailing telemetry has been queued and sent. */
const SETTLE_MS = 1000;

/**
 * Once the uploader is destroyed — every block of its ctx removed and the deferred teardown run — nothing may leave
 * it: no upload request, no telemetry, no event. `uploadFile` is stubbed with a request that only ends when aborted,
 * so the test controls exactly what is still in flight at the moment of destruction.
 */

const uploadFile = vi.hoisted(() => vi.fn());

vi.mock('@uploadcare/upload-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uploadcare/upload-client')>();
  return { ...actual, uploadFile };
});

/** A request that hangs until its signal aborts, like an upload still on the network. */
const pendingUntilAborted = (_input: unknown, options: FileFromOptions) =>
  new Promise((_, reject) => {
    options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });

/** Removes every element of the ctx and waits past the `setTimeout(0)` teardown that destroys it. */
const destroy = async (ctxName: string) => {
  for (const tag of ['uc-file-uploader-regular', 'uc-upload-ctx-provider', 'uc-config']) {
    inCtx(tag, ctxName).remove();
  }
  await delay(50);
};

beforeEach(() => {
  uploadFile.mockReset();
  uploadFile.mockImplementation(pendingUntilAborted);
});

describe('after the uploader is destroyed', () => {
  it('aborts the upload still on the network', async () => {
    const { ctxName, api } = await renderSolution();
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalledOnce());
    const { signal } = uploadFile.mock.calls[0][1] as FileFromOptions;

    await destroy(ctxName);

    expect(signal?.aborted).toBe(true);
  });

  // Fake-only: telemetry is read back from the emulator, and a live run has none.
  it.skipIf(isLive)('dispatches no event and sends no telemetry for the cancelled upload', async () => {
    const { ctxName, api, provider } = await renderSolution('regular', { qualityInsights: true });
    await waitForType('init-solution');
    const recorder = recordEvents(provider);
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalledOnce());
    // Let the telemetry for what happened so far flush, so only post-destroy sends remain to look for.
    await delay(SETTLE_MS);
    const eventsBefore = recorder.types.length;
    clearSent();

    await destroy(ctxName);
    // Negative wait: longer than the telemetry flush, and nothing marks "nothing happened".
    await delay(SETTLE_MS);

    expect(sent()).toEqual([]);
    expect(recorder.types.slice(eventsBefore)).toEqual([]);
  });

  it('starts no upload that was still queued', async () => {
    const { ctxName, api } = await renderSolution('regular', { maxConcurrentRequests: 1 });
    api.addFileFromObject(IMAGE.PIXEL);
    api.addFileFromObject(IMAGE.PIXEL, { fileName: 'second.jpg' });
    api.uploadAll();
    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalledOnce());

    await destroy(ctxName);
    // Negative wait: the queued upload would start as soon as the first one settled.
    await delay(200);

    expect(uploadFile).toHaveBeenCalledOnce();
  });
});
