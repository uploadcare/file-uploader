import { BaseComponent } from '../../symbiote/core/BaseComponent.js';
import { TypedCollection } from '../../symbiote/core/TypedCollection.js';
import { uploadEntrySchema } from './uploadEntrySchema.js';

export class UploadData extends BaseComponent {

  constructor() {
    super();

    this.uploadCollection = new TypedCollection({
      typedSchema: uploadEntrySchema,
      watchList: [
        'uploadProgress',
        'uuid',
      ],
      handler: (entries) => {
        this.externalState.pub('uploadList', entries);
      },
    });

    this.uploadCollection.observe((changeMap) => {
      if (changeMap.uploadProgress) {
        let commonProgress = 0;
        /** @type {String[]} */
        let items = this.uploadCollection.findItems((entry) => {
          return !entry.getValue('uploadErrorMsg');
        });
        items.forEach((id) => {
          commonProgress += this.uploadCollection.readProp(id, 'uploadProgress');
        });
        this.externalState.pub('commonProgress', commonProgress / items.length);
      }
    });
  }

  initCallback() {
    this.addToExternalState({
      commonProgress: 0,
      pubkey: 'demopublickey',
      uploadList: [],
      uploadCollection: this.uploadCollection,
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.uploadCollection.destroy();
  }

}
