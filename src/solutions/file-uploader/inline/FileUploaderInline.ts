import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { ACTIVITY_TYPES } from '../../../abstract/activity-constants';
import { CollectionStateController } from '../../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../../abstract/controllers/ConfigController';
import { RouterController } from '../../../abstract/controllers/RouterController';
import type { ControllerContainer } from '../../../abstract/di/ControllerContainer';
import { inject } from '../../../abstract/di/inject';
import { InternalEventType } from '../../../abstract/EventEmitter';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { SolutionChildBlock } from '../../../lit/SolutionChildBlock';
import { subscription, type Unsubscribe } from '../../../lit/subscription';
import './index.css';

import { renderInlineStartFrom } from '../layout-fragments.js';
import { fileUploaderLazyPlugins } from '../lazyPlugins.js';

import '../../../blocks/StartFrom/StartFrom';
import '../../../blocks/DropArea/DropArea';
import '../../../blocks/SourceList/SourceList';
import '../../../blocks/Copyright/Copyright';
import '../../../blocks/UploadList/UploadList';
import '../../../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import '../../../blocks/PluginActivityRenderer/PluginActivityRenderer';

export class FileUploaderInline extends SolutionChildBlock {
  public static override isUploader = true;
  public static override hasModal = false;
  public static override lazyPlugins = fileUploaderLazyPlugins;

  // Type-only: feeds the JSX attribute typing (`ReflectAttributes` in
  // `types/jsx.d.ts` reads `attributesMeta`). Kept on the ChildBlock port —
  // the documented attribute surface, same as the merged `Config` port.
  public declare attributesMeta: {
    'ctx-name': string;
  };
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-inline'];

  @inject(RouterController) private readonly _router!: RouterController;
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;

  /**
   * Whether the cancel button shows — drives `.uc-cancel-btn[hidden]`, which the
   * inline `:has(.uc-cancel-btn[hidden])` CSS keys off.
   *
   * This is recomputed ONLY on a router notify (`_wireCouldCancel`) and stored
   * in `@state`. It is deliberately NOT a tracked render read of
   * `uploadList`/`showEmptyList`: `_couldShowList` reads them untracked, so an
   * upload-list change that does NOT coincide with a router transition (e.g. the
   * list emptying without a `setActivity`) keeps the previously-computed value
   * (stale by design). A tracked getter would re-hide the button on such a
   * change (flipping the inline `:has(.uc-cancel-btn[hidden])` layout). Do not
   * "re-fix" this into a reactive read.
   */
  @state()
  private _couldCancel = false;

  private _handleCancel = (): void => {
    if (this._couldHistoryBack) {
      this._router.traverse('onBack');
      return;
    }

    if (this._couldShowList) {
      this._router.setActivity(ACTIVITY_TYPES.UPLOAD_LIST);
    }
  };

  private get _couldHistoryBack(): boolean {
    const history = this._router.history;
    if (history.length <= 1) {
      return false;
    }
    return history[history.length - 1] !== ACTIVITY_TYPES.START_FROM;
  }

  private get _couldShowList(): boolean {
    // Untracked `get()`: this feeds the router-driven `_couldCancel` recompute
    // and must not subscribe the render to these keys (see `_couldCancel`).
    const uploadList = this._collectionState.get('uploadList');
    return this._config.get('showEmptyList') || uploadList.length > 0;
  }

  protected override controllerReady(container: ControllerContainer): void {
    super.controllerReady(container);

    this._telemetry.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    // Inline renders every activity in place (no modal), so all navigation
    // targets the background slot; a completed flow returns to start-from.
    const router = this._router;
    router.navigationStrategy = () => 'background';
    router.configure({ doneActivity: ACTIVITY_TYPES.START_FROM });
  }

  // Re-seed start-from when everything closes. Atomic `observeCurrentActivity`
  // (dedup) + eager fire.
  /** @internal */
  @subscription()
  protected _wireActivityCoordination(): Unsubscribe {
    return this._router.observeCurrentActivity(
      (activity) => {
        if (!activity) {
          this._router.setActivity(ACTIVITY_TYPES.START_FROM);
        }
      },
      { immediate: true },
    );
  }

  // Background slot follows file state (drives `setActivity`, not a render read).
  // Atomic `observe('uploadList')` fires only on a real `uploadList` change, not
  // every collection-state notify. Does NOT drive `_couldCancel` (see its doc).
  /** @internal */
  @subscription()
  protected _wireUploadListActivity(): Unsubscribe {
    return this._collectionState.observe(
      'uploadList',
      (list) => {
        if (list.length > 0 && this._router.currentActivity === ACTIVITY_TYPES.START_FROM) {
          this._router.setActivity(ACTIVITY_TYPES.UPLOAD_LIST);
        }
      },
      { immediate: true },
    );
  }

  // The cancel-button recompute: fires eagerly, then on EVERY router notify — a
  // coarse subscription, deliberately not atomic. The button's sole `?hidden`
  // re-render trigger (see `_couldCancel`).
  /** @internal */
  @subscription()
  protected _wireCouldCancel(): Unsubscribe {
    const recompute = () => {
      this._couldCancel = this._couldHistoryBack || this._couldShowList;
    };
    recompute();
    return this._router.subscribe(recompute);
  }

  public override render() {
    return html`
      ${super.render()}
      ${renderInlineStartFrom({
        onCancel: this._handleCancel,
        cancelLabel: this.l10n('start-from-cancel'),
        cancelHidden: !this._couldCancel,
      })}
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
