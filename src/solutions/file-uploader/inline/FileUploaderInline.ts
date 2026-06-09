import { html } from 'lit';
import { state } from 'lit/decorators.js';
import './index.css';

import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { LitActivityBlock, type RegisteredActivityType } from '../../../lit/LitActivityBlock';
import { LitSolutionBlock } from '../../../lit/LitSolutionBlock';
import { fileUploaderLazyPlugins } from '../lazyPlugins.js';

import '../../../blocks/StartFrom/StartFrom';
import '../../../blocks/DropArea/DropArea';
import '../../../blocks/SourceList/SourceList';
import '../../../blocks/Copyright/Copyright';
import '../../../blocks/UploadList/UploadList';
import '../../../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import '../../../blocks/PluginActivityRenderer/PluginActivityRenderer';

type BaseInitState = InstanceType<typeof LitSolutionBlock>['init$'];

type FileUploaderInlineInitState = BaseInitState;

export class FileUploaderInline extends LitSolutionBlock {
  public static override lazyPlugins = fileUploaderLazyPlugins;

  public declare attributesMeta: {
    'ctx-name': string;
  };
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-inline'];

  @state()
  private _couldCancel = false;

  public constructor() {
    super();

    this.init$ = {
      ...this.init$,
    } as FileUploaderInlineInitState;
  }

  private _handleCancel = (): void => {
    if (this._couldHistoryBack) {
      this.router.back();
      return;
    }

    if (this._couldShowList) {
      this.router.setActivity(LitActivityBlock.activities.UPLOAD_LIST);
    }
  };

  private get _couldHistoryBack(): boolean {
    const history = this.router.history;
    if (history.length <= 1) {
      return false;
    }
    return history[history.length - 1] !== LitActivityBlock.activities.START_FROM;
  }

  private get _couldShowList(): boolean {
    const uploadList = this.$['*uploadList'] as unknown[] | undefined;
    return this.cfg.showEmptyList || (Array.isArray(uploadList) && uploadList.length > 0);
  }

  private _getInitActivity(): RegisteredActivityType {
    return (
      (this.getCssData('--cfg-init-activity') as RegisteredActivityType | undefined) ||
      LitActivityBlock.activities.START_FROM
    );
  }

  public override initCallback(): void {
    super.initCallback();

    this.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    const initActivity = this._getInitActivity();

    // Inline renders every activity in place (no modal), so all navigation
    // targets the background slot.
    this.router.navigationStrategy = () => 'background';

    this.subActivity((val) => {
      if (!val) {
        this.router.setActivity(initActivity);
      }
    });

    this.sub('*uploadList', (list) => {
      if (Array.isArray(list) && list.length > 0 && this.router.currentActivity === initActivity) {
        this.router.setActivity(LitActivityBlock.activities.UPLOAD_LIST);
      }
    });

    this.subRouter(() => {
      this._couldCancel = this._couldHistoryBack || this._couldShowList;
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
          ?hidden=${!this._couldCancel}
        >
          ${this.l10n('start-from-cancel')}
        </button>
        <uc-copyright></uc-copyright>
      </uc-start-from>
      <uc-upload-list></uc-upload-list>
      <uc-plugin-activity-renderer mode="inline"></uc-plugin-activity-renderer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-uploader-inline': FileUploaderInline;
  }
}
