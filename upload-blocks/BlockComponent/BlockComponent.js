import { BaseComponent, Data, TypedCollection } from '../../ext_modules/symbiote.js';
import { uploadEntrySchema } from './uploadEntrySchema.js';

const ACTIVE_ATTR = 'active';

let DOC_READY = document.readyState === 'complete';
if (!DOC_READY) {
  window.addEventListener('load', () => {
    DOC_READY = true;
  });
}

function blockProcessor(fr, fnCtx) {
  [...fr.querySelectorAll('[l10n]')].forEach((el) => {
    let key = el.getAttribute('l10n');
    let elProp = 'textContent';
    if (key.includes(':')) {
      let arr = key.split(':');
      elProp = arr[0];
      key = arr[1];
    }
    let ctxKey = 'l10n:' + key;
    fnCtx.__l10nKeys.push(ctxKey);
    fnCtx.add(ctxKey, key);
    fnCtx.sub(ctxKey, (val) => {
      el[elProp] = fnCtx.l10n(val);
    });
    el.removeAttribute('l10n');
  });
  [...fr.querySelectorAll('*')].forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (attr.name.startsWith('.')) {
        el.classList.add(attr.name.replace('.', ''));
        el.removeAttribute(attr.name);
      }
    });
  });
}

let externalPropsAdded = false;

export class BlockComponent extends BaseComponent {
  l10n(str) {
    return this.getCssData('--l10n-' + str);
  }

  constructor() {
    super();
    /** @type {String} */
    this.activityType = null;
    this.addTemplateProcessor(blockProcessor);
    /** @type {String[]} */
    this.__l10nKeys = [];
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
    this.$['l10n:' + localPropKey] = l10nKey;
  }

  historyBack() {
    /** @type {String[]} */
    let history = this.$['*history'];
    history.pop();
    let prevActivity = history.pop();
    this.$['*currentActivity'] = prevActivity;
    if (history.length > 10) {
      history = history.slice(history.length - 11, history.length - 1);
    }
    this.$['*history'] = history;
    // console.log(history)
  }

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

  output() {
    let data = [];
    let items = this.uploadCollection.items();
    items.forEach((itemId) => {
      data.push(Data.getNamedCtx(itemId).store);
    });
    this.$['*outputData'] = data;
  }

  openSystemDialog() {
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.multiple = !!this.config.MULTIPLE;
    this.fileInput.max = this.config.MAX_FILES + '';
    this.fileInput.accept = this.config.ACCEPT;
    this.fileInput.dispatchEvent(new MouseEvent('click'));
    this.fileInput.onchange = () => {
      this.addFiles([...this.fileInput['files']]);
      // To call uploadTrigger UploadList should draw file items first:
      this.$['*currentActivity'] = BlockComponent.activities.UPLOAD_LIST;
      if (!this.config.CONFIRM_UPLOAD) {
        this.$['*currentActivity'] = '';
      }
      this.fileInput['value'] = '';
      this.fileInput = null;
    };
  }

  connectedCallback() {
    if (DOC_READY) {
      this.connected();
    } else {
      window.addEventListener('load', () => {
        this.connected();
      });
    }
  }

  connected() {
    if (!this.__connectedOnce) {
      if (!externalPropsAdded) {
        this.add$({
          '*registry': Object.create(null),
          '*currentActivity': '',
          '*currentActivityParams': {},
          '*history': [],
          '*commonProgress': 0,
          '*pubkey': 'demopublickey',
          '*uploadList': [],
          '*multiple': true,
          '*accept': 'image/*',
          '*files': [],
          '*outputData': null,
        });
        externalPropsAdded = true;
      }

      super.connectedCallback();

      if (this.activityType) {
        if (!this.hasAttribute('activity')) {
          this.setAttribute('activity', this.activityType);
        }
        this.sub('*currentActivity', (/** @type {String} */ val) => {
          if (!val || this.activityType !== val) {
            this.removeAttribute(ACTIVE_ATTR);
          } else {
            /** @type {String[]} */
            let history = this.$['*history'];
            if (val && history[history.length - 1] !== val) {
              history.push(val);
            }
            this.setAttribute(ACTIVE_ATTR, '');
            let actDesc = BlockComponent._activityRegistry[val];
            if (actDesc) {
              actDesc.activateCallback?.();
              if (BlockComponent._lastActivity) {
                let lastActDesc = BlockComponent._activityRegistry[BlockComponent._lastActivity];
                if (lastActDesc) {
                  lastActDesc.deactivateCallback?.();
                }
              }
            }
          }
          BlockComponent._lastActivity = val;
        });
      }
      this.__connectedOnce = true;
    } else {
      super.connectedCallback();
    }
  }

  /**
   * @param {String} name
   * @param {() => void} [activateCallback]
   * @param {() => void} [deactivateCallback]
   */
  registerActivity(name, activateCallback, deactivateCallback) {
    if (!BlockComponent._activityRegistry) {
      BlockComponent._activityRegistry = Object.create(null);
    }
    BlockComponent._activityRegistry[name] = {
      activateCallback,
      deactivateCallback,
    };
  }

  get activityParams() {
    return this.$['*currentActivityParams'];
  }

  /** @type {import('../../ext_modules/symbiote.js').TypedCollection} */
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
            return !entry.getValue('uploadErrorMsg');
          });
          items.forEach((id) => {
            commonProgress += uploadCollection.readProp(id, 'uploadProgress');
          });
          this.$['*commonProgress'] = commonProgress / items.length;
        }
      });
      this.add('*uploadCollection', uploadCollection);
    }
    return this.$['*uploadCollection'];
  }

  /** @type {Object<string, BlockComponent>} */
  get blockRegistry() {
    return this.$['*registry'];
  }

  /**
   * @type {{
   *   PUBKEY: string;
   *   MULTIPLE: number;
   *   CONFIRM_UPLOAD: number;
   *   IMG_ONLY: number;
   *   ACCEPT: string;
   *   STORE: number;
   *   CAMERA_MIRROR: number;
   *   SRC_LIST: string;
   *   MAX_FILES: number;
   *   THUMB_SIZE: number;
   * }}
   */
  get config() {
    if (!this._config) {
      this._config = {};
      for (let prop in BlockComponent.cfgCssMap) {
        let val = this.getCssData(BlockComponent.cfgCssMap[prop], true);
        if (val !== null) {
          this._config[prop] = val;
        }
      }
    }
    // @ts-ignore
    return this._config;
  }

  /** @param {String} shortKey */
  cfg(shortKey) {
    return this.getCssData('--cfg-' + shortKey, true);
  }

  dropCache() {
    // TODO: add l10n hot reload support
    this.dropCssDataCache();
    this._config = null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._config = null;
  }

  destroyCallback() {
    window.removeEventListener('uc-l10n-update', this.__l10nUpdate);
    this.__l10nKeys = null;
    // TODO: destroy uploadCollection
  }

  static reg(name) {
    let prefix = 'uc-';
    super.reg(name.startsWith(prefix) ? name : prefix + name);
  }
}

/** @type {{ string: { activateCallback: Function; deactivateCallback: Function } }} */
BlockComponent._activityRegistry = Object.create(null);

/** @type {String} */
BlockComponent._lastActivity = '';

BlockComponent.activities = Object.freeze({
  SOURCE_SELECT: 'source-select',
  CAMERA: 'camera',
  DRAW: 'draw',
  UPLOAD_LIST: 'upload-list',
  URL: 'url',
  CONFIRMATION: 'confirmation',
  CLOUD_IMG_EDIT: 'cloud-image-edit',
  EXTERNAL: 'external',
  DETAILS: 'details',
});

BlockComponent.extSrcList = Object.freeze({
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

BlockComponent.sourceTypes = Object.freeze({
  LOCAL: 'local',
  URL: 'url',
  CAMERA: 'camera',
  DRAW: 'draw',
  ...BlockComponent.extSrcList,
});

BlockComponent.cfgCssMap = Object.freeze({
  PUBKEY: '--cfg-pubkey',
  MULTIPLE: '--cfg-multiple',
  CONFIRM_UPLOAD: '--cfg-confirm-upload',
  IMG_ONLY: '--cfg-img-only',
  ACCEPT: '--cfg-accept',
  STORE: '--cfg-store',
  CAMERA_MIRROR: '--cfg-camera-mirror',
  SRC_LIST: '--cfg-source-list',
  MAX_FILES: '--cfg-max-files',
  THUMB_SIZE: '--cfg-thumb-size',
});
