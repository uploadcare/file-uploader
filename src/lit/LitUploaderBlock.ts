// @ts-check

import { applyInitialCrop } from '../abstract/applyInitialCrop';
import { uploaderBlockCtx } from '../abstract/CTX';
import { SecureUploadsController } from '../abstract/controllers/SecureUploadsController';
import type { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import { UploadController } from '../abstract/controllers/UploadController';
import { UploadEventsController } from '../abstract/controllers/UploadEventsController';
import { ValidationController } from '../abstract/controllers/ValidationController';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import type { OutputCollectionState, OutputFileEntry, OutputFileStatus } from '../types/index';
import { ExternalUploadSource, UploadSource } from '../utils/UploadSource';
import { getOutputData } from './getOutputData';
import { LitActivityBlock } from './LitActivityBlock';
import type { Uid } from './Uid';

export class LitUploaderBlock extends LitActivityBlock {
  public static extSrcList: Readonly<typeof ExternalUploadSource>;
  public static sourceTypes: Readonly<typeof UploadSource>;

  public override init$ = uploaderBlockCtx(this);

  public override initCallback(): void {
    super.initCallback();

    // The upload collection is owned by the per-ctx UploaderController; the
    // shared instance resolves to it so all blocks share one source of truth.
    this._addSharedContextInstance('*uploadCollection', () => this.sharedCtx.uploaderController().collection);

    this._addSharedContextInstance('*secureUploadsManager', (sharedInstancesBag) => {
      return new SecureUploadsController({
        config: this.sharedCtx.uploaderController().config,
        onResolverError: (error, context) => {
          sharedInstancesBag.telemetryManager.sendEventError(error, context);
        },
        debug: (...args) => this.debugPrint(...args),
      });
    });
    this._addSharedContextInstance('*uploadController', (sharedInstancesBag) => {
      const uploader = this.sharedCtx.uploaderController();
      return new UploadController({
        collection: uploader.collection,
        config: uploader.config,
        secureUploads: this.secureUploadsManager,
        getFileHooks: () => sharedInstancesBag.pluginManager?.snapshot().fileHooks ?? [],
        getOutputItem: (uid) => sharedInstancesBag.api.getOutputItem(uid),
        onUploadError: (error, context) => {
          // An upload's async error handler can fire after the ctx (and its
          // telemetry instance) is torn down — error *reporting* must never
          // throw, or the original failure becomes an unhandled rejection.
          try {
            sharedInstancesBag.telemetryManager.sendEventError(error, context);
          } catch (err) {
            this.debugPrint('telemetry unavailable for an upload error report', err);
          }
        },
        debug: (...args) => this.debugPrint(...args),
      });
    });
    // Register *publicApi before *validationManager: `_addSharedContextInstance`
    // runs its resolver eagerly, right here, not lazily on first read — so
    // *publicApi must already exist by the time `sharedInstancesBag.api` is
    // resolved below (the ValidationController ctor runs `_runAllValidators`
    // synchronously, which reads `sharedInstancesBag.api` via `getApi`).
    // Also hand it straight to the controller (`setApi`) — the DOM-free
    // `ClipboardController` (constructed by `UploaderController`, M9l) needs it
    // for its add-file callbacks, but only the DOM layer can construct
    // `UploaderPublicApi` (it needs the shared-instances bag).
    this._addSharedContextInstance('*publicApi', (sharedInstancesBag) => {
      const api = new UploaderPublicApi(sharedInstancesBag);
      this.sharedCtx.uploaderController().setApi(api);
      return api;
    });
    this._addSharedContextInstance('*validationManager', (sharedInstancesBag) => {
      const uploader = this.sharedCtx.uploaderController();
      return new ValidationController({
        config: uploader.config,
        collection: uploader.collection,
        getApi: () => sharedInstancesBag.api,
        setCollectionErrors: (errors) => {
          this.$['*collectionErrors'] = errors;
        },
        emitCommonUploadFailed: () => {
          sharedInstancesBag.eventEmitter.emit(
            EventType.COMMON_UPLOAD_FAILED,
            () => sharedInstancesBag.api.getOutputCollectionState() as OutputCollectionState<'failed'>,
            { debounce: true },
          );
        },
        onValidatorError: (error, context) => {
          sharedInstancesBag.telemetryManager.sendEventError(error, context);
        },
      });
    });

    // The collection→events derivation lives in the DOM-free UploadEventsController,
    // a per-ctx shared instance — first-write-wins, so exactly one is created no
    // matter how many blocks register it or in what order they connect/disconnect.
    this._addSharedContextInstance('*uploadEvents', (sharedInstancesBag) => {
      const uploader = this.sharedCtx.uploaderController();
      const ctx = sharedInstancesBag.ctx;
      const uploadEvents = new UploadEventsController({
        collection: uploader.collection,
        config: uploader.config,
        validation: sharedInstancesBag.validationManager,
        // Emit parity with LitBlock.emit: EventEmitter dispatch + telemetry
        // mirror, guarded for teardown (emissions can race ctx destruction).
        emit: (type, payload, options) => {
          const eventEmitter = ctx.has('*eventEmitter') ? ctx.read('*eventEmitter') : undefined;
          if (!eventEmitter) return;
          eventEmitter.emit(type, payload, options);
          const resolvedPayload = typeof payload === 'function' ? payload() : payload;
          try {
            sharedInstancesBag.telemetryManager.sendEvent({
              eventType: type,
              payload: (resolvedPayload ?? undefined) as Record<string, unknown> | undefined,
            });
          } catch (err) {
            this.debugPrint('telemetry unavailable for an upload event report', err);
          }
        },
        getOutputItem: <TStatus extends OutputFileStatus>(uid: Uid) =>
          sharedInstancesBag.api.getOutputItem<TStatus>(uid),
        getOutputCollectionState: () => sharedInstancesBag.api.getOutputCollectionState(),
        getOutputData: () => getOutputData(sharedInstancesBag),
        buildUploadOptions: () => sharedInstancesBag.uploadController.buildUploadOptions(),
        runOnAddHooks: (entry) =>
          void sharedInstancesBag.wait('pluginManager').then((pluginManager) => pluginManager.runOnAddHooks(entry)),
        applyInitialCrop: () => applyInitialCrop(uploader.collection, uploader.config.get('cropPreset')),
        uploadTrigger: () => ctx.read('*uploadTrigger'),
        setUploadList: (list) => ctx.pub('*uploadList', list),
        getCollectionState: () => ctx.read('*collectionState'),
        setCollectionState: (state) => ctx.pub('*collectionState', state),
        getCommonProgress: () => ctx.read('*commonProgress'),
        setCommonProgress: (progress) => ctx.pub('*commonProgress', progress),
        setGroupInfo: (group) => ctx.pub('*groupInfo', group),
        getCollectionErrors: () => ctx.read('*collectionErrors'),
      });
      uploadEvents.observe();
      return uploadEvents;
    });
  }

  public getAPI(): UploaderPublicApi {
    return this.api;
  }

  public get validationManager(): ValidationController {
    return this._getSharedContextInstance('*validationManager');
  }

  public get api(): UploaderPublicApi {
    return this._getSharedContextInstance('*publicApi');
  }

  public get uploadCollection(): UploadCollectionController {
    return this._getSharedContextInstance('*uploadCollection');
  }

  public get secureUploadsManager(): SecureUploadsController {
    return this._getSharedContextInstance('*secureUploadsManager');
  }

  public get uploadController(): UploadController {
    return this._getSharedContextInstance('*uploadController');
  }

  public get uploadEvents(): UploadEventsController {
    return this._getSharedContextInstance('*uploadEvents');
  }

  public getOutputData(): OutputFileEntry[] {
    return getOutputData(this._sharedInstancesBag);
  }
}

/**
 * @deprecated Use list sources ExternalUploadSource from from blocks/utils/UploadSource.js
 */
LitUploaderBlock.extSrcList = Object.freeze({
  ...ExternalUploadSource,
});

/**
 * @deprecated Use list sources UploadSource from from blocks/utils/UploadSource.js
 */
LitUploaderBlock.sourceTypes = Object.freeze({
  ...UploadSource,
});
