import { BaseComponent } from '../../symbiote/core/BaseComponent.js';
import { ENUM } from './enum.js';
import { TypedCollection } from '../../symbiote/core/TypedCollection.js';
import { uploadEntrySchema } from './uploadEntrySchema.js';

const ACTIVE_ATTR = 'active';

export class BlockComponent extends BaseComponent {

  constructor() {
    super();
    this.addTemplateProcessor((fr) => {
      [...fr.querySelectorAll('*')].forEach((el) => {
        [...el.attributes].forEach((attr) => {
          if (attr.name.startsWith('.')) {
            el.classList.add(attr.name.replace('.', ''));
            el.removeAttribute(attr.name);
          }
        });
      });
    });
  }

  connectedCallback() {
    if (!this.__connectedOnce) {
      
      this.addToExternalState({
        registry: Object.create(null),
        currentActivity: '',
        history: [],
        backTrigger: null,
        commonProgress: 0,
        pubkey: 'demopublickey',
        uploadList: [],
      });

      super.connectedCallback();

      let registry = this.read('external', 'registry');
      registry[this.tagName.toLowerCase()] = this;
      this.pub('external', 'registry', registry);

      if (this.getAttribute('activity')) {
        this.sub('external', 'currentActivity', (val) => {
          /** @type {String[]} */
          let history = this.read('external', 'history');
          if (this._currentActivity !== val) {
            history.push(val);
          }
          this._currentActivity = val;
          if (this.getAttribute('activity') === val) {
            this.setAttribute(ACTIVE_ATTR, '');
          } else {
            this.removeAttribute(ACTIVE_ATTR);
          }
        });
        this.sub('external', 'backTrigger', (val) => {
          /** @type {String[]} */
          let history = this.read('external', 'history');
          history.pop();
          let prevActivity = history.pop();
          this.pub('external', 'currentActivity', prevActivity);
          if (history.length > 10) {
            history = history.slice(history.length - 11, history.length - 1);
          }
          this.pub('external', 'history', history);
          // console.log(history)
        });
      }

      this.__connectedOnce = true;
    } else {
      super.connectedCallback();
    }
  }

  /**
   * @type {import('../../symbiote/core/TypedCollection.js').TypedCollection}
   */
  get uploadCollection() {
    if (!this.has('external', 'uploadCollection')) {
      let uploadCollection = new TypedCollection({
        typedSchema: uploadEntrySchema,
        watchList: [
          'uploadProgress',
          'uuid',
        ],
        handler: (entries) => {
          this.pub('external', 'uploadList', entries);
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
          this.pub('external', 'commonProgress', commonProgress / items.length);
        }
      });

      this.addToExternalState({
        uploadCollection: uploadCollection,
      });
    }
    return this.read('external', 'uploadCollection');
  }

  /**
   * @type {Object<string, BlockComponent>}
   */
  get blockRegistry() {
    return this.read('external', 'registry');
  }

  /**
   * @type {{PUBKEY:string, MULTIPLE:number, CONFIRM_UPLOAD:number, IMG_ONLY:number, ACCEPT:string, STORE:number, CAMERA_MIRROR:number, EXT_SRC_LIST:string, MAX_FILES:number}}
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

  disconnectedCallback() {
    super.disconnectedCallback();
    // TODO: destroy uploadCollection
  }

}

BlockComponent.enum = ENUM;