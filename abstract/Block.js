import { BaseComponent, Data, TypedCollection } from '../submodules/symbiote/core/symbiote.js';
import { applyTemplateData } from '../utils/applyTemplateData.js';
import { l10nProcessor } from './l10nProcessor.js';
import { uploadEntrySchema } from './uploadEntrySchema.js';

const ACTIVE_ATTR = 'active';
const ACTIVE_PROP = '___ACTIVITY_IS_ACTIVE___';
const TAG_PREFIX = 'uc-';
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
 *   '*currentActivityParams': { [key: String]: any };
 *   '*history': String[];
 *   '*commonProgress': Number;
 *   '*uploadList': any[];
 *   '*outputData': any[] | null;
 *   '*focusedEntry': any | null;
 *   '*uploadCollection': TypedCollection;
 *   [key: String]: unknown;
 * }} BlockState
 */

/**
 * @template S
 * @extends {BaseComponent<S & Partial<BlockState & import('../css-types.js').CssConfigTypes>>}
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
    window.addEventListener('uc-l10n-update', this.__l10nUpdate);
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

  /** @private */
  __bindBasicCssData() {
    if (!Block._cssDataBindingsList.includes(this.ctxName)) {
      let unprefixedCfgProps = [
        'pubkey',
        'store',
        'multiple',
        'multiple-min',
        'multiple-max',
        'max-files',
        'accept',
        'confirm-upload',
        'init-activity',
        'done-activity',
      ];
      unprefixedCfgProps.forEach((prop) => {
        this.bindCssData(`--cfg-${prop}`);
      }, true);
      Block._cssDataBindingsList.push(this.ctxName);
    }
  }

  initCallback() {
    // TODO: rethink initiation flow for the common context parameters
    this.__bindBasicCssData();
    // ^ in this case css-data-props will be initiated when there is one or more components without initCallback call
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
          })
        );
        Block._ctxConnectionsList.push(this.ctxName);
      }
      this.$['*ctxTargetsRegistry'].add(this.constructor['is']);

      super.connectedCallback();

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
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.multiple = !!this.$['*--cfg-multiple'];
    this.fileInput.accept = this.$['*--cfg-accept'];
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
    if (this.$['*--cfg-source-list']) {
      list = this.$['*--cfg-source-list'].split(',').map((/** @type {String} */ item) => {
        return item.trim();
      });
    }
    return list;
  }

  /** @type {String} */
  get initActivity() {
    return this.$['*--cfg-init-activity'];
  }

  /** @type {String} */
  get doneActivity() {
    return this.$['*--cfg-done-activity'];
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
      this.setForCtxTarget('uc-modal', '*modalActive', true);
    } else {
      if (this.sourceList?.length === 1) {
        let srcKey = this.sourceList[0];
        // Single source case:
        if (srcKey === 'local') {
          this.$['*currentActivity'] = Block.activities.UPLOAD_LIST;
          this.openSystemDialog();
        } else {
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
          this.setForCtxTarget('uc-modal', '*modalActive', true);
        }
      } else {
        // Multiple sources case:
        this.set$(
          /** @type {Partial<S & BlockState>} */ ({
            '*currentActivity': Block.activities.START_FROM,
          })
        );
        this.setForCtxTarget('uc-modal', '*modalActive', true);
      }
    }
  }

  cancelFlow() {
    if (this.sourceList?.length === 1) {
      this.$['*currentActivity'] = null;
      this.setForCtxTarget('uc-modal', '*modalActive', false);
    } else {
      this.historyBack();
      if (!this.$['*currentActivity']) {
        this.setForCtxTarget('uc-modal', '*modalActive', false);
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

  output() {
    let data = [];
    let items = this.uploadCollection.items();
    items.forEach((itemId) => {
      let uploadEntryData = Data.getNamedCtx(itemId).store;
      /** @type {import('../submodules/upload-client/upload-client.js').UploadcareFile} */
      let fileInfo = uploadEntryData.fileInfo;
      // TODO: remove `cdnUrlModifiers` from fileInfo object returned by upload-client, `cdnUrl` should not contain modifiers
      // TODO: create OutputItem instance instead of creating inline object,
      //       fileInfo should be returned as is along with the other data
      // TODO: pass editorTransformations to the user
      let outputItem = {
        ...fileInfo,
        cdnUrlModifiers: uploadEntryData.cdnUrlModifiers || fileInfo.cdnUrlModifiers,
        cdnUrl: uploadEntryData.cdnUrl || fileInfo.cdnUrl,
      };
      data.push(outputItem);
    });
    this.$['*outputData'] = data;
  }

  destroyCallback() {
    window.removeEventListener('uc-l10n-update', this.__l10nUpdate);
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
