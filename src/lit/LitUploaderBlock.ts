// @ts-check

import { uploaderBlockCtx } from '../abstract/CTX';
import { SecureUploadsController } from '../abstract/controllers/SecureUploadsController';
import type { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import { UploadController } from '../abstract/controllers/UploadController';
import { UploadEventsController } from '../abstract/controllers/UploadEventsController';
import { ValidationController } from '../abstract/controllers/ValidationController';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { calculateMaxCenteredCropFrame } from '../blocks/CloudImageEditor/src/crop-utils';
import { parseCropPreset } from '../blocks/CloudImageEditor/src/lib/parseCropPreset';
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import type { OutputCollectionState, OutputFileEntry, OutputFileStatus } from '../types/index';
import { createCdnUrl, createCdnUrlModifiers } from '../utils/cdn-utils';
import { ExternalUploadSource, UploadSource } from '../utils/UploadSource';
import { getOutputData } from './getOutputData';
import { LitActivityBlock } from './LitActivityBlock';
import type { Uid } from './Uid';

export class LitUploaderBlock extends LitActivityBlock {
  public static extSrcList: Readonly<typeof ExternalUploadSource>;
  public static sourceTypes: Readonly<typeof UploadSource>;
  protected couldBeCtxOwner = false;

  private _isCtxOwner = false;

  private _uploadEvents?: UploadEventsController;

  public override init$ = uploaderBlockCtx(this);

  private get _hasCtxOwner(): boolean {
    return this.hasBlockInCtx((block) => {
      if (block instanceof LitUploaderBlock) {
        return block._isCtxOwner && block.isConnected && block !== this;
      }
      return false;
    });
  }

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
          sharedInstancesBag.telemetryManager.sendEventError(error, context);
        },
        debug: (...args) => this.debugPrint(...args),
      });
    });
    // Register *publicApi before *validationManager: the ValidationController
    // resolves `sharedInstancesBag.api` (which constructs *publicApi on demand),
    // so the api factory must already be registered when validation first runs.
    this._addSharedContextInstance('*publicApi', (sharedInstancesBag) => new UploaderPublicApi(sharedInstancesBag));
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

    if (!this._hasCtxOwner && this.couldBeCtxOwner) {
      this._initCtxOwner();
    }
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

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    if (this._isCtxOwner) {
      this._uploadEvents?.unobserve();
    }
  }

  public override connectedCallback(): void {
    super.connectedCallback();

    if (this._isCtxOwner) {
      this._uploadEvents?.observe();
    }
  }

  private _initCtxOwner(): void {
    this._isCtxOwner = true;

    // The collection→events derivation lives in the DOM-free UploadEventsController;
    // this block just wires its collaborators (api, validation, plugin hooks) and
    // the v1 `*`-shared-state sinks.
    this._uploadEvents = new UploadEventsController({
      collection: this.uploadCollection,
      config: this.sharedCtx.uploaderController().config,
      validation: this.validationManager,
      emit: (type, payload, options) => this.emit(type, payload, options),
      getOutputItem: <TStatus extends OutputFileStatus>(uid: Uid) => this.api.getOutputItem<TStatus>(uid),
      getOutputCollectionState: () => this.api.getOutputCollectionState(),
      getOutputData: () => this.getOutputData(),
      buildUploadOptions: () => this.uploadController.buildUploadOptions(),
      runOnAddHooks: (entry) =>
        void this._sharedInstancesBag.wait('pluginManager').then((pluginManager) => pluginManager.runOnAddHooks(entry)),
      applyInitialCrop: () => this._setInitialCrop(),
      uploadTrigger: () => this.$['*uploadTrigger'],
      setUploadList: (list) => {
        this.$['*uploadList'] = list;
      },
      getCollectionState: () => this.$['*collectionState'],
      setCollectionState: (state) => {
        this.$['*collectionState'] = state;
      },
      getCommonProgress: () => this.$['*commonProgress'],
      setCommonProgress: (progress) => {
        this.$['*commonProgress'] = progress;
      },
      setGroupInfo: (group) => {
        this.$['*groupInfo'] = group;
      },
      getCollectionErrors: () => this.$['*collectionErrors'],
    });
    this._uploadEvents.observe();

    // Upload-queue concurrency is owned by the UploadController, which syncs it
    // from `maxConcurrentRequests` itself.
  }

  private _setInitialCrop(): void {
    const cropPreset = parseCropPreset(this.cfg.cropPreset);
    if (!cropPreset) return;

    const [aspectRatioPreset] = cropPreset;
    const entries = this.uploadCollection
      .findItems(
        (entry) =>
          !!entry.getValue('fileInfo') &&
          entry.getValue('isImage') &&
          !entry.getValue('cdnUrlModifiers')?.includes('/crop/'),
      )
      .map((id) => this.uploadCollection.read(id))
      .filter(Boolean);

    for (const entry of entries) {
      const fileInfo = entry.getValue('fileInfo');
      if (!fileInfo || !fileInfo.imageInfo) {
        console.warn('Failed to get image info for entry', entry.uid);
        continue;
      }
      const { width, height } = fileInfo.imageInfo;
      const expectedAspectRatio =
        typeof aspectRatioPreset?.width === 'number' &&
        typeof aspectRatioPreset?.height === 'number' &&
        aspectRatioPreset.width > 0 &&
        aspectRatioPreset.height > 0
          ? aspectRatioPreset.width / aspectRatioPreset.height
          : 1;

      const crop = calculateMaxCenteredCropFrame(width, height, expectedAspectRatio);
      const cdnUrlModifiers = createCdnUrlModifiers(`crop/${crop.width}x${crop.height}/${crop.x},${crop.y}`, 'preview');
      const cdnUrl = entry.getValue('cdnUrl');
      if (!cdnUrl) {
        console.warn('Failed to get cdnUrl for entry', entry.uid);
        continue;
      }
      entry.setMultipleValues({
        cdnUrlModifiers,
        cdnUrl: createCdnUrl(cdnUrl, cdnUrlModifiers),
      });
    }
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
