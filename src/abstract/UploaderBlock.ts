// @ts-check

import { Data } from '@symbiotejs/symbiote';
import { type FileFromOptions, uploadFileGroup } from '@uploadcare/upload-client';
import { calculateMaxCenteredCropFrame } from '../blocks/CloudImageEditor/src/crop-utils';
import { parseCropPreset } from '../blocks/CloudImageEditor/src/lib/parseCropPreset';
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import { debounce } from '../utils/debounce';
import { ExternalUploadSource, UploadSource } from '../utils/UploadSource';
import { customUserAgent } from '../utils/userAgent';
import type { OutputCollectionState, OutputFileEntry } from '../types/index';
import { createCdnUrl, createCdnUrlModifiers } from '../utils/cdn-utils';
import { ActivityBlock } from './ActivityBlock';
import { uploaderBlockCtx } from './CTX';
import { SecureUploadsManager } from './managers/SecureUploadsManager';
import { ValidationManager } from './managers/ValidationManager';
import { TypedCollection, type TypedCollectionObserverHandler } from './TypedCollection';
import { UploaderPublicApi } from './UploaderPublicApi';
import { type UploadEntryData, uploadEntrySchema } from './uploadEntrySchema';

export class UploaderBlock extends ActivityBlock {
  static extSrcList: Readonly<typeof ExternalUploadSource>;
  static sourceTypes: Readonly<typeof UploadSource>;
  protected couldBeCtxOwner: boolean = false;

  private isCtxOwner: boolean = false;

  private _unobserveCollection?: () => void;
  private _unobserveCollectionProperties?: () => void;

  override init$ = uploaderBlockCtx(this);

  private get hasCtxOwner(): boolean {
    return this.hasBlockInCtx((block) => {
      if (block instanceof UploaderBlock) {
        return block.isCtxOwner && block.isConnected && block !== this;
      }
      return false;
    });
  }

  override initCallback(): void {
    super.initCallback();

    if (!this.has('*uploadCollection')) {
      const uploadCollection = new TypedCollection({
        typedSchema: uploadEntrySchema,
        watchList: [
          'uploadProgress',
          'uploadError',
          'fileInfo',
          'errors',
          'cdnUrl',
          'isUploading',
          'isValidationPending',
        ],
      });
      this.add('*uploadCollection', uploadCollection);
    }

    if (!this.has('*publicApi')) {
      this.add('*publicApi', new UploaderPublicApi(this));
    }

    if (!this.has('*validationManager')) {
      this.add('*validationManager', new ValidationManager(this));
    }

    if (!this.hasCtxOwner && this.couldBeCtxOwner) {
      this._initCtxOwner();
    }
  }

  protected get validationManager(): ValidationManager {
    if (!this.has('*validationManager')) {
      throw new Error('Unexpected error: ValidationManager is not initialized');
    }
    return this.$['*validationManager'];
  }

  get api(): UploaderPublicApi {
    if (!this.has('*publicApi')) {
      throw new Error('Unexpected error: UploaderPublicApi is not initialized');
    }
    return this.$['*publicApi'];
  }

  getAPI(): UploaderPublicApi {
    return this.api;
  }

  get uploadCollection(): TypedCollection<typeof uploadEntrySchema> {
    if (!this.has('*uploadCollection')) {
      throw new Error('Unexpected error: TypedCollection is not initialized');
    }
    return this.$['*uploadCollection'];
  }

  override destroyCtxCallback(): void {
    this.uploadCollection.destroy();
    this.$['*uploadCollection'] = null;

    super.destroyCtxCallback();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    if (this.isCtxOwner) {
      this._unobserveUploadCollection();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();

    if (this.isCtxOwner) {
      this._observeUploadCollection();
    }
  }

  override destroyCallback(): void {
    super.destroyCallback();

    this._flushOutputItems.cancel();
  }

  private _initCtxOwner(): void {
    this.isCtxOwner = true;

    this._observeUploadCollection();

    this.subConfigValue('maxConcurrentRequests', (value) => {
      this.$['*uploadQueue'].concurrency = Number(value) || 1;
    });

    if (!this.$['*secureUploadsManager']) {
      this.$['*secureUploadsManager'] = new SecureUploadsManager(this);
    }
  }

  private _observeUploadCollection(): void {
    this._unobserveUploadCollection();

    this._unobserveCollection = this.uploadCollection.observeCollection(this._handleCollectionUpdate);

    this._unobserveCollectionProperties = this.uploadCollection.observeProperties(
      this._handleCollectionPropertiesUpdate,
    );
  }

  private _unobserveUploadCollection(): void {
    this._unobserveCollectionProperties?.();
    this._unobserveCollection?.();

    this._unobserveCollectionProperties = undefined;
    this._unobserveCollection = undefined;
  }

  private async _createGroup(collectionState: OutputCollectionState): Promise<void> {
    const uploadClientOptions = await this.getUploadClientOptions();
    const uuidList = collectionState.allEntries.map((entry) => {
      return entry.uuid + (entry.cdnUrlModifiers ? `/${entry.cdnUrlModifiers}` : '');
    });
    const abortController = new AbortController();
    const resp = await uploadFileGroup(uuidList, {
      ...uploadClientOptions,
      signal: abortController.signal,
    });
    if (this.$['*collectionState'] !== collectionState) {
      abortController.abort();
      return;
    }
    this.$['*groupInfo'] = resp;
    const collectionStateWithGroup = this.api.getOutputCollectionState() as OutputCollectionState<
      'success',
      'has-group'
    >;
    this.emit(EventType.GROUP_CREATED, collectionStateWithGroup);
    this.emit(EventType.CHANGE, () => this.api.getOutputCollectionState(), {
      debounce: true,
    });
    this.$['*collectionState'] = collectionStateWithGroup;
  }

  private _flushOutputItems = debounce(async () => {
    const data = this.getOutputData();
    if (data.length !== this.uploadCollection.size) {
      return;
    }
    const collectionState = this.api.getOutputCollectionState();
    this.$['*collectionState'] = collectionState;
    this.emit(EventType.CHANGE, () => this.api.getOutputCollectionState(), {
      debounce: true,
    });

    if (this.cfg.groupOutput && collectionState.totalCount > 0 && collectionState.status === 'success') {
      this._createGroup(collectionState);
    }
  }, 300);

  private _handleCollectionUpdate: TypedCollectionObserverHandler<typeof uploadEntrySchema> = (
    entries,
    added,
    removed,
  ) => {
    if (added.size || removed.size) {
      this.$['*groupInfo'] = null;
    }

    this.validationManager.runFileValidators(
      'add',
      [...added].map((e) => e.uid),
    );

    for (const entry of added) {
      if (!entry.getValue('silent')) {
        this.emit(EventType.FILE_ADDED, this.api.getOutputItem(entry.uid));
      }
    }

    this.validationManager.runCollectionValidators();

    for (const entry of removed) {
      (this.$['*uploadTrigger'] as Set<string>).delete(entry.uid);

      this.validationManager.cleanupValidationForEntry(entry);
      entry.getValue('abortController')?.abort();
      entry.setMultipleValues({
        isRemoved: true,
        abortController: null,
        isUploading: false,
        uploadProgress: 0,
      });
      const thumbUrl = entry?.getValue('thumbUrl');
      thumbUrl && URL.revokeObjectURL(thumbUrl);
      this.emit(EventType.FILE_REMOVED, this.api.getOutputItem(entry.uid));
    }

    this.$['*uploadList'] = entries.map((uid) => {
      return { uid };
    });

    this._flushCommonUploadProgress();
    this._flushOutputItems();
  };

  private _handleCollectionPropertiesUpdate = (changeMap: Record<keyof UploadEntryData, Set<string>>): void => {
    this._flushOutputItems();

    const uploadCollection = this.uploadCollection;
    const entriesToRunValidation = [
      ...new Set(
        Object.entries(changeMap)
          .filter(([key]) => ['uploadError', 'fileInfo', 'cdnUrl', 'cdnUrlModifiers'].includes(key))
          .flatMap(([, ids]) => [...ids]),
      ),
    ];

    entriesToRunValidation.length > 0 &&
      setTimeout(() => {
        // We can't modify entry properties in the same tick, so we need to wait a bit
        const entriesToRunOnUpload = entriesToRunValidation.filter(
          (entryId) => changeMap.fileInfo?.has(entryId) && !!Data.getCtx(entryId).store.fileInfo,
        );
        if (entriesToRunOnUpload.length > 0) {
          this.validationManager.runFileValidators('upload', entriesToRunOnUpload);
        }
        this.validationManager.runFileValidators('change', entriesToRunValidation);
      });

    if (changeMap.uploadProgress) {
      for (const entryId of changeMap.uploadProgress) {
        const { isUploading, silent } = Data.getCtx(entryId).store;
        if (isUploading && !silent) {
          this.emit(EventType.FILE_UPLOAD_PROGRESS, this.api.getOutputItem(entryId));
        }
      }

      this._flushCommonUploadProgress();
    }
    if (changeMap.isUploading) {
      for (const entryId of changeMap.isUploading) {
        const { isUploading, silent } = Data.getCtx(entryId).store;
        if (isUploading && !silent) {
          this.emit(EventType.FILE_UPLOAD_START, this.api.getOutputItem(entryId));
        }
      }
    }
    if (changeMap.fileInfo) {
      for (const entryId of changeMap.fileInfo) {
        const { fileInfo, silent } = Data.getCtx(entryId).store;
        if (fileInfo && !silent) {
          this.emit(EventType.FILE_UPLOAD_SUCCESS, this.api.getOutputItem(entryId));
        }
      }
      if (this.cfg.cropPreset) {
        this.setInitialCrop();
      }

      if (this.cfg.cloudImageEditorAutoOpen) {
        this.openCloudImageEditor();
      }
    }
    if (changeMap.errors) {
      this.validationManager.runCollectionValidators();

      for (const entryId of changeMap.errors) {
        const { errors } = Data.getCtx(entryId).store;
        if (errors.length > 0) {
          this.emit(EventType.FILE_UPLOAD_FAILED, this.api.getOutputItem(entryId));
          this.emit(
            EventType.COMMON_UPLOAD_FAILED,
            () => this.api.getOutputCollectionState() as OutputCollectionState<'failed'>,
            { debounce: true },
          );
        }
      }
      const loadedItems = uploadCollection.findItems((entry) => {
        return !!entry.getValue('fileInfo');
      });
      const errorItems = uploadCollection.findItems((entry) => {
        return entry.getValue('errors').length > 0;
      });
      if (
        uploadCollection.size > 0 &&
        errorItems.length === 0 &&
        uploadCollection.size === loadedItems.length &&
        this.$['*collectionErrors'].length === 0
      ) {
        this.emit(
          EventType.COMMON_UPLOAD_SUCCESS,
          this.api.getOutputCollectionState() as OutputCollectionState<'success'>,
        );
      }
    }
    if (changeMap.cdnUrl) {
      const uids = [...changeMap.cdnUrl].filter((uid) => {
        return !!this.uploadCollection.read(uid)?.getValue('cdnUrl');
      });
      uids.forEach((uid) => {
        this.emit(EventType.FILE_URL_CHANGED, this.api.getOutputItem(uid));
      });

      this.$['*groupInfo'] = null;
    }
  };

  private _flushCommonUploadProgress = (): void => {
    let commonProgress = 0;
    const uploadTrigger: Set<string> = this.$['*uploadTrigger'];
    const items = [...uploadTrigger].filter((id) => !!this.uploadCollection.read(id));
    items.forEach((id) => {
      const uploadProgress = this.uploadCollection.readProp(id, 'uploadProgress');
      if (typeof uploadProgress === 'number') {
        commonProgress += uploadProgress;
      }
    });
    const progress = items.length ? Math.round(commonProgress / items.length) : 0;

    if (this.$['*commonProgress'] === progress) {
      return;
    }

    this.$['*commonProgress'] = progress;
    this.emit(
      EventType.COMMON_UPLOAD_PROGRESS,
      this.api.getOutputCollectionState() as OutputCollectionState<'uploading'>,
    );
  };

  openCloudImageEditor(): void {
    const [entry] = this.uploadCollection
      .findItems((entry) => !!entry.getValue('fileInfo') && entry.getValue('isImage'))
      .map((id) => this.uploadCollection.read(id));

    if (
      entry &&
      this.uploadCollection.size === 1 &&
      this.cfg.useCloudImageEditor &&
      this.hasBlockInCtx((block) => block.activityType === ActivityBlock.activities.CLOUD_IMG_EDIT)
    ) {
      this.$['*currentActivityParams'] = {
        internalId: entry.uid,
      };
      this.$['*currentActivity'] = ActivityBlock.activities.CLOUD_IMG_EDIT;
      this.modalManager?.open(ActivityBlock.activities.CLOUD_IMG_EDIT);
    }
  }

  private setInitialCrop(): void {
    const cropPreset = parseCropPreset(this.cfg.cropPreset);
    if (cropPreset) {
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
        const cdnUrlModifiers = createCdnUrlModifiers(
          `crop/${crop.width}x${crop.height}/${crop.x},${crop.y}`,
          'preview',
        );
        const cdnUrl = entry.getValue('cdnUrl');
        if (!cdnUrl) {
          console.warn('Failed to get cdnUrl for entry', entry.uid);
          continue;
        }
        entry.setMultipleValues({
          cdnUrlModifiers,
          cdnUrl: createCdnUrl(cdnUrl, cdnUrlModifiers),
        });
        if (
          this.uploadCollection.size === 1 &&
          this.cfg.useCloudImageEditor &&
          this.hasBlockInCtx((block) => block.activityType === ActivityBlock.activities.CLOUD_IMG_EDIT)
        ) {
          this.$['*currentActivityParams'] = {
            internalId: entry.uid,
          };
          this.$['*currentActivity'] = ActivityBlock.activities.CLOUD_IMG_EDIT;
          this.modalManager?.open(ActivityBlock.activities.CLOUD_IMG_EDIT);
        }
      }
    }
  }

  protected async getMetadataFor(entryId: string) {
    const configValue = this.cfg.metadata || undefined;
    if (typeof configValue === 'function') {
      const outputFileEntry = this.api.getOutputItem(entryId);
      const metadata = await configValue(outputFileEntry);
      return metadata;
    }
    return configValue;
  }

  protected async getUploadClientOptions(): Promise<FileFromOptions> {
    const secureUploadsManager: SecureUploadsManager = this.$['*secureUploadsManager'];
    const secureToken = await secureUploadsManager.getSecureToken().catch(() => null);

    const options = {
      store: this.cfg.store,
      publicKey: this.cfg.pubkey,
      baseCDN: this.cfg.cdnCname,
      baseURL: this.cfg.baseUrl,
      userAgent: customUserAgent,
      integration: this.cfg.userAgentIntegration,
      secureSignature: secureToken?.secureSignature,
      secureExpire: secureToken?.secureExpire,
      retryThrottledRequestMaxTimes: this.cfg.retryThrottledRequestMaxTimes,
      retryNetworkErrorMaxTimes: this.cfg.retryNetworkErrorMaxTimes,
      multipartMinFileSize: this.cfg.multipartMinFileSize,
      multipartChunkSize: this.cfg.multipartChunkSize,
      maxConcurrentRequests: this.cfg.multipartMaxConcurrentRequests,
      multipartMaxAttempts: this.cfg.multipartMaxAttempts,
      checkForUrlDuplicates: !!this.cfg.checkForUrlDuplicates,
      saveUrlForRecurrentUploads: !!this.cfg.saveUrlForRecurrentUploads,
    };

    return options;
  }

  getOutputData(): OutputFileEntry[] {
    const entriesIds = this.uploadCollection.items();
    const data = entriesIds.map((itemId) => this.api.getOutputItem(itemId));
    return data;
  }
}

/**
 * @deprecated Use list sources ExternalUploadSource from from blocks/utils/UploadSource.js
 */
UploaderBlock.extSrcList = Object.freeze({
  ...ExternalUploadSource,
});

/**
 * @deprecated Use list sources UploadSource from from blocks/utils/UploadSource.js
 */
UploaderBlock.sourceTypes = Object.freeze({
  ...UploadSource,
});
