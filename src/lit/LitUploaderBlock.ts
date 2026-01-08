// @ts-check

import type { FileFromOptions } from '@uploadcare/upload-client';
import { uploaderBlockCtx } from '../abstract/CTX';
import { SecureUploadsManager } from '../abstract/managers/SecureUploadsManager';
import { ValidationManager } from '../abstract/managers/ValidationManager';
import { TypedCollection, type TypedCollectionObserverHandler } from '../abstract/TypedCollection';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { initialUploadEntryData, type UploadEntryData } from '../abstract/uploadEntrySchema';

import type { OutputFileEntry } from '../types/index';

import { ExternalUploadSource, UploadSource } from '../utils/UploadSource';
import { customUserAgent } from '../utils/userAgent';

import { CloudImageEditorController } from './controllers/cloudImageEditorController';
import { CollectionController } from './controllers/collectionController';
import { getOutputData } from './getOutputData';
import { LitActivityBlock } from './LitActivityBlock';
import type { Uid } from './Uid';

export class LitUploaderBlock extends LitActivityBlock {
  public static extSrcList: Readonly<typeof ExternalUploadSource>;
  public static sourceTypes: Readonly<typeof UploadSource>;
  protected couldBeCtxOwner = false;

  private _isCtxOwner = false;

  private _unobserveCollection?: () => void;
  private _unobserveCollectionProperties?: () => void;

  public override init$ = uploaderBlockCtx(this);

  private readonly _collectionController!: CollectionController;

  private get _hasCtxOwner(): boolean {
    return this.hasBlockInCtx((block) => {
      if (block instanceof LitUploaderBlock) {
        return block._isCtxOwner && block.isConnected && block !== this;
      }
      return false;
    });
  }

  public constructor() {
    super();
    this._collectionController = new CollectionController(this, new CloudImageEditorController(this));
  }

  public override initCallback(): void {
    super.initCallback();

    this._addSharedContextInstance('*uploadCollection', () => {
      return new TypedCollection<UploadEntryData>({
        initialValue: initialUploadEntryData,
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
    });

    this._addSharedContextInstance(
      '*secureUploadsManager',
      (sharedInstancesBag) => new SecureUploadsManager(sharedInstancesBag),
    );
    this._addSharedContextInstance(
      '*validationManager',
      (sharedInstancesBag) => new ValidationManager(sharedInstancesBag),
    );
    this._addSharedContextInstance('*publicApi', (sharedInstancesBag) => new UploaderPublicApi(sharedInstancesBag));

    if (!this._hasCtxOwner && this.couldBeCtxOwner) {
      this._initCtxOwner();
    }
  }

  public getAPI(): UploaderPublicApi {
    return this.api;
  }

  public get validationManager(): ValidationManager {
    return this._getSharedContextInstance('*validationManager');
  }

  public get api(): UploaderPublicApi {
    return this._getSharedContextInstance('*publicApi');
  }

  public get uploadCollection(): TypedCollection<UploadEntryData> {
    return this._getSharedContextInstance('*uploadCollection');
  }

  public get secureUploadsManager(): SecureUploadsManager {
    return this._getSharedContextInstance('*secureUploadsManager');
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    if (this._isCtxOwner) {
      this._unobserveUploadCollection();
    }

    this._collectionController.flushOutputItems.cancel();
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
      this.sharedCtx.read(`*uploadQueue`).concurrency = Number(value) || 1;
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

  private _handleCollectionUpdate: TypedCollectionObserverHandler<UploadEntryData> = (entries, added, removed) => {
    this._collectionController.handleCollectionUpdate(entries, added, removed);
    this._collectionController.flushCommonUploadProgress();
    this._collectionController.flushOutputItems();
  };

  private _handleCollectionPropertiesUpdate = (changeMap: Record<keyof UploadEntryData, Set<Uid>>): void => {
    this._collectionController.handleCollectionPropertiesUpdate(changeMap);
  };

  // TODO refactor: move to CollectionController
  protected async getMetadataFor(entryId: string) {
    const configValue = this.cfg.metadata || undefined;
    if (typeof configValue === 'function') {
      const outputFileEntry = this.api.getOutputItem(entryId);
      const metadata = await configValue(outputFileEntry);
      return metadata;
    }
    return configValue;
  }

  // TODO refactor: move to CollectionController
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

  // TODO refactor: move to CollectionController
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
