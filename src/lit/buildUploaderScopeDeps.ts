// Value imports on purpose: this builder hands the four upload-stack
// constructors to `UploaderController.attachUploaderScope` — the controller
// itself only type-imports them, keeping editor-only bundles (which import
// neither this builder nor `LitUploaderBlock`) free of
// `@uploadcare/upload-client` and friends.
import { SecureUploadsController } from '../abstract/controllers/SecureUploadsController';
import { UploadController } from '../abstract/controllers/UploadController';
import { UploadEventsController } from '../abstract/controllers/UploadEventsController';
import type { UploaderScopeDeps } from '../abstract/controllers/UploaderController';
import { ValidationController } from '../abstract/controllers/ValidationController';
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import type { OutputCollectionState, OutputFileStatus } from '../types/index';
import { getOutputData } from './getOutputData';
import type { SharedInstancesBag } from './shared-instances';
import type { Uid } from './Uid';

/**
 * Single source of truth for the `attachUploaderScope` deps that live on the
 * DOM/PubSub side (resolved from the shared-instances `bag`). Both the v1
 * `LitUploaderBlock` and the ported `UploadCtxProvider` build the identical
 * bag-derived callbacks; only `debug` and `emit` differ per host and stay
 * caller-supplied — `emit` in particular must keep each host's exact
 * teardown-guard semantics (see `UploaderScopeDeps.emit`), so it is never
 * derived here.
 */
export function buildUploaderScopeDeps(
  bag: SharedInstancesBag,
  debug: UploaderScopeDeps['debug'],
  emit: UploaderScopeDeps['emit'],
): UploaderScopeDeps {
  return {
    controllers: { SecureUploadsController, UploadController, ValidationController, UploadEventsController },
    debug,
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
  };
}
