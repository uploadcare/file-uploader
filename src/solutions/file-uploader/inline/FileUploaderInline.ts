import { html } from 'lit';
import { state } from 'lit/decorators.js';
import type { UploaderController } from '../../../abstract/controllers/UploaderController';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { ACTIVITY_TYPES } from '../../../lit/activity-constants';
import { SolutionChildBlock } from '../../../lit/SolutionChildBlock';
import './index.css';

import { fileUploaderLazyPlugins } from '../lazyPlugins.js';

import '../../../blocks/StartFrom/StartFrom';
import '../../../blocks/DropArea/DropArea';
import '../../../blocks/SourceList/SourceList';
import '../../../blocks/Copyright/Copyright';
import '../../../blocks/UploadList/UploadList';
import '../../../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import '../../../blocks/PluginActivityRenderer/PluginActivityRenderer';

export class FileUploaderInline extends SolutionChildBlock {
  public static override lazyPlugins = fileUploaderLazyPlugins;

  // Type-only: feeds the JSX attribute typing (`ReflectAttributes` in
  // `types/jsx.d.ts` reads `attributesMeta`). Kept on the ChildBlock port —
  // the documented attribute surface, same as the merged `Config` port.
  public declare attributesMeta: {
    'ctx-name': string;
  };
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-inline'];

  @state()
  private _couldCancel = false;

  private _handleCancel = (): void => {
    if (this._couldHistoryBack) {
      this.bag.router.traverse('onBack');
      return;
    }

    if (this._couldShowList) {
      this.bag.router.setActivity(ACTIVITY_TYPES.UPLOAD_LIST);
    }
  };

  private get _couldHistoryBack(): boolean {
    const history = this.bag.router.history;
    if (history.length <= 1) {
      return false;
    }
    return history[history.length - 1] !== ACTIVITY_TYPES.START_FROM;
  }

  private get _couldShowList(): boolean {
    const uploadList = this.bag.ctx.read('*uploadList') ?? [];
    return this.uploader.config.get('showEmptyList') || (Array.isArray(uploadList) && uploadList.length > 0);
  }

  protected override controllerReady(ctrl: UploaderController): void {
    super.controllerReady(ctrl);

    this.bag.telemetryManager.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    const initActivity = ACTIVITY_TYPES.START_FROM;

    // Inline renders every activity in place (no modal), so all navigation
    // targets the background slot; a completed flow returns to start-from.
    this.bag.router.navigationStrategy = () => 'background';
    this.bag.router.configure({ doneActivity: ACTIVITY_TYPES.START_FROM });

    this.subActivity((val) => {
      if (!val) {
        this.bag.router.setActivity(initActivity);
      }
    });

    this.trackSub(
      this.bag.ctx.sub('*uploadList', (list) => {
        if (list.length > 0 && this.bag.router.currentActivity === initActivity) {
          this.bag.router.setActivity(ACTIVITY_TYPES.UPLOAD_LIST);
        }
      }),
    );

    this.subRouter(() => {
      this._couldCancel = this._couldHistoryBack || this._couldShowList;
    });
  }

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [(listener: () => void) => ctrl.locale.subscribe(listener)];
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
