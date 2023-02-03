import { ActivityBlock } from './ActivityBlock.js';

import { Data } from '@symbiotejs/symbiote';
import { IMAGE_ACCEPT_LIST, mergeFileTypes, fileIsImage } from '../utils/fileTypes.js';
import { uploadEntrySchema } from './uploadEntrySchema.js';
import { customUserAgent } from '../blocks/utils/userAgent.js';
import { TypedCollection } from './TypedCollection.js';
import { uploaderBlockCtx } from './CTX.js';
import { EVENT_TYPES, EventData, EventManager } from './EventManager.js';
import { Modal } from '../blocks/Modal/Modal.js';

export class UploaderBlock extends ActivityBlock {
  ctxInit = uploaderBlockCtx(this);

  /** @private */
  __initialUploadMetadata = null;

  /**
   * This is Public JS API method. Could be called before block initialization, so we need to delay state interactions
   * until block init.
   *
   * TODO: If we add more public methods, it is better to use the single queue instead of tons of private fields per
   * each method. See https://github.com/uploadcare/blocks/pull/162/
   *
   * @param {import('@uploadcare/upload-client').Metadata} metadata
   * @public
   */
  setUploadMetadata(metadata) {
    if (!this.connectedOnce) {
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
    let accept = mergeFileTypes([
      this.getCssData('--cfg-accept'),
      ...(this.getCssData('--cfg-img-only') ? IMAGE_ACCEPT_LIST : []),
    ]).join(',');

    if (this.getCssData('--cfg-accept') && !!this.getCssData('--cfg-img-only')) {
      console.warn(
        'There could be a mistake.\n' +
          'Both `--cfg-accept` and `--cfg-img-only` parameters are set.\n' +
          'The value of `--cfg-accept` will be concatenated with the internal image mime types list.'
      );
    }
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.multiple = !!this.getCssData('--cfg-multiple');
    if (options.captureCamera) {
      this.fileInput.capture = '';
      this.fileInput.accept = IMAGE_ACCEPT_LIST.join(',');
    } else {
      this.fileInput.accept = accept;
    }
    this.fileInput.dispatchEvent(new MouseEvent('click'));
    this.fileInput.onchange = () => {
      this.addFiles([...this.fileInput['files']]);
      // To call uploadTrigger UploadList should draw file items first:
      this.$['*currentActivity'] = ActivityBlock.activities.UPLOAD_LIST;
      this.setForCtxTarget(Modal.StateConsumerScope, '*modalActive', true);
      this.fileInput['value'] = '';
      this.fileInput = null;
    };
  }

  /** @type {String[]} */
  get sourceList() {
    let list = null;
    if (this.getCssData('--cfg-source-list')) {
      list = this.getCssData('--cfg-source-list')
        .split(',')
        .map((/** @type {String} */ item) => {
          return item.trim();
        });
    }
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

  /** @private */
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

  /** @returns {import('@uploadcare/upload-client').FileFromOptions} */
  getUploadClientOptions() {
    let store = this.getCssData('--cfg-store', true);
    let options = {
      // undefined 'store' means 'auto'
      store: store === null ? undefined : !!store,
      publicKey: this.getCssData('--cfg-pubkey'),
      baseCDN: this.getCssData('--cfg-cdn-cname'),
      baseURL: this.getCssData('--cfg-base-url'),
      userAgent: customUserAgent,
      integration: this.getCssData('--cfg-user-agent-integration'),
      secureSignature: this.getCssData('--cfg-secure-signature'),
      secureExpire: this.getCssData('--cfg-secure-expire'),
      retryThrottledRequestMaxTimes: this.getCssData('--cfg-retry-throttled-request-max-times'),
      multipartMinFileSize: this.getCssData('--cfg-multipart-min-file-size'),
      multipartChunkSize: this.getCssData('--cfg-multipart-chunk-size'),
      maxConcurrentRequests: this.getCssData('--cfg-max-concurrent-requests'),
      multipartMaxAttempts: this.getCssData('--cfg-multipart-max-attempts'),
      checkForUrlDuplicates: !!this.getCssData('--cfg-check-for-url-duplicates'),
      saveUrlForRecurrentUploads: !!this.getCssData('--cfg-save-url-for-recurrent-uploads'),
      metadata: this.$['*uploadMetadata'],
    };

    console.log('Upload client options:', options);

    return options;
  }

  /** @param {(item: import('./TypedData.js').TypedData) => Boolean} checkFn */
  getOutputData(checkFn) {
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
    return data;
  }
}

/** @enum {String} */
UploaderBlock.sourceTypes = Object.freeze({
  LOCAL: 'local',
  URL: 'url',
  CAMERA: 'camera',
  DRAW: 'draw',
  ...UploaderBlock.extSrcList,
});

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

Object.values(EVENT_TYPES).forEach((eType) => {
  let eName = EventManager.eName(eType);
  window.addEventListener(eName, (e) => {
    let outputTypes = [EVENT_TYPES.UPLOAD_FINISH, EVENT_TYPES.REMOVE, EVENT_TYPES.CDN_MODIFICATION];
    if (outputTypes.includes(e.detail.type)) {
      let dataCtx = Data.getCtx(e.detail.ctx);
      /** @type {TypedCollection} */
      let uploadCollection = dataCtx.read('uploadCollection');
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
          ctx: e.detail.ctx,
          data,
        })
      );
      dataCtx.pub('outputData', data);
    }
  });
});
