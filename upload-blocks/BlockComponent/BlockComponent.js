import { BaseComponent } from '../../symbiote/core/BaseComponent.js';
import { ENUM } from './enum.js';
import { TypedCollection } from '../../symbiote/core/TypedCollection.js';
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
    this.addTemplateProcessor(blockProcessor);
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

  openSystemDialog() {
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.dispatchEvent(new MouseEvent('click'));
    this.fileInput.onchange = () => {
      this.addFiles([...this.fileInput['files']]);
      this.set$({
        '*currentActivity': 'upload-list',
        '*modalActive': true,
      });
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
          '*history': [],
          '*commonProgress': 0,
          '*pubkey': 'demopublickey',
          '*uploadList': [],
          '*multiple': true,
          '*accept': 'image/*',
          '*files': [],
        });
        externalPropsAdded = true;
      }

      super.connectedCallback();

      if (this.hasAttribute('activity')) {
        let registry = this.$['*registry'];
        registry[this.tagName.toLowerCase()] = this;
        this.$['*registry'] = registry;
        this.sub('*currentActivity', (val) => {
          if (!val) {
            this.removeAttribute(ACTIVE_ATTR);
            return;
          }
          if (this.getAttribute('activity') === val) {
            /** @type {String[]} */
            let history = this.$['*history'];
            if (val && history[history.length - 1] !== val) {
              history.push(val);
            }
            this.setAttribute(ACTIVE_ATTR, '');
          } else {
            this.removeAttribute(ACTIVE_ATTR);
          }
        });
      }

      this.__connectedOnce = true;
    } else {
      super.connectedCallback();
    }
  }

  /** @type {import('../../symbiote/core/TypedCollection.js').TypedCollection} */
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
   *   EXT_SRC_LIST: string;
   *   MAX_FILES: number;
   * }}
   */
  get config() {
    let conf = {};
    let style = window.getComputedStyle(this);
    for (let prop in BlockComponent.enum.CSS.CFG) {
      conf[prop] = JSON.parse(style.getPropertyValue(BlockComponent.enum.CSS.CFG[prop]).trim());
    }
    // @ts-ignore
    return conf;
  }

  destroyCallback() {
    // TODO: destroy uploadCollection
  }

  static reg(name) {
    let prefix = 'uc-';
    super.reg(name.startsWith(prefix) ? name : prefix + name);
  }
}

BlockComponent.enum = ENUM;
