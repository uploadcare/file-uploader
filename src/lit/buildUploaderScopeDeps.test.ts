import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { buildUploaderScopeDeps } from './buildUploaderScopeDeps';
import { ensureUploaderCtx } from './ensureUploaderCtx';
import { PubSub } from './PubSubCompat';
import { createSharedInstancesBag } from './shared-instances';

// Each test uses a unique ctx id and tears it down so the module-level
// context/controller maps and the global UploaderRegistry don't leak (same
// recipe as `ensureUploaderCtx.test.ts`).
let seq = 0;
const ids: string[] = [];
const freshCtxName = () => {
  const id = `build-uploader-scope-deps-test-${seq++}`;
  ids.push(id);
  return id;
};

afterEach(() => {
  for (const id of ids.splice(0)) PubSub.deleteCtx(id);
});

describe('buildUploaderScopeDeps', () => {
  // The three telemetry error sinks (`onResolverError`/`onUploadError`/
  // `onValidatorError`) are async error handlers that can fire after the
  // scope is torn down — `bag.telemetryManager.sendEventError` itself must
  // never be allowed to throw back into the caller, or the original failure
  // becomes an unhandled rejection (see the module doc comment). This is the
  // coverage that was lost when `attachUploaderScope` was deleted in step 5.
  it('never rethrows when telemetryManager.sendEventError throws, and logs via the host debug for all three sinks', () => {
    const ctxName = freshCtxName();
    const ctx = ensureUploaderCtx(ctxName);
    const controller = UploaderRegistry.get(ctxName)!;
    const bag = createSharedInstancesBag(() => ctx);

    const sendEventError = vi.spyOn(controller.telemetryManager, 'sendEventError').mockImplementation(() => {
      throw new Error('telemetry sink is down');
    });
    const debug = vi.fn();

    const { host } = buildUploaderScopeDeps(bag, debug, vi.fn());

    expect(() => host.onResolverError(new Error('resolver failed'), 'resolver-context')).not.toThrow();
    expect(() => host.onUploadError(new Error('upload failed'), 'upload-context')).not.toThrow();
    expect(() => host.onValidatorError(new Error('validator failed'), 'validator-context')).not.toThrow();

    expect(sendEventError).toHaveBeenCalledTimes(3);
    expect(debug).toHaveBeenCalledTimes(3);
    expect(debug).toHaveBeenCalledWith('telemetry unavailable for a resolver error report', expect.any(Error));
    expect(debug).toHaveBeenCalledWith('telemetry unavailable for an upload error report', expect.any(Error));
    expect(debug).toHaveBeenCalledWith('telemetry unavailable for a validator error report', expect.any(Error));
  });

  it('reports through telemetryManager.sendEventError without touching debug when it does not throw', () => {
    const ctxName = freshCtxName();
    const ctx = ensureUploaderCtx(ctxName);
    const controller = UploaderRegistry.get(ctxName)!;
    const bag = createSharedInstancesBag(() => ctx);

    const sendEventError = vi.spyOn(controller.telemetryManager, 'sendEventError').mockImplementation(() => {});
    const debug = vi.fn();

    const { host } = buildUploaderScopeDeps(bag, debug, vi.fn());
    const error = new Error('resolver failed');

    host.onResolverError(error, 'resolver-context');

    expect(sendEventError).toHaveBeenCalledWith(error, 'resolver-context');
    expect(debug).not.toHaveBeenCalled();
  });
});
