import { BaseComponent, Data, TypedCollection } from '../submodules/symbiote/core/symbiote.js';
import { applyTemplateData } from '../utils/applyTemplateData.js';
import { mergeMimeTypes } from '../utils/mergeMimeTypes.js';
import { imageMimeTypes } from '../utils/imageMimeTypes.js';
import { l10nProcessor } from './l10nProcessor.js';
import { uploadEntrySchema } from './uploadEntrySchema.js';
import { customUserAgent } from '../blocks/utils/userAgent.js';

const ACTIVE_ATTR = 'active';
const ACTIVE_PROP = '___ACTIVITY_IS_ACTIVE___';
const TAG_PREFIX = 'lr-';
const CSS_ATTRIBUTE = 'css-src';

let DOC_READY = document.readyState === 'complete';
if (!DOC_READY) {
  window.addEventListener('load', () => {
    DOC_READY = true;
  });
}

/**
 * @typedef {{
 *   '*ctxTargetsRegistry': Set<any>;
 *   '*currentActivity': String;
 *   '*currentActivityParams': { [key: String]: unknown };
 *   '*history': String[];
 *   '*commonProgress': Number;
 *   '*uploadList': String[];
 *   '*outputData': unknown[] | null;
 *   '*focusedEntry': unknown | null;
 *   '*uploadCollection': TypedCollection;
 *   '*uploadMetadata': import('../submodules/upload-client/upload-client.js').Metadata;
 *   [key: String]: unknown;
 * }} BlockState
 */

/**
 * @template S
 * @extends {BaseComponent<S & Partial<BlockState>>}
 */
export class Block extends BaseComponent {
  /**
   * @param {String} str
   * @param {{ [key: string]: string | number }} variables
   * @returns {String}
   */
  l10n(str, variables = {}) {
    let template = this.getCssData('--l10n-' + str, true) || str;
    let result = applyTemplateData(template, variables);
    return result;
  }

  constructor() {
    super();
    /** @type {String} */
    this.activityType = null;
    this.addTemplateProcessor(l10nProcessor);
    /**
     * @private
     * @type {String[]}
     */
    this.__l10nKeys = [];
    /** @private */
    this.__l10nUpdate = () => {
      this.dropCssDataCache();
      for (let key of this.__l10nKeys) {
        this.notify(key);
      }
    };
    window.addEventListener('lr-l10n-update', this.__l10nUpdate);
  }

  /**
   * @param {String} localPropKey
   * @param {String} l10nKey
   */
  applyL10nKey(localPropKey, l10nKey) {
    let prop = 'l10n:' + localPropKey;
    this.$[/** @type {keyof S} */ (prop)] = /** @type {any} */ (l10nKey);
    this.__l10nKeys.push(localPropKey);
  }

  historyBack() {
    /** @type {String[]} */
    let history = this.$['*history'];
    history.pop();
    let prevActivity = history.pop();
    this.$['*currentActivity'] = prevActivity;
    this.$['*history'] = history;
  }

  /** @param {File[]} files */
  addFiles(files) {
    files.forEach((/** @type {File} */ file) => {
      this.uploadCollection.add({
        file,
        isImage: file.type.includes('image'),
        mimeType: file.type,
        fileName: file.name,
        fileSize: file.size,
      });
    });
  }

  connectedCallback() {
    let handleReadyState = () => {
      if (DOC_READY) {
        this.connected();
      } else {
        window.addEventListener('load', () => {
          this.connected();
        });
      }
    };
    let href = this.getAttribute(CSS_ATTRIBUTE);
    if (href) {
      this.renderShadow = true;
      this.attachShadow({
        mode: 'open',
      });
      let link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = href;
      link.onload = () => {
        // CSS modules can be not loaded at this moment
        // TODO: investigate better solution
        window.requestAnimationFrame(() => {
          handleReadyState();
        });
      };
      this.shadowRoot.appendChild(link);
    } else {
      handleReadyState();
    }
  }

  connected() {
    if (!this.__connectedOnce) {
      if (!Block._ctxConnectionsList.includes(this.ctxName)) {
        this.add$(
          /** @type {Partial<S & BlockState>} */ ({
            '*ctxTargetsRegistry': new Set(),
            '*currentActivity': '',
            '*currentActivityParams': {},
            '*history': [],
            '*commonProgress': 0,
            '*uploadList': [],
            '*outputData': null,
            '*focusedEntry': null,
            '*uploadMetadata': null,
          })
        );
        Block._ctxConnectionsList.push(this.ctxName);
      }
      this.$['*ctxTargetsRegistry'].add(this.constructor['is']);

      super.connectedCallback();

      if (this.__initialUploadMetadata) {
        this.$['*uploadMetadata'] = this.__initialUploadMetadata;
      }

      if (this.hasAttribute('current-activity')) {
        this.sub('*currentActivity', (/** @type {String} */ val) => {
          this.setAttribute('current-activity', val);
        });
      }

      if (this.activityType) {
        if (!this.hasAttribute('activity')) {
          this.setAttribute('activity', this.activityType);
        }
        this.sub('*currentActivity', (/** @type {String} */ val) => {
          let activityKey = this.ctxName + this.activityType;
          let actDesc = Block._activityRegistry[activityKey];

          if (this.activityType !== val && this[ACTIVE_PROP]) {
            /** @private */
            this[ACTIVE_PROP] = false;
            this.removeAttribute(ACTIVE_ATTR);
            actDesc?.deactivateCallback?.();
            // console.log(`Activity "${this.activityType}" deactivated`);
          } else if (this.activityType === val && !this[ACTIVE_PROP]) {
            /** @private */
            this[ACTIVE_PROP] = true;
            this.setAttribute(ACTIVE_ATTR, '');
            actDesc?.activateCallback?.();
            // console.log(`Activity "${this.activityType}" activated`);

            let history = this.$['*history'];
            if (history.length > 10) {
              history = history.slice(history.length - 11, history.length - 1);
            }
            history.push(this.activityType);
            this.$['*history'] = history;
          }
        });
      }
      /** @private */
      this.__connectedOnce = true;
    } else {
      super.connectedCallback();
    }
  }

  openSystemDialog() {
    let accept = mergeMimeTypes(
      this.getCssData('--cfg-img-only') && imageMimeTypes.join(','),
      this.getCssData('--cfg-accept')
    );
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
    this.fileInput.accept = accept;
    this.fileInput.dispatchEvent(new MouseEvent('click'));
    this.fileInput.onchange = () => {
      this.addFiles([...this.fileInput['files']]);
      // To call uploadTrigger UploadList should draw file items first:
      this.$['*currentActivity'] = Block.activities.UPLOAD_LIST;
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

  /** @type {String} */
  get initActivity() {
    return this.getCssData('--cfg-init-activity');
  }

  /** @type {String} */
  get doneActivity() {
    return this.getCssData('--cfg-done-activity');
  }

  get isActivityActive() {
    return this[ACTIVE_PROP];
  }

  /** @param {Boolean} [force] */
  initFlow(force = false) {
    if (this.$['*uploadList']?.length && !force) {
      this.set$(
        /** @type {Partial<S & BlockState>} */ ({
          '*currentActivity': Block.activities.UPLOAD_LIST,
        })
      );
      this.setForCtxTarget('lr-modal', '*modalActive', true);
    } else {
      if (this.sourceList?.length === 1) {
        let srcKey = this.sourceList[0];
        // Single source case:
        if (srcKey === 'local') {
          this.$['*currentActivity'] = Block.activities.UPLOAD_LIST;
          this.openSystemDialog();
        } else {
          /** @ts-ignore */
          if (Object.values(Block.extSrcList).includes(srcKey)) {
            this.set$(
              /** @type {Partial<S & BlockState>} */ ({
                '*currentActivityParams': /** @type {BlockState['*currentActivityParams']} */ ({
                  externalSourceType: srcKey,
                }),
                '*currentActivity': Block.activities.EXTERNAL,
              })
            );
          } else {
            this.$['*currentActivity'] = srcKey;
          }
          this.setForCtxTarget('lr-modal', '*modalActive', true);
        }
      } else {
        // Multiple sources case:
        this.set$(
          /** @type {Partial<S & BlockState>} */ ({
            '*currentActivity': Block.activities.START_FROM,
          })
        );
        this.setForCtxTarget('lr-modal', '*modalActive', true);
      }
    }
  }

  cancelFlow() {
    if (this.sourceList?.length === 1) {
      this.$['*currentActivity'] = null;
      this.setForCtxTarget('lr-modal', '*modalActive', false);
    } else {
      this.historyBack();
      if (!this.$['*currentActivity']) {
        this.setForCtxTarget('lr-modal', '*modalActive', false);
      }
    }
  }

  /**
   * @param {String} targetTagName
   * @returns {Boolean}
   */
  checkCtxTarget(targetTagName) {
    /** @type {Set} */
    let registry = this.$['*ctxTargetsRegistry'];
    return registry.has(targetTagName);
  }

  /**
   * @param {String} targetTagName
   * @param {String} prop
   * @param {any} newVal
   */
  setForCtxTarget(targetTagName, prop, newVal) {
    if (this.checkCtxTarget(targetTagName)) {
      this.$[/** @type {keyof S} */ (prop)] = newVal;
    }
  }

  /**
   * @param {String} name
   * @param {() => void} [activateCallback]
   * @param {() => void} [deactivateCallback]
   */
  registerActivity(name, activateCallback, deactivateCallback) {
    if (!Block._activityRegistry) {
      Block._activityRegistry = Object.create(null);
    }
    let actKey = this.ctxName + name;
    Block._activityRegistry[actKey] = {
      activateCallback,
      deactivateCallback,
    };
  }

  get activityParams() {
    return this.$['*currentActivityParams'];
  }

  /** @returns {TypedCollection} */
  get uploadCollection() {
    if (!this.has('*uploadCollection')) {
      let uploadCollection = new TypedCollection({
        typedSchema: uploadEntrySchema,
        watchList: ['uploadProgress', 'uuid'],
        handler: (entries) => {
          this.$['*uploadList'] = entries;
        },
      });
      uploadCollection.observe((changeMap) => {
        if (changeMap.uploadProgress) {
          let commonProgress = 0;
          /** @type {String[]} */
          let items = uploadCollection.findItems((entry) => {
            return !entry.getValue('uploadError');
          });
          items.forEach((id) => {
            commonProgress += uploadCollection.readProp(id, 'uploadProgress');
          });
          this.$['*commonProgress'] = commonProgress / items.length;
        }
      });
      this.add('*uploadCollection', /** @type {Partial<S & BlockState>['*uploadCollection']} */ (uploadCollection));
    }
    return this.$['*uploadCollection'];
  }

  /**
   * @param {Number} bytes
   * @param {Number} [decimals]
   */
  fileSizeFmt(bytes, decimals = 2) {
    let units = ['B', 'KB', 'MB', 'GB', 'TB'];
    /**
     * @param {String} str
     * @returns {String}
     */
    let getUnit = (str) => {
      return this.getCssData('--l10n-unit-' + str.toLowerCase(), true) || str;
    };
    if (bytes === 0) {
      return `0 ${getUnit(units[0])}`;
    }
    let k = 1024;
    let dm = decimals < 0 ? 0 : decimals;
    let i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / k ** i).toFixed(dm)) + ' ' + getUnit(units[i]);
  }

  /**
   * @param {String} url
   * @returns {String}
   */
  proxyUrl(url) {
    let previewProxy = this.getCssData('--cfg-secure-delivery-proxy', true);
    if (!previewProxy) {
      return url;
    }
    return applyTemplateData(
      previewProxy,
      { previewUrl: url },
      { transform: (value) => window.encodeURIComponent(value) }
    );
  }

  /** @returns {import('../submodules/upload-client/upload-client.js').FileFromOptions} */
  getUploadClientOptions() {
    let storeSetting = {};
    let store = this.getCssData('--cfg-store');
    if (store !== null) {
      storeSetting.store = !!store;
    }

    let options = {
      ...storeSetting,
      publicKey: this.getCssData('--cfg-pubkey'),
      baseCDN: this.getCssData('--cfg-cdn-cname'),
      userAgent: customUserAgent,
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

  output() {
    let data = [];
    let items = this.uploadCollection.items();
    items.forEach((itemId) => {
      let uploadEntryData = Data.getNamedCtx(itemId).store;
      /** @type {import('../submodules/upload-client/upload-client.js').UploadcareFile} */
      let fileInfo = uploadEntryData.fileInfo;
      // TODO: create dedicated output type
      let outputItem = {
        ...fileInfo,
        cdnUrlModifiers: uploadEntryData.cdnUrlModifiers,
        cdnUrl: uploadEntryData.cdnUrl || fileInfo.cdnUrl,
      };
      data.push(outputItem);
    });
    this.$['*outputData'] = data;
  }

  /** @private */
  __initialUploadMetadata = null;

  /**
   * This is Public JS API method. Could be called before block initialization, so we need to delay state interactions
   * until block init.
   *
   * TODO: If we add more public methods, it is better to use the single queue instead of tonns of private fields per
   * each method. See https://github.com/uploadcare/uc-blocks/pull/162/
   *
   * @param {import('../submodules/upload-client/upload-client.js').Metadata} metadata
   * @public
   */
  setUploadMetadata(metadata) {
    if (!this.__connectedOnce) {
      this.__initialUploadMetadata = metadata;
    } else {
      this.$['*uploadMetadata'] = metadata;
    }
  }

  destroyCallback() {
    window.removeEventListener('lr-l10n-update', this.__l10nUpdate);
    /** @private */
    this.__l10nKeys = null;
    // TODO: destroy uploadCollection
  }

  /** @param {String} name? */
  static reg(name) {
    if (!name) {
      super.reg();
      return;
    }
    super.reg(name.startsWith(TAG_PREFIX) ? name : TAG_PREFIX + name);
  }

  /**
   * @private
   * @type {{ String: { activateCallback: Function; deactivateCallback: Function } }}
   */
  static _activityRegistry = Object.create(null);

  /**
   * @private
   * @type {String[]}
   */
  static _ctxConnectionsList = [];

  /**
   * @private
   * @type {String[]}
   */
  static _cssDataBindingsList = [];
}

/** @enum {String} */
Block.activities = Object.freeze({
  START_FROM: 'start-from',
  CAMERA: 'camera',
  DRAW: 'draw',
  UPLOAD_LIST: 'upload-list',
  URL: 'url',
  CONFIRMATION: 'confirmation',
  CLOUD_IMG_EDIT: 'cloud-image-edit',
  EXTERNAL: 'external',
  DETAILS: 'details',
});

/** @enum {String} */
Block.extSrcList = Object.freeze({
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
Block.sourceTypes = Object.freeze({
  LOCAL: 'local',
  URL: 'url',
  CAMERA: 'camera',
  DRAW: 'draw',
  ...Block.extSrcList,
});
