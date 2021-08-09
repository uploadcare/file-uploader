import { BaseComponent } from '../../symbiote/core/BaseComponent.js';
import { ENUM } from './enum.js';
import { TypedCollection } from '../../symbiote/core/TypedCollection.js';
import { uploadEntrySchema } from './uploadEntrySchema.js';

export class BlockComponent extends BaseComponent {

  connectedCallback() {
    if (!this.__connectedOnce) {
      super.connectedCallback();

      this.addToExternalState({
        registry: Object.create(null),
      });
      let registry = this.externalState.read('registry');
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
    if (!this.externalState.has('uploadCollection')) {
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
        commonProgress: 0,
        pubkey: 'demopublickey',
        uploadList: [],
        uploadCollection: uploadCollection,
      });
    }
    return this.externalState.read('uploadCollection');
  }

  /**
   * @type {Object<string, BlockComponent>}
   */
  get blockRegistry() {
    return this.externalState.read('registry');
  }

  get config() {
    let conf = {};
    let style = window.getComputedStyle(this);
    for (let prop in BlockComponent.enum.CSS.CFG) {
      conf[prop] = JSON.parse(style.getPropertyValue(BlockComponent.enum.CSS.CFG[prop]).trim());
    }
    return conf;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // TODO: destroy uploadCollection
  }

}

BlockComponent.enum = ENUM;