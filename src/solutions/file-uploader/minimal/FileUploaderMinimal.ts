import { html, type PropertyValues } from 'lit';
import { CollectionStateController } from '../../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../../abstract/controllers/ConfigController';
import { LocaleController } from '../../../abstract/controllers/LocaleController';
import { RouterController } from '../../../abstract/controllers/RouterController';
import type { ControllerContainer } from '../../../abstract/di/ControllerContainer';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { InternalEventType } from '../../../blocks/UploadCtxProvider/EventEmitter';
import { ACTIVITY_TYPES } from '../../../lit/activity-constants';
import { SolutionChildBlock } from '../../../lit/SolutionChildBlock';
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

  public static override readonly uses = [
    RouterController,
    ConfigController,
    CollectionStateController,
    TelemetryManager,
  ] as const;

  /**
   * Grid single-upload flag feeding `?single=` on the inline drop-area — true
   * only in grid mode without `multiple`. A tracked `getTracked` getter (drops
   * the v1 `@state` + nested `subConfigValue`): reading it in `render()`
   * auto-tracks both keys under `SignalWatcher`, so a config change re-renders.
   */
  private get _singleUpload(): boolean {
    const config = this.use(ConfigController);
    return config.getTracked('filesViewMode') === 'grid' && !config.getTracked('multiple');
  }

  /** Trigger label key, derived reactively from `multiple` (drops the v1 `@state`). */
  private get _buttonTextKey(): string {
    return this.use(ConfigController).getTracked('multiple') ? 'choose-files' : 'choose-file';
  }

  protected override controllerReady(container: ControllerContainer): void {
    super.controllerReady(container);

    this.use(TelemetryManager).sendEvent({
      eventType: InternalEventType.INIT_SOLUTION,
    });

    // Minimal layers a modal source picker over a persistent inline view: the
    // upload list is the *background* (it replaces the inline trigger once files
    // exist, no modal); everything else (the start-from picker, every source
    // activity) is *foreground* and opens over it. The inline `<uc-start-from>`
    // and `<uc-upload-list>` light up via the background slot's `[active]`
    // attribute (no manual class toggling). A completed flow lands on the
    // upload list.
    const router = this.use(RouterController);
    router.navigationStrategy = (to) => (to === ACTIVITY_TYPES.UPLOAD_LIST ? 'background' : 'foreground');
    router.configure({ doneActivity: ACTIVITY_TYPES.UPLOAD_LIST });

    // Background slot follows file state: the upload list once files exist,
    // otherwise the start-from trigger. Imperative side-effecting sub (drives
    // `router.setActivity`, not a render read), now sourced from
    // `CollectionStateController` directly instead of the `*uploadList` `bag.ctx`
    // key. The per-key `Object.is` dedup + eager fire below reproduce the exact
    // `PubSub.sub('*uploadList', …)` semantics (`_subDerived`): fire once now,
    // then only when the `uploadList` reference actually changes — NOT on every
    // coarse collection-state notify (e.g. a `commonProgress` tick).
    const collectionState = this.use(CollectionStateController);
    let lastUploadList = collectionState.get('uploadList');
    const applyUploadListActivity = (list: typeof lastUploadList) => {
      const hasFiles = list.length > 0;
      router.setActivity(hasFiles ? ACTIVITY_TYPES.UPLOAD_LIST : ACTIVITY_TYPES.START_FROM);
    };
    applyUploadListActivity(lastUploadList);
    this.trackSub(
      collectionState.subscribe(() => {
        const next = collectionState.get('uploadList');
        if (!Object.is(next, lastUploadList)) {
          lastUploadList = next;
          applyUploadListActivity(next);
        }
      }),
    );

    // Side-effecting activity coordination (closes the modal on upload-list,
    // re-seeds start-from when everything closes) — stays imperative, now off
    // `RouterController` directly (replaces `subActivity`). The current-activity
    // dedup + eager fire reproduce `subActivity`'s exact contract.
    let lastActivity = router.currentActivity;
    const applyActivityCoordination = (val: typeof lastActivity) => {
      if (val === ACTIVITY_TYPES.UPLOAD_LIST) {
        router.closeModal();
      }
      if (!val) {
        router.setActivity(ACTIVITY_TYPES.START_FROM);
      }
    };
    applyActivityCoordination(lastActivity);
    this.trackSub(
      router.subscribe(() => {
        const next = router.currentActivity;
        if (next !== lastActivity) {
          lastActivity = next;
          applyActivityCoordination(next);
        }
      }),
    );

    // Side-effecting config write (minimal forces `confirmUpload` off) — stays
    // imperative, now off `ConfigController` directly (replaces `subConfigValue`).
    // Per-key `Object.is` dedup + eager fire reproduce `subConfigValue`'s contract.
    const config = this.use(ConfigController);
    let lastConfirmUpload = config.get('confirmUpload');
    const applyConfirmUpload = (confirmUpload: typeof lastConfirmUpload) => {
      if (confirmUpload !== false) {
        config.set('confirmUpload', false);
      }
    };
    applyConfirmUpload(lastConfirmUpload);
    this.trackSub(
      config.subscribe(() => {
        const next = config.get('confirmUpload');
        if (!Object.is(next, lastConfirmUpload)) {
          lastConfirmUpload = next;
          applyConfirmUpload(next);
        }
      }),
    );
  }

  protected override subscriptionsFor(container: ControllerContainer) {
    return [(listener: () => void) => container.get(LocaleController).subscribe(listener)];
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
    const config = this.use(ConfigController);
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
            @click=${() => this.use(RouterController).traverse('onCancel')}
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
