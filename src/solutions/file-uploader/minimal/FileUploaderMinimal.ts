import { html, type PropertyValues } from 'lit';
import { CollectionStateController } from '../../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../../abstract/controllers/ConfigController';
import { RouterController } from '../../../abstract/controllers/RouterController';
import type { ControllerContainer } from '../../../abstract/di/ControllerContainer';
import { inject } from '../../../abstract/di/inject';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { ACTIVITY_TYPES } from '../../../lit/activity-constants';
import { SolutionChildBlock } from '../../../lit/SolutionChildBlock';
import { subscription, type Unsubscribe } from '../../../lit/subscription';
import './index.css';
import { fileUploaderLazyPlugins } from '../lazyPlugins.js';

import '../../../blocks/Modal/Modal';
import '../../../blocks/StartFrom/StartFrom';
import '../../../blocks/DropArea/DropArea';
import '../../../blocks/Copyright/Copyright';
import '../../../blocks/UploadList/UploadList';
import '../../../blocks/SourceList/SourceList';
import '../../../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import '../../../blocks/PluginActivityRenderer/PluginActivityRenderer';

export class FileUploaderMinimal extends SolutionChildBlock {
  public static override lazyPlugins = fileUploaderLazyPlugins;

  // Type-only: feeds the JSX attribute typing (`ReflectAttributes` in
  // `types/jsx.d.ts` reads `attributesMeta`). Kept on the ChildBlock port —
  // the documented attribute surface, same as the merged `Config` port.
  public declare attributesMeta: {
    'ctx-name': string;
  };
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-uploader-minimal'];

  @inject(RouterController) private readonly _router!: RouterController;
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;

  /**
   * Grid single-upload flag feeding `?single=` on the inline drop-area — true
   * only in grid mode without `multiple`. A tracked `getTracked` getter (drops
   * the v1 `@state` + nested `subConfigValue`): reading it in `render()`
   * auto-tracks both keys under `SignalWatcher`, so a config change re-renders.
   */
  private get _singleUpload(): boolean {
    const config = this._config;
    return config.getTracked('filesViewMode') === 'grid' && !config.getTracked('multiple');
  }

  /** Trigger label key, derived reactively from `multiple` (drops the v1 `@state`). */
  private get _buttonTextKey(): string {
    return this._config.getTracked('multiple') ? 'choose-files' : 'choose-file';
  }

  protected override controllerReady(container: ControllerContainer): void {
    super.controllerReady(container);

    this._telemetry.sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    // Minimal layers a modal source picker over a persistent inline view: the
    // upload list is the *background* (it replaces the inline trigger once files
    // exist, no modal); everything else (the start-from picker, every source
    // activity) is *foreground* and opens over it. The inline `<uc-start-from>`
    // and `<uc-upload-list>` light up via the background slot's `[active]`
    // attribute (no manual class toggling). A completed flow lands on the
    // upload list.
    const router = this._router;
    router.navigationStrategy = (to) => (to === ACTIVITY_TYPES.UPLOAD_LIST ? 'background' : 'foreground');
    router.configure({ doneActivity: ACTIVITY_TYPES.UPLOAD_LIST });
  }

  // Background slot follows file state: the upload list once files exist,
  // otherwise the start-from trigger. Side-effecting (drives `setActivity`, not
  // a render read); the atomic `observe('uploadList')` fires only on a real
  // `uploadList` change, not every collection-state notify (e.g. a progress tick).
  @subscription()
  protected _wireUploadListActivity(): Unsubscribe {
    return this._collectionState.observe(
      'uploadList',
      (list) => {
        this._router.setActivity(list.length > 0 ? ACTIVITY_TYPES.UPLOAD_LIST : ACTIVITY_TYPES.START_FROM);
      },
      { immediate: true },
    );
  }

  // Activity coordination: close the modal once the background lands on the
  // upload list; re-seed start-from when everything closes. Atomic
  // `observeCurrentActivity` (dedup) + eager fire.
  @subscription()
  protected _wireActivityCoordination(): Unsubscribe {
    return this._router.observeCurrentActivity(
      (activity) => {
        if (activity === ACTIVITY_TYPES.UPLOAD_LIST) {
          this._router.closeModal();
        }
        if (!activity) {
          this._router.setActivity(ACTIVITY_TYPES.START_FROM);
        }
      },
      { immediate: true },
    );
  }

  // Minimal forces `confirmUpload` off. Atomic `observe('confirmUpload')` + eager.
  @subscription()
  protected _wireForceConfirmUploadOff(): Unsubscribe {
    return this._config.observe(
      'confirmUpload',
      (confirmUpload) => {
        if (confirmUpload !== false) {
          this._config.set('confirmUpload', false);
        }
      },
      { immediate: true },
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);

    // Host `[mode]` attribute + `--uc-grid-col` style side-effects: the CSS
    // `[uc-file-uploader-minimal][mode="list"|"grid"]` selectors key off the
    // host attribute, so drive it here from the tracked config signals (the
    // Modal `willUpdate` + `getTracked` recipe, replacing the v1
    // `subConfigValue('filesViewMode')` with a nested `subConfigValue('multiple')`).
    // Reading both keys via `getTracked` auto-tracks them under `SignalWatcher`,
    // so a config change re-runs this update and re-applies the attribute/style —
    // matching the v1 subscription's reactivity. Neither is a reactive property,
    // so toggling them schedules no further update.
    const config = this._config;
    const mode = config.getTracked('filesViewMode');
    const multiple = config.getTracked('multiple');
    this.setAttribute('mode', mode);
    if (mode === 'grid' && !multiple) {
      this.style.setProperty('--uc-grid-col', '1');
    } else {
      this.style.removeProperty('--uc-grid-col');
    }
  }

  public override render() {
    return html`
      ${super.render()}
      <uc-start-from>
        <uc-drop-area
          ?single=${this._singleUpload}
          initflow
          clickable
          tabindex="0"
        ><span>${this.l10n(this._buttonTextKey)}</span></uc-drop-area>
        <uc-copyright></uc-copyright>
      </uc-start-from>
      <uc-upload-list></uc-upload-list>

      <uc-modal id="start-from" strokes block-body-scrolling>
        <uc-start-from>
          <uc-drop-area with-icon clickable></uc-drop-area>
          <uc-source-list role="list" wrap></uc-source-list>
          <button
            type="button"
            class="uc-secondary-btn"
            @click=${() => this._router.traverse('onCancel')}
          >${this.l10n('start-from-cancel')}</button>
        </uc-start-from>
      </uc-modal>

        <uc-plugin-activity-renderer mode="modal"></uc-plugin-activity-renderer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-uploader-minimal': FileUploaderMinimal;
  }
}
