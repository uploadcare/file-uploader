import { BaseComponent, Data, TypedCollection } from '../../ext_modules/symbiote.js';
import { blockProcessor } from './blockProcessor.js';
import { uploadEntrySchema } from './uploadEntrySchema.js';

const ACTIVE_ATTR = 'active';
const TAG_PREFIX = 'uc-';

let DOC_READY = document.readyState === 'complete';
if (!DOC_READY) {
  window.addEventListener('load', () => {
    DOC_READY = true;
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

  openSystemDialog() {
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.multiple = !!this.cfg('multiple');
    this.fileInput.max = this.cfg('max-files');
    this.fileInput.accept = this.cfg('accept');
    this.fileInput.dispatchEvent(new MouseEvent('click'));
    this.fileInput.onchange = () => {
      this.addFiles([...this.fileInput['files']]);
      // To call uploadTrigger UploadList should draw file items first:
      this.$['*currentActivity'] = BlockComponent.activities.UPLOAD_LIST;
      if (!this.cfg('confirm-upload')) {
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
          '*currentActivity': '',
          '*currentActivityParams': {},
          '*history': [],
          '*commonProgress': 0,
          '*uploadList': [],
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

  /** @param {String} shortKey */
  cfg(shortKey) {
    return this.getCssData('--cfg-' + shortKey, true);
  }

  output() {
    let data = [];
    let items = this.uploadCollection.items();
    items.forEach((itemId) => {
      data.push(Data.getNamedCtx(itemId).store);
    });
    this.$['*outputData'] = data;
  }

  destroyCallback() {
    window.removeEventListener('uc-l10n-update', this.__l10nUpdate);
    this.__l10nKeys = null;
    // TODO: destroy uploadCollection
  }

  static reg(name) {
    super.reg(name.startsWith(TAG_PREFIX) ? name : TAG_PREFIX + name);
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
