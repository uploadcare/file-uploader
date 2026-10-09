import { setupEmulator } from '@uploadcare/api-emulator/node';
import { afterAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import * as UC from '../../../index';
import { withResolvers } from '../../../utils/withResolvers';
import type { FuncFileValidator } from '../ValidationManager';

UC.defineComponents(UC);

// The blocks send telemetry as they start; the emulator answers it, so nothing leaves the process.
const emulator = setupEmulator();
beforeEach(() => emulator.reset());
afterAll(() => emulator.stop());

/** A ctx with a provider for the API and `<uc-simple-btn>`, a block that owns the upload collection. */
const renderCtx = async (config: Partial<UC.ConfigType>) => {
  const ctxName = 'validation-manager';
  const host = document.createElement('div');
  host.innerHTML = `
    <uc-config ctx-name="${ctxName}" pubkey="demopublickey" quality-insights="false"></uc-config>
    <uc-simple-btn ctx-name="${ctxName}"></uc-simple-btn>
    <uc-upload-ctx-provider ctx-name="${ctxName}"></uc-upload-ctx-provider>
  `;
  Object.assign(host.querySelector('uc-config') as UC.Config, config);
  document.body.append(host);
  onTestFinished(() => host.remove());
  const provider = host.querySelector('uc-upload-ctx-provider') as UC.UploadCtxProvider;
  await vi.waitFor(() => expect(provider.api).toBeDefined());
  return provider.api;
};

describe('ValidationManager', () => {
  /**
   * Runs `files` files through a validator and answers the highest number in flight at once. Every validator holds
   * until `validationConcurrency` of them are running, so the runs overlap as far as the setting allows; a manager
   * that let fewer run at once would never get there, and the wait for them to finish would time out.
   */
  const peakConcurrency = async (validationConcurrency: number, files: number): Promise<number> => {
    let inFlight = 0;
    let peak = 0;
    let finished = 0;
    const allowedRunning = withResolvers();

    const validator: FuncFileValidator = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      if (inFlight >= validationConcurrency) allowedRunning.resolve();
      await allowedRunning.promise;
      inFlight -= 1;
      finished += 1;
      return undefined;
    };

    const api = await renderCtx({ validationConcurrency, fileValidators: [validator] });
    for (let i = 0; i < files; i += 1) {
      api.addFileFromObject(new File(['x'], `file-${i}.jpg`, { type: 'image/jpeg' }));
    }

    // At least: a config change on startup can run the validators over a file a second time.
    await vi.waitFor(() => expect(finished).toBeGreaterThanOrEqual(files), { timeout: 10_000 });
    return peak;
  };

  it.each([
    [1, 3, 1],
    [2, 3, 2],
    [3, 3, 3],
    // The cap, not the number of files, sets the peak.
    [2, 5, 2],
  ])(
    'runs at most %i validators at once over %i files',
    async (validationConcurrency, files, expected) => {
      expect(await peakConcurrency(validationConcurrency, files)).toBe(expected);
    },
    15_000,
  );
});
