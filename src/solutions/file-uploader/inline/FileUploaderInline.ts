import { html } from 'lit';
import { CollectionStateController } from '../../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../../abstract/controllers/ConfigController';
import { RouterController } from '../../../abstract/controllers/RouterController';
import type { UploaderController } from '../../../abstract/controllers/UploaderController';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
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

  public static override readonly uses = [
    RouterController,
    ConfigController,
    CollectionStateController,
    TelemetryManager,
  ] as const;

  private _handleCancel = (): void => {
    if (this._couldHistoryBack) {
      this.use(RouterController).traverse('onBack');
      return;
    }

    if (this._couldShowList) {
      this.use(RouterController).setActivity(ACTIVITY_TYPES.UPLOAD_LIST);
    }
  };

  private get _couldHistoryBack(): boolean {
    const history = this.use(RouterController).history;
    if (history.length <= 1) {
      return false;
    }
    return history[history.length - 1] !== ACTIVITY_TYPES.START_FROM;
  }

  private get _couldShowList(): boolean {
    // Tracked reads: `uploadList` (CollectionStateController) + `showEmptyList`
    // (ConfigController) auto-track under `SignalWatcher`, so the cancel button's
    // `?hidden=` re-renders when either changes — replacing the v1 `subRouter`
    // recompute (which only caught these via a coincident router change).
    const uploadList = this.use(CollectionStateController).getTracked('uploadList');
    return this.use(ConfigController).getTracked('showEmptyList') || uploadList.length > 0;
  }

  /**
   * Whether the cancel button shows — drives `.uc-cancel-btn[hidden]`, which the
   * inline `:has(.uc-cancel-btn[hidden])` CSS keys off. A tracked getter read in
   * `render()` (drops the v1 `@state` + `subRouter`): `_couldShowList` tracks
   * `uploadList`/`showEmptyList`; the explicit `router.currentActivity` read
   * tracks history changes (history only mutates alongside an effective-activity
   * transition, and `currentActivity` is the `@signalState` that captures it),
   * so a navigation re-renders the button exactly as the v1 `subRouter` did.
   */
  private get _couldCancel(): boolean {
    // Track the router's effective activity so history-driven changes re-render.
    void this.use(RouterController).currentActivity;
    return this._couldHistoryBack || this._couldShowList;
  }

  protected override controllerReady(ctrl: UploaderController): void {
    super.controllerReady(ctrl);

    this.use(TelemetryManager).sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    const initActivity = ACTIVITY_TYPES.START_FROM;

    // Inline renders every activity in place (no modal), so all navigation
    // targets the background slot; a completed flow returns to start-from.
    const router = this.use(RouterController);
    router.navigationStrategy = () => 'background';
    router.configure({ doneActivity: ACTIVITY_TYPES.START_FROM });

    // Side-effecting activity coordination (re-seeds start-from when everything
    // closes) — stays imperative.
    this.subActivity((val) => {
      if (!val) {
        router.setActivity(initActivity);
      }
    });

    // Imperative side-effecting sub (drives `router.setActivity`, not a render
    // read), so it stays on the v1 `bag.ctx` subscription.
    this.trackSub(
      this.bag.ctx.sub('*uploadList', (list) => {
        if (list.length > 0 && router.currentActivity === initActivity) {
          router.setActivity(ACTIVITY_TYPES.UPLOAD_LIST);
        }
      }),
    );
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
