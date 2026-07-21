// Value imports on purpose: this builder hands the four upload-stack
// constructors to `registerUploadStack` — the abstract layer only type-imports
// them, keeping editor-only bundles (which import neither this builder nor
// `ensureUploaderScope`) free of `@uploadcare/upload-client` and friends.

import { scopedLogger } from '../abstract/controllerLogger';
import type { UploadStackControllers } from '../abstract/controllers/registerUploadStack';
import { SecureUploadsController } from '../abstract/controllers/SecureUploadsController';
import { UploadController } from '../abstract/controllers/UploadController';
import { UploadEventsController } from '../abstract/controllers/UploadEventsController';
import type { UploadHostBridge, UploadHostEmit } from '../abstract/controllers/UploadHostBridge';
import { ValidationController } from '../abstract/controllers/ValidationController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { PluginController } from '../abstract/managers/plugin';
import { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { EventEmitter, EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import type { OutputCollectionState, OutputFileStatus } from '../types/index';
import { getOutputData } from './getOutputData';
import type { Uid } from './Uid';

export type UploaderScopeDeps = {
  controllers: UploadStackControllers;
  host: UploadHostBridge;
};

/**
 * Single source of truth for the upload-stack registration deps that live on
 * the DOM side (resolved from the per-ctx `ControllerContainer`) — the four
 * upload-stack constructors and the `UploadHostBridge` value the
 * abstract-layer controllers `@inject`. Both the ported `UploadCtxProvider` and
 * `<uc-drop-area>` build the identical container-derived bridge; only `emit`
 * differs per host and stays caller-supplied — `emit` in particular must keep
 * each host's exact teardown-guard semantics (see `UploadHostBridge.emit`), so
 * it is never derived here.
 *
 * The three telemetry error sinks (`onResolverError`/`onUploadError`/
 * `onValidatorError`) are built here too, wrapping
 * `TelemetryManager.sendEventError` in a never-throw try/catch (an upload's
 * async error handler can fire after the scope is torn down) and logging via a
 * per-ctx gated `logger` scope (keyed off this ctx's `debug` config).
 *
 * Resolves every instance off the `ControllerContainer`:
 * `container.get(TelemetryManager)` for the sinks, `container.get(EventEmitter)`
 * / `container.get(UploaderPublicApi)` for dispatch/output, and
 * `container.getOrNull` / `container.whenController` for the conditionally-bound
 * `PluginController`.
 */
export function buildUploaderScopeDeps(container: ControllerContainer, emit: UploadHostEmit): UploaderScopeDeps {
  // Per-ctx gated logger for the telemetry error sinks: the verbose tier prints
  // only when THIS ctx's `debug` config is on. The predicate reads the config
  // lazily at log time, and the `log.debug` call below stays inside the
  // never-throw try/catch, so a torn-down container can't surface an error.
  const log = scopedLogger('upload-scope', () => container);
  const reportTelemetryError =
    (report: string) =>
    (error: unknown, context: string): void => {
      // Error *reporting* must never throw, or the original failure becomes an
      // unhandled rejection. `TelemetryManager` can be gone mid-teardown.
      try {
        container.get(TelemetryManager).sendEventError(error, context);
      } catch (err) {
        // The fallback logger must not throw either, or the original async
        // upload failure becomes an unhandled rejection.
        try {
          log.debug(report, err);
        } catch {
          // Error reporting must never mask the original failure.
        }
      }
    };

  const host: UploadHostBridge = {
    getFileHooks: () => container.getOrNull(PluginController)?.snapshot().fileHooks ?? [],
    getOutputItem: <TStatus extends OutputFileStatus>(uid: Uid) =>
      container.get(UploaderPublicApi).getOutputItem<TStatus>(uid),
    getApi: () => container.get(UploaderPublicApi),
    emitCommonUploadFailed: () => {
      container
        .get(EventEmitter)
        .emit(
          EventType.COMMON_UPLOAD_FAILED,
          () => container.get(UploaderPublicApi).getOutputCollectionState() as OutputCollectionState<'failed'>,
          { debounce: true },
        );
    },
    emit,
    getOutputCollectionState: () => container.get(UploaderPublicApi).getOutputCollectionState(),
    getOutputData: () => getOutputData(container),
    runOnAddHooks: (entry) => {
      // Container-native equivalent of `bag.wait('pluginManager').then(…)`: fire
      // as soon as `PluginController` is resolved (synchronously if already bound
      // by `ensurePluginManager`, which runs in the same `ensureUploaderScope`).
      container.whenController(PluginController, (pluginManager) => {
        pluginManager.runOnAddHooks(entry);
      });
    },
    onResolverError: reportTelemetryError('telemetry unavailable for a resolver error report'),
    onUploadError: reportTelemetryError('telemetry unavailable for an upload error report'),
    onValidatorError: reportTelemetryError('telemetry unavailable for a validator error report'),
  };

  return {
    controllers: { SecureUploadsController, UploadController, ValidationController, UploadEventsController },
    host,
  };
}
