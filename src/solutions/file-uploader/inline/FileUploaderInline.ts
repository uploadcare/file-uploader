import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { CollectionStateController } from '../../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../../abstract/controllers/ConfigController';
import { RouterController } from '../../../abstract/controllers/RouterController';
import type { ControllerContainer } from '../../../abstract/di/ControllerContainer';
import { inject } from '../../../abstract/di/inject';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { ACTIVITY_TYPES, type ActivityId } from '../../../lit/activity-constants';
import { SolutionChildBlock } from '../../../lit/SolutionChildBlock';
import { subscription, type Unsubscribe } from '../../../lit/subscription';
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

  @inject(RouterController) private readonly _router!: RouterController;
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;

  /**
   * Whether the cancel button shows — drives `.uc-cancel-btn[hidden]`, which the
   * inline `:has(.uc-cancel-btn[hidden])` CSS keys off.
   *
   * Behavior-preservation (M-god step 6b-4 review): this is recomputed ONLY on a
   * router notify (see the subscription in `controllerReady`), stored in `@state`
   * — exactly as v1 did via `subRouter`. It is deliberately NOT a tracked render
   * read of `uploadList`/`showEmptyList`: v1 read those imperatively inside the
   * router-notify callback, so an upload-list change that does NOT coincide with
   * a router transition (e.g. the list emptying without a `setActivity`) never
   * refires the recompute and the previously-computed value is retained
   * (stale-by-design). A tracked getter would re-hide the button on such a
   * change and diverge from v1 (flipping the inline `:has(.uc-cancel-btn[hidden])`
   * layout). Do not "re-fix" this into a reactive read.
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
    // Imperative (non-tracking) reads — v1 read `*uploadList`/`showEmptyList` off
    // the store inside the router-notify callback, NOT reactively. `get()` (not
    // `getTracked()`) preserves that: this getter feeds the router-driven
    // `_couldCancel` recompute, so it must not itself subscribe the render to
    // these keys.
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
  @subscription()
  protected _wireActivityCoordination(): Unsubscribe {
    const apply = (activity: ActivityId | null) => {
      if (!activity) {
        this._router.setActivity(ACTIVITY_TYPES.START_FROM);
      }
    };
    apply(this._router.currentActivity);
    return this._router.observeCurrentActivity(apply);
  }

  // Background slot follows file state (drives `setActivity`, not a render read).
  // Atomic `observe('uploadList')` fires only on a real `uploadList` change, not
  // every collection-state notify. Does NOT drive `_couldCancel` (see its doc).
  @subscription()
  protected _wireUploadListActivity(): Unsubscribe {
    const initialList = this._collectionState.get('uploadList');
    const apply = (list: typeof initialList) => {
      if (list.length > 0 && this._router.currentActivity === ACTIVITY_TYPES.START_FROM) {
        this._router.setActivity(ACTIVITY_TYPES.UPLOAD_LIST);
      }
    };
    apply(initialList);
    return this._collectionState.observe('uploadList', apply);
  }

  // v1-exact cancel-button recompute: fires eagerly, then on EVERY router notify
  // (the v1 `subRouter` contract) — a coarse subscription, deliberately not
  // atomic. `_couldCancel` is written ONLY here (stale-by-design between router
  // transitions, see its doc), and `_couldShowList`/`_couldHistoryBack` read
  // imperatively, so this is the button's sole `?hidden` re-render trigger.
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
