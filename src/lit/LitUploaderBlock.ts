// @ts-check

import { type FileFromOptions, uploadFileGroup } from '@uploadcare/upload-client';
import { uploaderBlockCtx } from '../abstract/CTX';
import type { TypedCollectionObserverHandler } from '../abstract/TypedCollection';
import type { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import type { UploadEntryData } from '../abstract/uploadEntrySchema';
import { calculateMaxCenteredCropFrame } from '../blocks/CloudImageEditor/src/crop-utils';
import { parseCropPreset } from '../blocks/CloudImageEditor/src/lib/parseCropPreset';
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import type { OutputCollectionState, OutputFileEntry } from '../types/index';
import { createCdnUrl, createCdnUrlModifiers } from '../utils/cdn-utils';
import { debounce } from '../utils/debounce';
import { ExternalUploadSource, UploadSource } from '../utils/UploadSource';
import { customUserAgent } from '../utils/userAgent';
import { getOutputData } from './getOutputData';
import { LitActivityBlock } from './LitActivityBlock';
import { PubSub } from './PubSubCompat';
import type { Uid } from './Uid';

export class LitUploaderBlock extends LitActivityBlock {
  public static extSrcList: Readonly<typeof ExternalUploadSource>;
  public static sourceTypes: Readonly<typeof UploadSource>;
  protected couldBeCtxOwner = false;

  private _isCtxOwner = false;

  private _unobserveCollection?: () => void;
  private _unobserveCollectionProperties?: () => void;

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

    if (!this._hasCtxOwner && this.couldBeCtxOwner) {
      this._initCtxOwner();
    }
  }

  public getAPI(): UploaderPublicApi {
    return this.api;
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    if (this._isCtxOwner) {
      this._unobserveUploadCollection();
    }

    this._flushOutputItems.cancel();
  }

  public override connectedCallback(): void {
    super.connectedCallback();

    if (this._isCtxOwner) {
      this._observeUploadCollection();
    }
  }

  private _initCtxOwner(): void {
    this._isCtxOwner = true;

    this._observeUploadCollection();

    this.subConfigValue('maxConcurrentRequests', (value) => {
      this.$['*uploadQueue'].concurrency = Number(value) || 1;
    });
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

  private _handleCollectionUpdate: TypedCollectionObserverHandler<UploadEntryData> = (entries, added, removed) => {
    if (!this.isConnected) return;
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
      this.$['*uploadTrigger'].delete(entry.uid);

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

  private _handleCollectionPropertiesUpdate = (changeMap: Record<keyof UploadEntryData, Set<Uid>>): void => {
    if (!this.isConnected) return;
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
        if (!this.isConnected) return;
        // We can't modify entry properties in the same tick, so we need to wait a bit
        const entriesToRunOnUpload = entriesToRunValidation.filter(
          (entryId) => changeMap.fileInfo?.has(entryId) && !!PubSub.getCtx(entryId)?.store.fileInfo,
        );
        if (entriesToRunOnUpload.length > 0) {
          this.validationManager.runFileValidators('upload', entriesToRunOnUpload);
        }
        this.validationManager.runFileValidators('change', entriesToRunValidation);
      });

    if (changeMap.uploadProgress) {
      for (const entryId of changeMap.uploadProgress) {
        const ctx = PubSub.getCtx<UploadEntryData>(entryId);
        if (!ctx) continue;
        const { isUploading, silent } = ctx.store;
        if (isUploading && !silent) {
          this.emit(EventType.FILE_UPLOAD_PROGRESS, this.api.getOutputItem(entryId));
        }
      }

      this._flushCommonUploadProgress();
    }
    if (changeMap.isUploading) {
      for (const entryId of changeMap.isUploading) {
        const ctx = PubSub.getCtx<UploadEntryData>(entryId);
        if (!ctx) continue;
        const { isUploading, silent } = ctx.store;
        if (isUploading && !silent) {
          this.emit(EventType.FILE_UPLOAD_START, this.api.getOutputItem(entryId));
        }
      }
    }
    if (changeMap.fileInfo) {
      for (const entryId of changeMap.fileInfo) {
        const ctx = PubSub.getCtx<UploadEntryData>(entryId);
        if (!ctx) continue;
        const { fileInfo, silent } = ctx.store;
        if (fileInfo && !silent) {
          this.emit(EventType.FILE_UPLOAD_SUCCESS, this.api.getOutputItem(entryId));
        }
      }
      if (this.cfg.cropPreset) {
        this._setInitialCrop();
      }

      if (this.cfg.cloudImageEditorAutoOpen) {
        this._openCloudImageEditor();
      }
    }
    if (changeMap.errors) {
      this.validationManager.runCollectionValidators();

      for (const entryId of changeMap.errors) {
        const ctx = PubSub.getCtx<UploadEntryData>(entryId);
        if (!ctx) continue;
        const { errors } = ctx.store;
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
    const uploadTrigger = this.$['*uploadTrigger'];
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

  private _openCloudImageEditor(): void {
    const [entry] = this.uploadCollection
      .findItems((entry) => !!entry.getValue('fileInfo') && entry.getValue('isImage'))
      .map((id) => this.uploadCollection.read(id));

    if (
      entry &&
      this.uploadCollection.size === 1 &&
      this.cfg.useCloudImageEditor &&
      this.hasBlockInCtx((block) => block.activityType === LitActivityBlock.activities.CLOUD_IMG_EDIT)
    ) {
      this.$['*currentActivityParams'] = {
        internalId: entry.uid,
      };
      this.$['*currentActivity'] = LitActivityBlock.activities.CLOUD_IMG_EDIT;
      this.modalManager?.open(LitActivityBlock.activities.CLOUD_IMG_EDIT);
    }
  }

  private _setInitialCrop(): void {
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
          this.hasBlockInCtx((block) => block.activityType === LitActivityBlock.activities.CLOUD_IMG_EDIT)
        ) {
          this.$['*currentActivityParams'] = {
            internalId: entry.uid,
          };
          this.$['*currentActivity'] = LitActivityBlock.activities.CLOUD_IMG_EDIT;
          this.modalManager?.open(LitActivityBlock.activities.CLOUD_IMG_EDIT);
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
    const secureToken = await this.secureUploadsManager.getSecureToken().catch(() => null);

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
