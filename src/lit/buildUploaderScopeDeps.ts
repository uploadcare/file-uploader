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
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import type { OutputCollectionState, OutputFileStatus } from '../types/index';
import { getOutputData } from './getOutputData';
import type { SharedInstancesBag } from './shared-instances';
import type { Uid } from './Uid';

export type UploaderScopeDeps = {
  controllers: UploadStackControllers;
  host: UploadHostBridge;
};

/**
 * Single source of truth for the upload-stack registration deps that live on
 * the DOM/PubSub side (resolved from the shared-instances `bag`) — the four
 * upload-stack constructors and the `UploadHostBridge` value the abstract-layer
 * controllers `@inject`. Both the ported `UploadCtxProvider` and `<uc-drop-area>`
 * build the identical bag-derived bridge; only `debug` and `emit` differ per
 * host and stay caller-supplied — `emit` in particular must keep each host's
 * exact teardown-guard semantics (see `UploadHostBridge.emit`), so it is never
 * derived here.
 *
 * The three telemetry error sinks (`onResolverError`/`onUploadError`/
 * `onValidatorError`) are built here too — the v1 closures moved verbatim from
 * `UploaderController.attachUploaderScope`, still wrapping
 * `bag.telemetryManager.sendEventError` in a never-throw try/catch (an upload's
 * async error handler can fire after the scope is torn down) and logging via the
 * host `debug`.
 */
export function buildUploaderScopeDeps(
  bag: SharedInstancesBag,
  debug: UploadHostDebug | undefined,
  emit: UploadHostEmit,
): UploaderScopeDeps {
  const hostDebug: UploadHostDebug = debug ?? (() => {});
  const reportTelemetryError =
    (report: string) =>
    (error: unknown, context: string): void => {
      // Error *reporting* must never throw, or the original failure becomes an
      // unhandled rejection. `bag.telemetryManager` can be gone mid-teardown.
      try {
        bag.telemetryManager.sendEventError(error, context);
      } catch (err) {
        // The fallback logger must not throw either, or the original async
        // upload failure becomes an unhandled rejection.
        try {
          hostDebug(report, err);
        } catch {
          // Error reporting must never mask the original failure.
        }
      }
    };

  const host: UploadHostBridge = {
    debug: hostDebug,
    getFileHooks: () => bag.pluginManager?.snapshot().fileHooks ?? [],
    getOutputItem: <TStatus extends OutputFileStatus>(uid: Uid) => bag.api.getOutputItem<TStatus>(uid),
    getApi: () => bag.api,
    emitCommonUploadFailed: () => {
      bag.eventEmitter.emit(
        EventType.COMMON_UPLOAD_FAILED,
        () => bag.api.getOutputCollectionState() as OutputCollectionState<'failed'>,
        { debounce: true },
      );
    },
    emit,
    getOutputCollectionState: () => bag.api.getOutputCollectionState(),
    getOutputData: () => getOutputData(bag),
    runOnAddHooks: (entry) =>
      void bag.wait('pluginManager').then((pluginManager) => pluginManager.runOnAddHooks(entry)),
    onResolverError: reportTelemetryError('telemetry unavailable for a resolver error report'),
    onUploadError: reportTelemetryError('telemetry unavailable for an upload error report'),
    onValidatorError: reportTelemetryError('telemetry unavailable for a validator error report'),
  };

  return {
    controllers: { SecureUploadsController, UploadController, ValidationController, UploadEventsController },
    host,
  };
}
