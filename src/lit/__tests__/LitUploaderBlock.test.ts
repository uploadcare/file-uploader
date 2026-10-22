import { setupEmulator } from '@uploadcare/api-emulator/node';
import type { UploadcareFile } from '@uploadcare/upload-client';
import { afterAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import * as UC from '../../index';

UC.defineComponents(UC);

// The blocks send telemetry as they start; the emulator answers it, so nothing leaves the process.
const emulator = setupEmulator();
beforeEach(() => emulator.reset());
afterAll(() => emulator.stop());

/** A ctx with a provider for the events and `<uc-simple-btn>`, a block that owns the upload collection. */
async function renderCtx(ctxName: string): Promise<UC.UploadCtxProvider> {
  const host = document.createElement('div');
  host.innerHTML = `
    <uc-config ctx-name="${ctxName}" pubkey="demopublickey"></uc-config>
    <uc-simple-btn ctx-name="${ctxName}"></uc-simple-btn>
    <uc-upload-ctx-provider ctx-name="${ctxName}"></uc-upload-ctx-provider>
  `;
  document.body.append(host);
  onTestFinished(() => host.remove());
  await vi.advanceTimersByTimeAsync(0);
  return host.querySelector('uc-upload-ctx-provider') as UC.UploadCtxProvider;
}

describe('LitUploaderBlock', () => {
  it('fires common-upload-success once when uploaded files report their validation in separate batches', async () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const provider = await renderCtx('lit-uploader-block-success-once');
    const successes: Event[] = [];
    provider.addEventListener('common-upload-success', (event) => successes.push(event));
    const collection = provider.uploadCollection;
    const uids = ['first', 'second'].map((uuid) => collection.add({ uuid, fileInfo: { uuid } as UploadcareFile }));
    await vi.runAllTimersAsync();
    expect(successes).toHaveLength(1);

    // Each validation result is its own batch: the collection flushes its changes on a 0ms timer.
    for (const uid of uids) {
      collection.read(uid)?.setValue('errors', []);
      await vi.runAllTimersAsync();
    }

    expect(successes).toHaveLength(1);
  });
});
