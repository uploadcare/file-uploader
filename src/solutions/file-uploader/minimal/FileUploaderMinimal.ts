import { html, type PropertyValues } from 'lit';
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
import { renderMinimalTrigger, renderModalSourcePicker } from '../layout-fragments.js';
import { fileUploaderLazyPlugins } from '../lazyPlugins.js';

import '../../../blocks/Modal/Modal';
import '../../../blocks/StartFrom/StartFrom';
import '../../../blocks/DropArea/DropArea';
import '../../../blocks/Copyright/Copyright';
import '../../../blocks/UploadList/UploadList';
import '../../../blocks/SourceList/SourceList';
import '../../../blocks/CloudImageEditorActivity/CloudImageEditorActivity';
import '../../../blocks/PluginActivityRenderer/PluginActivityRenderer';
import type { L10nKey } from '../../../abstract/l10n';

export class FileUploaderMinimal extends SolutionChildBlock {
  public static override isUploader = true;
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
   * only in grid mode without `multiple`. Read in `render()`, so it tracks both
   * keys.
   */
  private get _singleUpload(): boolean {
    const config = this._config;
    return config.getTracked('filesViewMode') === 'grid' && !config.getTracked('multiple');
  }

  /** Trigger label key, derived reactively from `multiple`. */
  private get _buttonTextKey(): L10nKey {
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
  /** @internal */
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
  /** @internal */
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
  /** @internal */
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

    // Host `[mode]` + `[single-grid]` attributes: the stylesheet keys the
    // list/grid layout and the one-column `--uc-grid-col` off them, so a
    // consumer's inline `--uc-grid-col` still wins. Reading both keys via
    // `getTracked` auto-tracks them under `SignalWatcher`, so a config change
    // re-runs this update. Neither is a reactive property, so toggling them
    // schedules no further update.
    this.setAttribute('mode', this._config.getTracked('filesViewMode'));
    this.toggleAttribute('single-grid', this._singleUpload);
  }

  public override render() {
    return html`
      ${super.render()}
      ${renderMinimalTrigger({
        single: this._singleUpload,
        label: this.l10n(this._buttonTextKey),
      })}
      <uc-upload-list chrome="compact"></uc-upload-list>

      ${renderModalSourcePicker({
        onCancel: () => this._router.traverse('onCancel'),
        cancelLabel: this.l10n('start-from-cancel'),
      })}

      <uc-plugin-activity-renderer mode="modal"></uc-plugin-activity-renderer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-uploader-minimal': FileUploaderMinimal;
  }
}
