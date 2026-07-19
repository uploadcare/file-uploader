import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../abstract/controllers/ConfigController';
import { __resetLoggerForTests } from '../abstract/logger';
import { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { buildUploaderScopeDeps } from './buildUploaderScopeDeps';
import { ensureUploaderCtx } from './ensureUploaderCtx';

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
  for (const id of ids.splice(0)) UploaderRegistry.dispose(id);
  __resetLoggerForTests();
  vi.restoreAllMocks();
});

describe('buildUploaderScopeDeps', () => {
  // The three telemetry error sinks (`onResolverError`/`onUploadError`/
  // `onValidatorError`) are async error handlers that can fire after the
  // scope is torn down — `bag.telemetryManager.sendEventError` itself must
  // never be allowed to throw back into the caller, or the original failure
  // becomes an unhandled rejection (see the module doc comment). This is the
  // coverage that was lost when `attachUploaderScope` was deleted in step 5.
  it('never rethrows when telemetryManager.sendEventError throws, and logs via the logger for all three sinks', () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = UploaderRegistry.get(ctxName)!;

    const sendEventError = vi.spyOn(container.get(TelemetryManager), 'sendEventError').mockImplementation(() => {
      throw new Error('telemetry sink is down');
    });
    // The fallback log is a per-ctx gated `logger.debug` — enable this ctx's
    // `debug` config so the gated tier fires and can be asserted. The badge
    // header is the multi-chip badge (uc + ctx + scope) + style args.
    container.get(ConfigController).set('debug', true);
    const debug = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { host } = buildUploaderScopeDeps(container, vi.fn());

    expect(() => host.onResolverError(new Error('resolver failed'), 'resolver-context')).not.toThrow();
    expect(() => host.onUploadError(new Error('upload failed'), 'upload-context')).not.toThrow();
    expect(() => host.onValidatorError(new Error('validator failed'), 'validator-context')).not.toThrow();

    expect(sendEventError).toHaveBeenCalledTimes(3);
    expect(debug).toHaveBeenCalledTimes(3);
    expect(debug).toHaveBeenCalledWith(
      `%c uc %c ${ctxName} %c upload-scope %c`,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      '',
      'telemetry unavailable for a resolver error report',
      expect.any(Error),
    );
    expect(debug).toHaveBeenCalledWith(
      `%c uc %c ${ctxName} %c upload-scope %c`,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      '',
      'telemetry unavailable for an upload error report',
      expect.any(Error),
    );
    expect(debug).toHaveBeenCalledWith(
      `%c uc %c ${ctxName} %c upload-scope %c`,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      '',
      'telemetry unavailable for a validator error report',
      expect.any(Error),
    );
  });

  it('reports through telemetryManager.sendEventError without touching the logger when it does not throw', () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = UploaderRegistry.get(ctxName)!;

    const sendEventError = vi.spyOn(container.get(TelemetryManager), 'sendEventError').mockImplementation(() => {});
    container.get(ConfigController).set('debug', true);
    const debug = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { host } = buildUploaderScopeDeps(container, vi.fn());
    const error = new Error('resolver failed');

    host.onResolverError(error, 'resolver-context');

    expect(sendEventError).toHaveBeenCalledWith(error, 'resolver-context');
    expect(debug).not.toHaveBeenCalled();
  });
});
