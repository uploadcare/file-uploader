import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { LitSolutionBlock } from '../../../lit/LitSolutionBlock';
import './index.css';

type BaseInitState = InstanceType<typeof LitSolutionBlock>['init$'];
interface FileUploaderRegularInitState extends BaseInitState {
  '*solution': string;
}

export class FileUploaderRegular extends LitSolutionBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-regular'];

  @property({ type: Boolean })
  public headless = false;

  public constructor() {
    super();

    this.init$ = {
      ...this.init$,
      '*solution': this.tagName,
    } as FileUploaderRegularInitState;
  }

  public override initCallback(): void {
    super.initCallback();

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });
  }

  public override render() {
    return html`
    ${super.render()}
  <uc-simple-btn ?hidden=${this.headless}></uc-simple-btn>

  <uc-modal id="start-from" strokes block-body-scrolling>
    <uc-start-from>
      <uc-drop-area with-icon clickable></uc-drop-area>
      <uc-source-list role="list" wrap></uc-source-list>
      <button type="button" class="uc-secondary-btn" @click=${this.$['*historyBack']}>${this.l10n('start-from-cancel')}</button>
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
  }
}
