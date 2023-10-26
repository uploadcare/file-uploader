// @ts-check
import { ActivityBlock } from './ActivityBlock.js';

import { Data } from '@symbiotejs/symbiote';
import { calculateMaxCenteredCropFrame } from '../blocks/CloudImageEditor/src/crop-utils.js';
import { parseCropPreset } from '../blocks/CloudImageEditor/src/lib/parseCropPreset.js';
import { UploadSource } from '../blocks/utils/UploadSource.js';
import { serializeCsv } from '../blocks/utils/comma-separated.js';
import { debounce } from '../blocks/utils/debounce.js';
import { customUserAgent } from '../blocks/utils/userAgent.js';
import { createCdnUrl, createCdnUrlModifiers } from '../utils/cdn-utils.js';
import { IMAGE_ACCEPT_LIST, fileIsImage, matchExtension, matchMimeType, mergeFileTypes } from '../utils/fileTypes.js';
import { prettyBytes } from '../utils/prettyBytes.js';
import { stringToArray } from '../utils/stringToArray.js';
import { warnOnce } from '../utils/warnOnce.js';
import { uploaderBlockCtx } from './CTX.js';
import { EVENT_TYPES, EventData, EventManager } from './EventManager.js';
import { TypedCollection } from './TypedCollection.js';
import { uploadEntrySchema } from './uploadEntrySchema.js';

export class UploaderBlock extends ActivityBlock {
  couldBeUploadCollectionOwner = false;
  isUploadCollectionOwner = false;

  init$ = uploaderBlockCtx(this);

  /** @private */
  __initialUploadMetadata = null;

  /** @private */
  _validators = [
    this._validateMultipleLimit.bind(this),
    this._validateIsImage.bind(this),
    this._validateFileType.bind(this),
    this._validateMaxSizeLimit.bind(this),
  ];

  /**
   * This is Public JS API method. Could be called before block initialization, so we need to delay state interactions
   * until block init.
   *
   * TODO: If we add more public methods, it is better to use the single queue instead of tons of private fields per
   * each method. See https://github.com/uploadcare/blocks/pull/162/
   *
   * @deprecated Use `metadata` instance property on `lr-config` block instead.
   * @param {import('@uploadcare/upload-client').Metadata} metadata
   * @public
   */
  setUploadMetadata(metadata) {
    warnOnce(
      'setUploadMetadata is deprecated. Use `metadata` instance property on `lr-config` block instead. See migration guide: https://uploadcare.com/docs/file-uploader/migration-to-0.25.0/'
    );
    if (!this.connectedOnce) {
      // @ts-ignore TODO: fix this
      this.__initialUploadMetadata = metadata;
    } else {
      this.$['*uploadMetadata'] = metadata;
    }
  }

  initCallback() {
    super.initCallback();

    if (!this.has('*uploadCollection')) {
      let uploadCollection = new TypedCollection({
        typedSchema: uploadEntrySchema,
        watchList: [
          'uploadProgress',
          'fileInfo',
          'uploadError',
          'validationErrorMsg',
          'validationMultipleLimitMsg',
          'cdnUrlModifiers',
        ],
      });
      this.add('*uploadCollection', uploadCollection);
    }

    const hasUploadCollectionOwner = () =>
      this.hasBlockInCtx((block) => {
        if (block instanceof UploaderBlock) {
          return block.isUploadCollectionOwner && block.isConnected && block !== this;
        }
        return false;
      });

    if (this.couldBeUploadCollectionOwner && !hasUploadCollectionOwner()) {
      this.isUploadCollectionOwner = true;

      /** @private */
      this._unobserveCollection = this.uploadCollection.observeCollection(this._handleCollectonUpdate);

      /** @private */
      this._unobserveCollectionProperties = this.uploadCollection.observeProperties(
        this._handleCollectionPropertiesUpdate
      );

      this.subConfigValue('maxLocalFileSizeBytes', () => this._debouncedRunValidators());
      this.subConfigValue('multipleMin', () => this._debouncedRunValidators());
      this.subConfigValue('multipleMax', () => this._debouncedRunValidators());
      this.subConfigValue('multiple', () => this._debouncedRunValidators());
      this.subConfigValue('imgOnly', () => this._debouncedRunValidators());
      this.subConfigValue('accept', () => this._debouncedRunValidators());
    }

    if (this.__initialUploadMetadata) {
      this.$['*uploadMetadata'] = this.__initialUploadMetadata;
    }

    this.subConfigValue('maxConcurrentRequests', (value) => {
      this.$['*uploadQueue'].concurrency = Number(value) || 1;
    });
  }

  destroyCallback() {
    super.destroyCallback();
    if (this.isUploadCollectionOwner) {
      this._unobserveCollectionProperties?.();
      this._unobserveCollection?.();
    }
  }

  // TODO: Probably we should not allow user to override `source` property

  /**
   * @param {string} url
   * @param {{ silent?: boolean; fileName?: string; source?: string }} [options]
   */
  addFileFromUrl(url, { silent, fileName, source } = {}) {
    this.uploadCollection.add({
      externalUrl: url,
      fileName: fileName ?? null,
      silentUpload: silent ?? false,
      source: source ?? UploadSource.API,
    });
  }

  /**
   * @param {string} uuid
   * @param {{ silent?: boolean; fileName?: string; source?: string }} [options]
   */
  addFileFromUuid(uuid, { silent, fileName, source } = {}) {
    this.uploadCollection.add({
      uuid,
      fileName: fileName ?? null,
      silentUpload: silent ?? false,
      source: source ?? UploadSource.API,
    });
  }

  /**
   * @param {File} file
   * @param {{ silent?: boolean; fileName?: string; source?: string; fullPath?: string }} [options]
   */
  addFileFromObject(file, { silent, fileName, source, fullPath } = {}) {
    this.uploadCollection.add({
      file,
      isImage: fileIsImage(file),
      mimeType: file.type,
      fileName: fileName ?? file.name,
      fileSize: file.size,
      silentUpload: silent ?? false,
      source: source ?? UploadSource.API,
      fullPath: fullPath ?? null,
    });
  }

  /**
   * @deprecated Will be removed in the near future. Please use `addFileFromObject`, `addFileFromUrl` or
   *   `addFileFromUuid` instead.
   * @param {File[]} files
   */
  addFiles(files) {
    console.warn(
      '`addFiles` method is deprecated. Please use `addFileFromObject`, `addFileFromUrl` or `addFileFromUuid` instead.'
    );
    files.forEach((/** @type {File} */ file) => {
      this.uploadCollection.add({
        file,
        isImage: fileIsImage(file),
        mimeType: file.type,
        fileName: file.name,
        fileSize: file.size,
      });
    });
  }

  uploadAll() {
    this.$['*uploadTrigger'] = {};
  }

  /** @param {{ captureCamera?: boolean }} options */
  openSystemDialog(options = {}) {
    let accept = serializeCsv(mergeFileTypes([this.cfg.accept ?? '', ...(this.cfg.imgOnly ? IMAGE_ACCEPT_LIST : [])]));

    if (this.cfg.accept && !!this.cfg.imgOnly) {
      console.warn(
        'There could be a mistake.\n' +
          'Both `accept` and `imgOnly` parameters are set.\n' +
          'The value of `accept` will be concatenated with the internal image mime types list.'
      );
    }
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.multiple = this.cfg.multiple;
    if (options.captureCamera) {
      this.fileInput.capture = '';
      this.fileInput.accept = serializeCsv(IMAGE_ACCEPT_LIST);
    } else {
      this.fileInput.accept = accept;
    }
    this.fileInput.dispatchEvent(new MouseEvent('click'));
    this.fileInput.onchange = () => {
      // @ts-ignore TODO: fix this
      [...this.fileInput['files']].forEach((file) => this.addFileFromObject(file, { source: UploadSource.LOCAL }));
      // To call uploadTrigger UploadList should draw file items first:
      this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
      this.setOrAddState('*modalActive', true);
      // @ts-ignore TODO: fix this
      this.fileInput['value'] = '';
      this.fileInput = null;
    };
  }

  /** @type {string[]} */
  get sourceList() {
    /** @type {string[]} */
    let list = [];
    if (this.cfg.sourceList) {
      list = stringToArray(this.cfg.sourceList);
    }
    // @ts-ignore TODO: fix this
    return list;
  }

  /** @param {Boolean} [force] */
  initFlow(force = false) {
    if (this.uploadCollection.size > 0 && !force) {
      this.set$({
        '*currentActivity': ActivityBlock.activities.UPLOAD_LIST,
      });
      this.setOrAddState('*modalActive', true);
    } else {
      if (this.sourceList?.length === 1) {
        let srcKey = this.sourceList[0];
        // Single source case:
        if (srcKey === 'local') {
          this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
          this?.['openSystemDialog']();
        } else {
          if (Object.values(UploaderBlock.extSrcList).includes(/** @type {any} */ (srcKey))) {
            this.set$({
              '*currentActivityParams': {
                externalSourceType: srcKey,
              },
              '*currentActivity': ActivityBlock.activities.EXTERNAL,
            });
          } else {
            this.$['*currentActivity'] = srcKey;
          }
          this.setOrAddState('*modalActive', true);
        }
      } else {
        // Multiple sources case:
        this.set$({
          '*currentActivity': ActivityBlock.activities.START_FROM,
        });
        this.setOrAddState('*modalActive', true);
      }
    }
    EventManager.emit(
      new EventData({
        type: EVENT_TYPES.INIT_FLOW,
        ctx: this.ctxName,
      }),
      undefined,
      false
    );
  }

  doneFlow() {
    this.set$({
      '*currentActivity': this.doneActivity,
      '*history': this.doneActivity ? [this.doneActivity] : [],
    });
    if (!this.$['*currentActivity']) {
      this.setOrAddState('*modalActive', false);
    }
    EventManager.emit(
      new EventData({
        type: EVENT_TYPES.DONE_FLOW,
        ctx: this.ctxName,
      }),
      undefined,
      false
    );
  }

  /** @returns {TypedCollection} */
  get uploadCollection() {
    return this.$['*uploadCollection'];
  }

  /**
   * @private
   * @param {import('./TypedData.js').TypedData} entry
   */
  _validateFileType(entry) {
    const imagesOnly = this.cfg.imgOnly;
    const accept = this.cfg.accept;
    const allowedFileTypes = mergeFileTypes([...(imagesOnly ? IMAGE_ACCEPT_LIST : []), accept]);
    if (!allowedFileTypes.length) return;

    const mimeType = entry.getValue('mimeType');
    const fileName = entry.getValue('fileName');

    if (!mimeType || !fileName) {
      // Skip client validation if mime type or file name are not available for some reasons
      return;
    }

    const mimeOk = matchMimeType(mimeType, allowedFileTypes);
    const extOk = matchExtension(fileName, allowedFileTypes);

    if (!mimeOk && !extOk) {
      // Assume file type is not allowed if both mime and ext checks fail
      return this.l10n('file-type-not-allowed');
    }
  }

  /**
   * @private
   * @param {import('./TypedData.js').TypedData} entry
   */
  _validateMaxSizeLimit(entry) {
    const maxFileSize = this.cfg.maxLocalFileSizeBytes;
    const fileSize = entry.getValue('fileSize');
    if (maxFileSize && fileSize && fileSize > maxFileSize) {
      return this.l10n('files-max-size-limit-error', { maxFileSize: prettyBytes(maxFileSize) });
    }
  }

  /**
   * @private
   * @param {import('./TypedData.js').TypedData} entry
   */
  _validateMultipleLimit(entry) {
    const entryIds = this.uploadCollection.items();
    const entryIdx = entryIds.indexOf(entry.uid);
    const multipleMin = this.cfg.multiple ? this.cfg.multipleMin : 1;
    const multipleMax = this.cfg.multiple ? this.cfg.multipleMax : 1;

    if (multipleMin && entryIds.length < multipleMin) {
      const message = this.l10n('files-count-minimum', {
        count: multipleMin,
      });
      return message;
    }

    if (multipleMax && entryIdx >= multipleMax) {
      const message = this.l10n('files-count-allowed', {
        count: multipleMax,
      });
      return message;
    }
  }

  /**
   * @private
   * @param {import('./TypedData.js').TypedData} entry
   */
  _validateIsImage(entry) {
    const imagesOnly = this.cfg.imgOnly;
    const isImage = entry.getValue('isImage');
    if (!imagesOnly || isImage) {
      return;
    }
    if (!entry.getValue('fileInfo') && entry.getValue('externalUrl')) {
      // skip validation for not uploaded files with external url, cause we don't know if they're images or not
      return;
    }
    if (!entry.getValue('fileInfo') && !entry.getValue('mimeType')) {
      // skip validation for not uploaded files without mime-type, cause we don't know if they're images or not
      return;
    }
    return this.l10n('images-only-accepted');
  }

  /**
   * @private
   * @param {import('./TypedData.js').TypedData} entry
   */
  _runValidatorsForEntry(entry) {
    for (const validator of this._validators) {
      const errorMsg = validator(entry);
      if (errorMsg) {
        entry.setValue('validationErrorMsg', errorMsg);
        return;
      }
    }
    entry.setValue('validationErrorMsg', null);
  }

  /** @private */
  _debouncedRunValidators = debounce(this._runValidators.bind(this), 100);

  /** @private */
  _runValidators() {
    for (const id of this.uploadCollection.items()) {
      setTimeout(() => {
        const entry = this.uploadCollection.read(id);
        entry && this._runValidatorsForEntry(entry);
      });
    }
  }

  /** @private */
  _flushOutputItems = debounce(() => {
    const data = this.getOutputData();
    if (data.length !== this.uploadCollection.size) {
      return;
    }
    EventManager.emit(
      new EventData({
        type: EVENT_TYPES.DATA_OUTPUT,
        // @ts-ignore TODO: fix this
        ctx: this.ctxName,
        // @ts-ignore TODO: fix this
        data,
      })
    );
    // @ts-ignore TODO: fix this
    this.$['*outputData'] = data;
  }, 100);

  /**
   * @private
   * @type {Parameters<import('./TypedCollection.js').TypedCollection['observeCollection']>[0]}
   */
  _handleCollectonUpdate = (entries, added, removed) => {
    this._runValidators();

    for (let entry of removed) {
      entry?.getValue('abortController')?.abort();
      entry?.setValue('abortController', null);
      URL.revokeObjectURL(entry?.getValue('thumbUrl'));
    }
    this.$['*uploadList'] = entries.map((uid) => {
      return { uid };
    });
    this._flushOutputItems();
  };

  /**
   * @private
   * @param {Record<string, any>} changeMap
   */
  _handleCollectionPropertiesUpdate = (changeMap) => {
    this._flushOutputItems();

    const uploadCollection = this.uploadCollection;
    const updatedEntries = [
      ...new Set(
        Object.values(changeMap)
          .map((ids) => [...ids])
          .flat()
      ),
    ]
      .map((id) => uploadCollection.read(id))
      .filter(Boolean);

    for (const entry of updatedEntries) {
      this._runValidatorsForEntry(entry);
    }
    if (changeMap.uploadProgress) {
      let commonProgress = 0;
      /** @type {String[]} */
      let items = uploadCollection.findItems((entry) => {
        return !entry.getValue('uploadError');
      });
      items.forEach((id) => {
        commonProgress += uploadCollection.readProp(id, 'uploadProgress');
      });
      let progress = Math.round(commonProgress / items.length);
      this.$['*commonProgress'] = progress;
      EventManager.emit(
        new EventData({
          type: EVENT_TYPES.UPLOAD_PROGRESS,
          ctx: this.ctxName,
          data: progress,
        }),
        undefined,
        progress === 100
      );
    }
    if (changeMap.fileInfo) {
      if (this.cfg.cropPreset) {
        this.setInitialCrop();
      }
      let loadedItems = uploadCollection.findItems((entry) => {
        return !!entry.getValue('fileInfo');
      });
      let errorItems = uploadCollection.findItems((entry) => {
        return !!entry.getValue('uploadError') || !!entry.getValue('validationErrorMsg');
      });
      if (uploadCollection.size - errorItems.length === loadedItems.length) {
        let data = this.getOutputData((dataItem) => {
          return !!dataItem.getValue('fileInfo') && !dataItem.getValue('silentUpload');
        });
        data.length > 0 &&
          EventManager.emit(
            new EventData({
              type: EVENT_TYPES.UPLOAD_FINISH,
              ctx: this.ctxName,
              data,
            })
          );
      }
    }
    if (changeMap.uploadError) {
      let items = uploadCollection.findItems((entry) => {
        return !!entry.getValue('uploadError');
      });
      items.forEach((id) => {
        EventManager.emit(
          new EventData({
            type: EVENT_TYPES.UPLOAD_ERROR,
            ctx: this.ctxName,
            data: uploadCollection.readProp(id, 'uploadError'),
          }),
          undefined,
          false
        );
      });
    }
    if (changeMap.validationErrorMsg) {
      let items = uploadCollection.findItems((entry) => {
        return !!entry.getValue('validationErrorMsg');
      });
      items.forEach((id) => {
        EventManager.emit(
          new EventData({
            type: EVENT_TYPES.VALIDATION_ERROR,
            ctx: this.ctxName,
            data: uploadCollection.readProp(id, 'validationErrorMsg'),
          }),
          undefined,
          false
        );
      });
    }
    if (changeMap.cdnUrlModifiers) {
      let items = uploadCollection.findItems((entry) => {
        return !!entry.getValue('cdnUrlModifiers');
      });
      items.forEach((id) => {
        EventManager.emit(
          new EventData({
            type: EVENT_TYPES.CLOUD_MODIFICATION,
            ctx: this.ctxName,
            data: Data.getCtx(id).store,
          }),
          undefined,
          false
        );
      });
    }
  };

  /** @private */
  setInitialCrop() {
    const cropPreset = parseCropPreset(this.cfg.cropPreset);
    if (cropPreset) {
      const [aspectRatioPreset] = cropPreset;

      const entries = this.uploadCollection
        .findItems(
          (entry) =>
            entry.getValue('fileInfo') &&
            entry.getValue('isImage') &&
            !entry.getValue('cdnUrlModifiers')?.includes('/crop/')
        )
        .map((id) => this.uploadCollection.read(id));

      for (const entry of entries) {
        const fileInfo = entry.getValue('fileInfo');
        const { width, height } = fileInfo.imageInfo;
        const expectedAspectRatio = aspectRatioPreset.width / aspectRatioPreset.height;
        const crop = calculateMaxCenteredCropFrame(width, height, expectedAspectRatio);
        const cdnUrlModifiers = createCdnUrlModifiers(
          `crop/${crop.width}x${crop.height}/${crop.x},${crop.y}`,
          'preview'
        );
        entry.setMultipleValues({
          cdnUrlModifiers,
          cdnUrl: createCdnUrl(entry.getValue('cdnUrl'), cdnUrlModifiers),
        });
        if (
          this.uploadCollection.size === 1 &&
          this.cfg.useCloudImageEditor &&
          this.hasBlockInCtx((block) => block.activityType === ActivityBlock.activities.CLOUD_IMG_EDIT)
        ) {
          this.$['*focusedEntry'] = entry;
          this.$['*currentActivity'] = ActivityBlock.activities.CLOUD_IMG_EDIT;
        }
      }
    }
  }

  /** @private */
  async getMetadata() {
    const configValue = this.cfg.metadata ?? /** @type {import('../types').Metadata} */ (this.$['*uploadMetadata']);
    if (typeof configValue === 'function') {
      const metadata = await configValue();
      return metadata;
    }
    return configValue;
  }

  /** @returns {Promise<import('@uploadcare/upload-client').FileFromOptions>} */
  async getUploadClientOptions() {
    let options = {
      store: this.cfg.store,
      publicKey: this.cfg.pubkey,
      baseCDN: this.cfg.cdnCname,
      baseURL: this.cfg.baseUrl,
      userAgent: customUserAgent,
      integration: this.cfg.userAgentIntegration,
      secureSignature: this.cfg.secureSignature,
      secureExpire: this.cfg.secureExpire,
      retryThrottledRequestMaxTimes: this.cfg.retryThrottledRequestMaxTimes,
      multipartMinFileSize: this.cfg.multipartMinFileSize,
      multipartChunkSize: this.cfg.multipartChunkSize,
      maxConcurrentRequests: this.cfg.multipartMaxConcurrentRequests,
      multipartMaxAttempts: this.cfg.multipartMaxAttempts,
      checkForUrlDuplicates: !!this.cfg.checkForUrlDuplicates,
      saveUrlForRecurrentUploads: !!this.cfg.saveUrlForRecurrentUploads,
      metadata: await this.getMetadata(),
    };

    return options;
  }

  /**
   * @param {string} entryId
   * @returns {import('../types/exported.js').OutputFileEntry}
   */
  getOutputItem(entryId) {
    const uploadEntryData = Data.getCtx(entryId).store;
    /** @type {import('@uploadcare/upload-client').UploadcareFile} */
    const fileInfo = uploadEntryData.fileInfo || {
      name: uploadEntryData.fileName,
      originalFilename: uploadEntryData.fileName,
      size: uploadEntryData.fileSize,
      isImage: uploadEntryData.isImage,
      mimeType: uploadEntryData.mimeType,
    };
    /** @type {import('../types/exported.js').OutputFileEntry} */
    const outputItem = {
      ...fileInfo,
      file: uploadEntryData.file,
      externalUrl: uploadEntryData.externalUrl,
      cdnUrlModifiers: uploadEntryData.cdnUrlModifiers,
      cdnUrl: uploadEntryData.cdnUrl ?? fileInfo.cdnUrl ?? null,
      validationErrorMessage: uploadEntryData.validationErrorMsg,
      uploadError: uploadEntryData.uploadError,
      isUploaded: !!uploadEntryData.uuid && !!uploadEntryData.fileInfo,
      isValid: !uploadEntryData.validationErrorMsg && !uploadEntryData.uploadError,
      fullPath: uploadEntryData.fullPath,
    };
    return outputItem;
  }

  /**
   * @param {(item: import('./TypedData.js').TypedData) => Boolean} [checkFn]
   * @returns {import('../types/exported.js').OutputFileEntry[]}
   */
  getOutputData(checkFn) {
    const entriesIds = checkFn ? this.uploadCollection.findItems(checkFn) : this.uploadCollection.items();
    const data = entriesIds.map((itemId) => this.getOutputItem(itemId));
    return data;
  }
}

/** @enum {String} */
UploaderBlock.extSrcList = Object.freeze({
  FACEBOOK: 'facebook',
  DROPBOX: 'dropbox',
  GDRIVE: 'gdrive',
  GPHOTOS: 'gphotos',
  INSTAGRAM: 'instagram',
  FLICKR: 'flickr',
  VK: 'vk',
  EVERNOTE: 'evernote',
  BOX: 'box',
  ONEDRIVE: 'onedrive',
  HUDDLE: 'huddle',
});

/** @enum {String} */
UploaderBlock.sourceTypes = Object.freeze({
  LOCAL: 'local',
  URL: 'url',
  CAMERA: 'camera',
  DRAW: 'draw',
  ...UploaderBlock.extSrcList,
});
