import { html } from 'lit';
import { state } from 'lit/decorators.js';
import './index.css';

import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { LitActivityBlock } from '../../../lit/LitActivityBlock';
import { LitSolutionBlock } from '../../../lit/LitSolutionBlock';

type BaseInitState = InstanceType<typeof LitSolutionBlock>['init$'];

type FileUploaderInlineInitState = BaseInitState & {
  '*solution': string;
};

export class FileUploaderInline extends LitSolutionBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-inline'];

  @state()
  private couldCancel = false;

  public constructor() {
    super();

    this.init$ = {
      ...this.init$,
      '*solution': this.tagName,
    } as FileUploaderInlineInitState;
  }

  private _handleCancel = (): void => {
    if (this.couldHistoryBack) {
      const historyBack = this.$['*historyBack'] as (() => void) | undefined;
      historyBack?.();
      return;
    }

    if (this.couldShowList) {
      this.$['*currentActivity'] = LitActivityBlock.activities.UPLOAD_LIST;
    }
  };

  private get couldHistoryBack(): boolean {
    const history = this.$['*history'] as string[] | undefined;
    if (!history || history.length <= 1) {
      return false;
    }
    return history[history.length - 1] !== LitActivityBlock.activities.START_FROM;
  }

  private get couldShowList(): boolean {
    const uploadList = this.$['*uploadList'] as unknown[] | undefined;
    return this.cfg.showEmptyList || (Array.isArray(uploadList) && uploadList.length > 0);
  }

  private _getInitActivity(): string {
    return (this.getCssData('--cfg-init-activity') as string | undefined) || LitActivityBlock.activities.START_FROM;
  }

  public override initCallback(): void {
    super.initCallback();

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    const initActivity = this._getInitActivity();

    this.sub('*currentActivity', (val: string | null) => {
      if (!val) {
        this.$['*currentActivity'] = initActivity;
      }
    });

    this.sub('*uploadList', (list: unknown) => {
      if (Array.isArray(list) && list.length > 0 && this.$['*currentActivity'] === initActivity) {
        this.$['*currentActivity'] = LitActivityBlock.activities.UPLOAD_LIST;
      }
    });

    this.sub('*history', () => {
      this.couldCancel = this.couldHistoryBack || this.couldShowList;
    });
  }

  public override render() {
    return html`
      ${super.render()}
      <uc-start-from>
        <uc-drop-area with-icon clickable></uc-drop-area>
        <uc-source-list role="list" wrap></uc-source-list>
        <button
          type="button"
          class="uc-cancel-btn uc-secondary-btn"
          @click=${this._handleCancel}
          ?hidden=${!this.couldCancel}
        >
        ${this.l10n('start-from-cancel')}
        </button>
        <uc-copyright></uc-copyright>
      </uc-start-from>
      <uc-upload-list></uc-upload-list>
      <uc-camera-source></uc-camera-source>
      <uc-url-source></uc-url-source>
      <uc-external-source></uc-external-source>
      <uc-cloud-image-editor-activity></uc-cloud-image-editor-activity>
    `;
  }
}
