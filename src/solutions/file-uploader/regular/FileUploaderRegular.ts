import './index.css';
import { SolutionBlock } from '../../../abstract/SolutionBlock';
import { asBoolean } from '../../../blocks/Config/validatorsType';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';

type BaseInitState = InstanceType<typeof SolutionBlock>['init$'];
interface FileUploaderRegularInitState extends BaseInitState {
  isHidden: boolean;
  '*solution': string;
}

export class FileUploaderRegular extends SolutionBlock {
  static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-regular'];

  constructor() {
    super();

    const initialState: FileUploaderRegularInitState = {
      ...this.init$,
      isHidden: false,
      '*solution': this.tagName,
    };

    this.init$ = initialState;
  }

  override initCallback(): void {
    super.initCallback();

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    this.defineAccessor('headless', (value: unknown) => {
      this.set$({ isHidden: asBoolean(value) });
    });
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
