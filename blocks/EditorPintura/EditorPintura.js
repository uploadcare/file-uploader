import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { appendDefaultEditor } from '@pqina/pintura';
import { uploadFile } from '@uploadcare/upload-client';

export class EditorPintura extends UploaderBlock {
  couldBeCtxOwner = true;
  activityType = ActivityBlock.activities.EDITOR_PINTURA;
  static styleAttrs = ['uc-editor-pintura'];

  initCallback() {
    super.initCallback();

    this.registerActivity(this.activityType, {
      onActivate: () => this.mounted(),
      onDeactivate: () => this.unmounted(),
    });
    console.log('EditorPintura');
  }

  mounted() {
    const { internalId } = this.activityParams;
    this._entry = this.uploadCollection.read(internalId);
    const file = this._entry.getValue('file');

    const cdnUrl = this._entry.getValue('cdnUrl');

    console.log({ cdnUrl, _entry: this._entry });

    this._instance = appendDefaultEditor(this, {
      src: file,
      imageCropAspectRatio: 1,
    });

    this._instance.on('load', (res) => console.log('inline result', res));

    this._instance.on('process', async (imageWriterResult) => {
      console.log({ imageWriterResult });
      const baseUploadClientOptions = await this.getUploadClientOptions();

      await uploadFile(imageWriterResult.dest, baseUploadClientOptions);

      this.historyBack();
    });
  }

  unmounted() {
    this._instance = undefined;
    this._entry = undefined;
    this.innerHTML = '';
  }
}

EditorPintura.template = ``;
