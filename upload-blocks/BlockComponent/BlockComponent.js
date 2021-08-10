import { BaseComponent } from '../../symbiote/core/BaseComponent.js';
import { ENUM } from './enum.js';
import { TypedCollection } from '../../symbiote/core/TypedCollection.js';
import { uploadEntrySchema } from './uploadEntrySchema.js';

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
        commonProgress: 0,
        pubkey: 'demopublickey',
        uploadList: [],
      });

      super.connectedCallback();

      let registry = this.read('external', 'registry');
      registry[this.tagName.toLowerCase()] = this;
      this.pub('external', 'registry', registry);

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