// @ts-check
import { SolutionBlock } from '../../../abstract/SolutionBlock.js';
import { asBoolean } from '../../../blocks/Config/normalizeConfigValue.js';
import { EventType } from '../../../blocks/UploadCtxProvider/EventEmitter.js';

export class FileUploaderRegular extends SolutionBlock {
  static styleAttrs = [...super.styleAttrs, 'lr-file-uploader-regular'];

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

    this.sub(
      '*modalActive',
      (modalActive) => {
        if (this._lastModalActive !== modalActive) {
          this.emit(modalActive ? EventType.MODAL_OPEN : EventType.MODAL_CLOSE, undefined, { debounce: true });
        }

        /** @private */
        this._lastModalActive = modalActive;
      },
      false,
    );
  }
}

FileUploaderRegular.template = /* HTML */ `
  <lr-simple-btn set="@hidden: isHidden"></lr-simple-btn>

  <lr-modal strokes block-body-scrolling>
    <lr-start-from>
      <lr-drop-area with-icon clickable></lr-drop-area>
      <lr-source-list wrap></lr-source-list>
      <button type="button" l10n="start-from-cancel" class="uc-secondary-btn" set="onclick: *historyBack"></button>
      <lr-copyright></lr-copyright>
    </lr-start-from>
    <lr-upload-list></lr-upload-list>
    <lr-camera-source></lr-camera-source>
    <lr-url-source></lr-url-source>
    <lr-external-source></lr-external-source>
    <lr-cloud-image-editor-activity></lr-cloud-image-editor-activity>
  </lr-modal>

  <lr-progress-bar-common></lr-progress-bar-common>
`;

FileUploaderRegular.bindAttributes({
  // @ts-expect-error TODO: fix types inside symbiote
  headless: null,
});
