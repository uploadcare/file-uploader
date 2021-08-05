import { BaseComponent } from '../../symbiote/core/BaseComponent.js';
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
      this.externalState.pub('registry', registry);

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
          this.externalState.pub('uploadList', entries);
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
          this.externalState.pub('commonProgress', commonProgress / items.length);
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

  disconnectedCallback() {
    super.disconnectedCallback();
    // TODO: destroy uploadCollection
  }

}