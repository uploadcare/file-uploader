// @ts-check
import { ActivityBlock } from './ActivityBlock.js';

import { Data } from '@symbiotejs/symbiote';
import { IMAGE_ACCEPT_LIST, mergeFileTypes, fileIsImage } from '../utils/fileTypes.js';
import { uploadEntrySchema } from './uploadEntrySchema.js';
import { customUserAgent } from '../blocks/utils/userAgent.js';
import { TypedCollection } from './TypedCollection.js';
import { uploaderBlockCtx } from './CTX.js';
import { EVENT_TYPES, EventData, EventManager } from './EventManager.js';
import { Modal } from '../blocks/Modal/Modal.js';
import { stringToArray } from '../utils/stringToArray.js';
import { warnOnce } from '../utils/warnOnce.js';

export class UploaderBlock extends ActivityBlock {
  init$ = uploaderBlockCtx(this);

  /** @private */
  __initialUploadMetadata = null;

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
    warnOnce('setUploadMetadata is deprecated. Use `metadata` instance property on `lr-config` block instead.');
    if (!this.connectedOnce) {
      // @ts-ignore TODO: fix this
      this.__initialUploadMetadata = metadata;
    } else {
      this.$['*uploadMetadata'] = metadata;
    }
  }

  initCallback() {
    super.initCallback();

    if (this.__initialUploadMetadata) {
      this.$['*uploadMetadata'] = this.__initialUploadMetadata;
    }

    this.subConfigValue('maxConcurrentRequests', (value) => {
      this.$['*uploadQueue'].concurrency = Number(value) || 1;
    });
  }

  destroyCallback() {
    super.destroyCallback();

    let blocksRegistry = this.$['*blocksRegistry'];
    if (blocksRegistry.has(this)) {
      this.uploadCollection.unobserve(this._handleCollectionUpdate);
      blocksRegistry.delete(this);
    }
  }

  /** @param {File[]} files */
  addFiles(files) {
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

  /** @param {{ captureCamera?: boolean }} options */
  openSystemDialog(options = {}) {
    let accept = mergeFileTypes([this.cfg.accept ?? '', ...(this.cfg.imgOnly ? IMAGE_ACCEPT_LIST : [])]).join(',');

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
      this.fileInput.accept = IMAGE_ACCEPT_LIST.join(',');
    } else {
      this.fileInput.accept = accept;
    }
    this.fileInput.dispatchEvent(new MouseEvent('click'));
    this.fileInput.onchange = () => {
      // @ts-ignore TODO: fix this
      this.addFiles([...this.fileInput['files']]);
      // To call uploadTrigger UploadList should draw file items first:
      this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
      this.setForCtxTarget(Modal.StateConsumerScope, '*modalActive', true);
      // @ts-ignore TODO: fix this
      this.fileInput['value'] = '';
      this.fileInput = null;
    };
  }

  /** @type {String[]} */
  get sourceList() {
    let list = null;
    if (this.cfg.sourceList) {
      list = stringToArray(this.cfg.sourceList);
    }
    // @ts-ignore TODO: fix this
    return list;
  }

  /** @param {Boolean} [force] */
  initFlow(force = false) {
    if (this.$['*uploadList']?.length && !force) {
      this.set$({
        '*currentActivity': ActivityBlock.activities.UPLOAD_LIST,
      });
      this.setForCtxTarget(Modal.StateConsumerScope, '*modalActive', true);
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
          this.setForCtxTarget(Modal.StateConsumerScope, '*modalActive', true);
        }
      } else {
        // Multiple sources case:
        this.set$({
          '*currentActivity': ActivityBlock.activities.START_FROM,
        });
        this.setForCtxTarget(Modal.StateConsumerScope, '*modalActive', true);
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
      this.setForCtxTarget(Modal.StateConsumerScope, '*modalActive', false);
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
    if (!this.has('*uploadCollection')) {
      let uploadCollection = new TypedCollection({
        typedSchema: uploadEntrySchema,
        watchList: ['uploadProgress', 'uuid', 'uploadError', 'validationErrorMsg', 'cdnUrlModifiers'],
        handler: (entries, added, removed) => {
          for (let entry of removed) {
            entry?.getValue('abortController')?.abort();
            entry?.setValue('abortController', null);
            URL.revokeObjectURL(entry?.getValue('thumbUrl'));
          }
          this.$['*uploadList'] = entries.map((uid) => {
            return { uid };
          });
        },
      });
      uploadCollection.observe(this._handleCollectionUpdate);
      this.add('*uploadCollection', uploadCollection);
    }
    return this.$['*uploadCollection'];
  }

  /**
   * @private
   * @param {Record<string, string>} changeMap
   */
  _handleCollectionUpdate = (changeMap) => {
    let uploadCollection = this.uploadCollection;
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
    if (changeMap.uuid) {
      let loadedItems = uploadCollection.findItems((entry) => {
        return !!entry.getValue('uuid');
      });
      let errorItems = uploadCollection.findItems((entry) => {
        return !!entry.getValue('uploadError') || !!entry.getValue('validationErrorMsg');
      });
      if (uploadCollection.size - errorItems.length === loadedItems.length) {
        let data = this.getOutputData((dataItem) => {
          return !!dataItem.getValue('uuid');
        });
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
            type: EVENT_TYPES.CDN_MODIFICATION,
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
  async getMetadata() {
    const configValue = this.cfg.metadata ?? /** @type {import('../index.js').Metadata} */ (this.$['*uploadMetadata']);
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

    console.log('Upload client options:', options);

    return options;
  }

  /** @param {(item: import('./TypedData.js').TypedData) => Boolean} checkFn */
  getOutputData(checkFn) {
    // @ts-ignore TODO: fix this
    let data = [];
    let items = this.uploadCollection.findItems(checkFn);
    items.forEach((itemId) => {
      let uploadEntryData = Data.getCtx(itemId).store;
      /** @type {import('@uploadcare/upload-client').UploadcareFile} */
      let fileInfo = uploadEntryData.fileInfo || {
        name: uploadEntryData.fileName,
        fileSize: uploadEntryData.fileSize,
        isImage: uploadEntryData.isImage,
        mimeType: uploadEntryData.mimeType,
      };
      let outputItem = {
        ...fileInfo,
        cdnUrlModifiers: uploadEntryData.cdnUrlModifiers,
        cdnUrl: uploadEntryData.cdnUrl || fileInfo.cdnUrl,
      };
      data.push(outputItem);
    });
    // @ts-ignore TODO: fix this
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

Object.values(EVENT_TYPES).forEach((eType) => {
  let eName = EventManager.eName(eType);
  window.addEventListener(eName, (e) => {
    let outputTypes = [EVENT_TYPES.UPLOAD_FINISH, EVENT_TYPES.REMOVE, EVENT_TYPES.CDN_MODIFICATION];
    // @ts-ignore TODO: fix this
    if (outputTypes.includes(e.detail.type)) {
      // @ts-ignore TODO: fix this
      let dataCtx = Data.getCtx(e.detail.ctx);
      /** @type {TypedCollection} */
      let uploadCollection = dataCtx.read('uploadCollection');
      // @ts-ignore TODO: fix this
      let data = [];
      uploadCollection.items().forEach((id) => {
        let uploadEntryData = Data.getCtx(id).store;
        /** @type {import('@uploadcare/upload-client').UploadcareFile} */
        let fileInfo = uploadEntryData.fileInfo;
        if (fileInfo) {
          let outputItem = {
            ...fileInfo,
            cdnUrlModifiers: uploadEntryData.cdnUrlModifiers,
            cdnUrl: uploadEntryData.cdnUrl || fileInfo.cdnUrl,
          };
          data.push(outputItem);
        }
      });
      EventManager.emit(
        new EventData({
          type: EVENT_TYPES.DATA_OUTPUT,
          // @ts-ignore TODO: fix this
          ctx: e.detail.ctx,
          // @ts-ignore TODO: fix this
          data,
        })
      );
      // @ts-ignore TODO: fix this
      dataCtx.pub('outputData', data);
    }
  });
});
