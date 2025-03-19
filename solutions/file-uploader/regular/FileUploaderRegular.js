// @ts-check
import { SolutionBlock } from '../../../abstract/SolutionBlock.js';
import { asBoolean } from '../../../blocks/Config/validatorsType.js';

export class FileUploaderRegular extends SolutionBlock {
  static styleAttrs = [...super.styleAttrs, 'uc-file-uploader-regular'];

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      isHidden: false,
    };
  }

  initCallback() {
    super.initCallback();

    this.defineAccessor(
      'headless',
      /** @param {unknown} value */ (value) => {
        this.set$({ isHidden: asBoolean(value) });
      },
    );
  }
}

FileUploaderRegular.template = /* HTML */ `
  <uc-simple-btn set="@hidden: isHidden"></uc-simple-btn>

  <uc-modal id="start-from" strokes block-body-scrolling>
    <uc-start-from>
      <uc-drop-area with-icon clickable></uc-drop-area>
      <uc-source-list role="list" wrap></uc-source-list>
      <button type="button" l10n="start-from-cancel" class="uc-secondary-btn" set="onclick: *historyBack"></button>
      <uc-copyright></uc-copyright>
    </uc-start-from>
  </uc-modal>

  <uc-modal id="upload-list" strokes block-body-scrolling>
    <uc-upload-list></uc-upload-list>
  </uc-modal>

  <uc-modal id="camera" strokes block-body-scrolling>
    <uc-camera-source></uc-camera-source>
  </uc-modal>

  <uc-modal id="url" strokes block-body-scrolling>
    <uc-url-source></uc-url-source>
  </uc-modal>

  <uc-modal id="external" strokes block-body-scrolling>
    <uc-external-source></uc-external-source>
  </uc-modal>

  <uc-modal id="cloud-image-edit" strokes block-body-scrolling>
    <uc-cloud-image-editor-activity></uc-cloud-image-editor-activity>
  </uc-modal>
`;

FileUploaderRegular.bindAttributes({
  // @ts-expect-error TODO: fix types inside symbiote
  headless: null,
});
