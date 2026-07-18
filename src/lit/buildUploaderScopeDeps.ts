// Value imports on purpose: this builder hands the four upload-stack
// constructors to `registerUploadStack` — the abstract layer only type-imports
// them, keeping editor-only bundles (which import neither this builder nor
// `ensureUploaderScope`) free of `@uploadcare/upload-client` and friends.

import type { UploadStackControllers } from '../abstract/controllers/registerUploadStack';
import { SecureUploadsController } from '../abstract/controllers/SecureUploadsController';
import { UploadController } from '../abstract/controllers/UploadController';
import { UploadEventsController } from '../abstract/controllers/UploadEventsController';
import type { UploadHostBridge, UploadHostDebug, UploadHostEmit } from '../abstract/controllers/UploadHostBridge';
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
 * the DOM/PubSub side (resolved from the per-ctx `ControllerContainer`) — the
 * four upload-stack constructors and the `UploadHostBridge` value the
 * abstract-layer controllers `@inject`. Both the ported `UploadCtxProvider` and
 * `<uc-drop-area>` build the identical container-derived bridge; only `debug`
 * and `emit` differ per host and stay caller-supplied — `emit` in particular
 * must keep each host's exact teardown-guard semantics (see
 * `UploadHostBridge.emit`), so it is never derived here.
 *
 * The three telemetry error sinks (`onResolverError`/`onUploadError`/
 * `onValidatorError`) are built here too — the v1 closures moved verbatim from
 * `UploaderController.attachUploaderScope`, still wrapping
 * `TelemetryManager.sendEventError` in a never-throw try/catch (an upload's
 * async error handler can fire after the scope is torn down) and logging via the
 * host `debug`.
 *
 * M-god step 9c-1: resolves every instance off the `ControllerContainer` (was
 * the shared instances `bag`) — the same per-ctx singletons the bag re-exposed:
 * `container.get(TelemetryManager)` for the sinks, `container.get(EventEmitter)`
 * / `container.get(UploaderPublicApi)` for dispatch/output, and
 * `container.getOrNull` / `container.whenController` for the conditionally-bound
 * `PluginController` (the container-native equivalents of `bag.pluginManager?`
 * and `bag.wait('pluginManager')`).
 */
export function buildUploaderScopeDeps(
  container: ControllerContainer,
  debug: UploadHostDebug | undefined,
  emit: UploadHostEmit,
): UploaderScopeDeps {
  const hostDebug: UploadHostDebug = debug ?? (() => {});
  const reportTelemetryError =
    (report: string) =>
    (error: unknown, context: string): void => {
      // Error *reporting* must never throw, or the original failure becomes an
      // unhandled rejection. `TelemetryManager` can be gone mid-teardown.
      try {
        container.get(TelemetryManager).sendEventError(error, context);
      } catch (err) {
        hostDebug(report, err);
      }
    };

  const host: UploadHostBridge = {
    debug: hostDebug,
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
      container.whenController(PluginController, (pluginManager) => pluginManager.runOnAddHooks(entry));
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
