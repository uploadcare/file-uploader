// @ts-check

import { uploaderBlockCtx } from '../abstract/CTX';
// Value imports on purpose: this element hands the four upload-stack
// constructors to `UploaderController.attachUploaderScope` — the controller
// itself only type-imports them, keeping editor-only bundles (which have no
// `LitUploaderBlock`) free of `@uploadcare/upload-client` and friends.
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

  public override init$ = uploaderBlockCtx();

  public override initCallback(): void {
    super.initCallback();

    // The upload collection is owned by the per-ctx UploaderController; the
    // shared instance resolves to it so all blocks share one source of truth.
    this._addSharedContextInstance('*uploadCollection', () => this.sharedCtx.uploaderController().collection);

    // Register *publicApi before attaching the uploader scope:
    // `_addSharedContextInstance` runs its resolver eagerly, right here, not
    // lazily on first read — so *publicApi must already exist by the time
    // `sharedInstancesBag.api` is first resolved. `ValidationController`'s
    // ctor SCHEDULES `_runAllValidators` (debounce(0), a macrotask), so the
    // `getApi` read lands after this initCallback's sync frame — registering
    // *publicApi anywhere in this frame suffices, but keeping it first also
    // serves `setApi` below, which clipboard needs before any paste can arm.
    // Also hand it straight to the controller (`setApi`) — the DOM-free
    // `ClipboardController` (constructed by `UploaderController`, M9l) needs it
    // for its add-file callbacks, but only the DOM layer can construct
    // `UploaderPublicApi` (it needs the shared-instances bag).
    this._addSharedContextInstance('*publicApi', (sharedInstancesBag) => {
      const api = new UploaderPublicApi(sharedInstancesBag);
      this.sharedCtx.uploaderController().setApi(api);
      return api;
    });

    // `SecureUploadsController`, `UploadController`, `ValidationController`,
    // and `UploadEventsController` are constructed by `UploaderController`
    // itself (`attachUploaderScope`, M9m) — behind the uploader-present gate,
    // idempotent (first uploader block to connect wins, matching the old
    // `_addSharedContextInstance` first-write-wins semantics). This element
    // only supplies the callbacks that must stay DOM/PubSub-side.
    const uploader = this.sharedCtx.uploaderController();
    const ctx = this._sharedInstancesBag.ctx;
    uploader.attachUploaderScope({
      controllers: { SecureUploadsController, UploadController, ValidationController, UploadEventsController },
      debug: (...args) => this.debugPrint(...args),
      getFileHooks: () => this._sharedInstancesBag.pluginManager?.snapshot().fileHooks ?? [],
      getOutputItem: <TStatus extends OutputFileStatus>(uid: Uid) =>
        this._sharedInstancesBag.api.getOutputItem<TStatus>(uid),
      getApi: () => this._sharedInstancesBag.api,
      setCollectionErrors: (errors) => {
        this.$['*collectionErrors'] = errors;
      },
      emitCommonUploadFailed: () => {
        this._sharedInstancesBag.eventEmitter.emit(
          EventType.COMMON_UPLOAD_FAILED,
          () => this._sharedInstancesBag.api.getOutputCollectionState() as OutputCollectionState<'failed'>,
          { debounce: true },
        );
      },
      // Emit parity with LitBlock.emit: EventEmitter dispatch + telemetry
      // mirror, guarded for teardown (emissions can race ctx destruction).
      emit: (type, payload, options) => {
        const eventEmitter = ctx.has('*eventEmitter') ? ctx.read('*eventEmitter') : undefined;
        if (!eventEmitter) return;
        eventEmitter.emit(type, payload, options);
        const resolvedPayload = typeof payload === 'function' ? payload() : payload;
        try {
          this._sharedInstancesBag.telemetryManager.sendEvent({
            eventType: type,
            payload: (resolvedPayload ?? undefined) as Record<string, unknown> | undefined,
          });
        } catch (err) {
          this.debugPrint('telemetry unavailable for an upload event report', err);
        }
      },
      getOutputCollectionState: () => this._sharedInstancesBag.api.getOutputCollectionState(),
      getOutputData: () => getOutputData(this._sharedInstancesBag),
      runOnAddHooks: (entry) =>
        void this._sharedInstancesBag.wait('pluginManager').then((pluginManager) => pluginManager.runOnAddHooks(entry)),
      uploadTrigger: () => ctx.read('*uploadTrigger'),
      setUploadList: (list) => ctx.pub('*uploadList', list),
      getCollectionState: () => ctx.read('*collectionState'),
      setCollectionState: (state) => ctx.pub('*collectionState', state),
      getCommonProgress: () => ctx.read('*commonProgress'),
      setCommonProgress: (progress) => ctx.pub('*commonProgress', progress),
      setGroupInfo: (group) => ctx.pub('*groupInfo', group),
      getCollectionErrors: () => ctx.read('*collectionErrors'),
    });

    // The four are now controller-owned identity — these re-exposers just
    // let existing shared-instance readers (`this.secureUploadsManager`, …)
    // keep working unchanged.
    this._addSharedContextInstance(
      '*secureUploadsManager',
      () => this.sharedCtx.uploaderController().secureUploadsManager,
    );
    this._addSharedContextInstance('*uploadController', () => this.sharedCtx.uploaderController().uploadController);
    this._addSharedContextInstance('*validationManager', () => this.sharedCtx.uploaderController().validationManager);
    this._addSharedContextInstance('*uploadEvents', () => this.sharedCtx.uploaderController().uploadEvents);
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
