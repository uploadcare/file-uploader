import { ContextProvider } from '@lit/context';
import { html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import './uploader-tray.css';
import '../../../blocks/FileItem/FileItem';
import '../../../blocks/Icon/Icon';
import '../../../blocks/ProgressBar/ProgressBar';
import { ChildBlock } from '../../../abstract/ChildBlock';
import { uploaderContext } from '../../../abstract/context';
import { NAVIGATE_CANCEL } from '../../../abstract/controllers/RouterController';
import { TrayLifecycleController } from '../../../abstract/controllers/TrayLifecycleController';
import type { UploaderController } from '../../../abstract/controllers/UploaderController';
import { buildOutputCollectionState } from '../../../abstract/output-collection-state';
import type { UploadEntry } from '../../../abstract/UploadEntry';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * `<uc-uploader-tray>`. Floating corner panel showing per-file upload progress
 * for an attached `<uc-uploader>`. Resolved via `ctx-name` through the
 * `UploaderRegistry` or `@lit/context`. View-only — no own controller, no
 * standalone mode.
 *
 * **Routing override**: when attached, the tray installs an `afterFileAdd`
 * router hook that returns `null` — files added through the attached
 * uploader's flow no longer auto-open the upload-list modal. The tray IS the
 * upload-status surface; the modal stays closed.
 *
 * **Trigger redirect**: the tray also installs a `beforeChange` router
 * hook that catches navigations to `upload-list`. When the tray is
 * expanded, it redirects the navigation to `start-from`; when collapsed,
 * it returns `NAVIGATE_CANCEL` and uncollapses itself instead. With no
 * files in the collection, the hook is a no-op.
 *
 * **Lifecycle**: visible whenever the collection is non-empty. Collapsible
 * header (chevron), not closable. The plus button navigates the attached
 * uploader to `start-from`.
 */
export class UploaderTray extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-wgt-common', 'uc-uploader-tray'];

  @property({ type: String, reflect: true })
  public position: Position = 'bottom-right';

  @state() private _collapsed = false;

  private _provider?: ContextProvider<typeof uploaderContext, this>;
  private _unregisterAfterFileAdd?: () => void;
  private _unregisterBeforeChange?: () => void;
  private _lifecycle = new TrayLifecycleController(this);

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [
      ctrl.collection.subscribe.bind(ctrl.collection),
      ctrl.config.subscribe.bind(ctrl.config),
      ctrl.locale.subscribe.bind(ctrl.locale),
      ctrl.plugins.subscribe.bind(ctrl.plugins),
    ];
  }

  protected override controllerReady(ctrl: UploaderController): void {
    this._lifecycle.attach(ctrl);
    // Provide the controller to descendant <uc-file-item> rows via
    // @lit/context. Without this, FileItem would have to resolve through
    // the registry too (extra lookup, requires duplicating ctx-name).
    if (!this._provider) {
      this._provider = new ContextProvider(this, {
        context: uploaderContext,
        initialValue: ctrl,
      });
    } else {
      this._provider.setValue(ctrl);
    }
    // Suppress the default "navigate to upload-list" navigation after file
    // add. With the tray in place, the modal stays closed and the tray
    // becomes the visible upload-status surface. Mirrors DynamicBtn's hook
    // pattern.
    this._unregisterAfterFileAdd?.();
    this._unregisterAfterFileAdd = ctrl.router.hooks.afterFileAdd(() => null);

    // Intercept the preset's trigger button. `api.open()` with files in
    // the collection navigates to `upload-list`; we redirect that to
    // `start-from` (expanded tray) or cancel it and uncollapse (collapsed
    // tray). Other targets pass through unchanged.
    this._unregisterBeforeChange?.();
    this._unregisterBeforeChange = ctrl.router.hooks.beforeChange((ctx) => {
      if (ctx.proposed !== 'upload-list') return undefined;
      if (this._collapsed) {
        this._collapsed = false;
        return NAVIGATE_CANCEL;
      }
      return 'start-from';
    });
  }

  protected override controllerReleased(): void {
    this._lifecycle.detach();
    this._unregisterAfterFileAdd?.();
    this._unregisterAfterFileAdd = undefined;
    this._unregisterBeforeChange?.();
    this._unregisterBeforeChange = undefined;
  }

  public override updated(changed: PropertyValues<this>): void {
    super.updated?.(changed);
    this.setAttribute('phase', this._lifecycle.phase);
    this.toggleAttribute('collapsed', this._collapsed);
  }

  // ─── Header derivations ─────────────────────────────────────────────────

  private _t(key: string, vars?: Record<string, unknown>): string {
    return this.uploaderOrNull?.locale.t(key, vars) ?? key;
  }

  private _headerText(ctrl: UploaderController): string {
    const entries = ctrl.collection.entries;
    let succeed = 0;
    let uploading = 0;
    let failed = 0;
    let queued = 0;
    for (const e of entries) {
      if (e.getValue('errors').length > 0) failed += 1;
      else if (e.getValue('fileInfo')) succeed += 1;
      else if (e.getValue('isUploading') || e.getValue('isQueuedForUploading')) uploading += 1;
      else if (e.getValue('isValidationPending') || e.getValue('isQueuedForValidation')) queued += 1;
    }
    if (uploading > 0 || queued > 0) {
      return this._t('header-uploading', { count: uploading + queued });
    }
    if (failed > 0) return this._t('header-failed', { count: failed });
    if (succeed > 0) return this._t('header-succeed', { count: succeed });
    return this._t('header-total', { count: entries.length });
  }

  // ─── Handlers ───────────────────────────────────────────────────────────

  private _handleCollapseToggle = (): void => {
    this._collapsed = !this._collapsed;
  };

  private _handleAddClick = (): void => {
    // Open the attached uploader's source picker. The preset's
    // navigationStrategy decides whether it lands inline or in a modal.
    this.uploader.router.navigate('start-from');
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  public override render() {
    const ctrl = this.uploaderOrNull;
    if (this.ctxName === undefined) {
      return html`<!-- uc-uploader-tray: set 'ctx-name' to attach to an uploader -->`;
    }

    const phase = this._lifecycle.phase;
    const showPanel = phase !== 'hidden' && ctrl !== null;
    const entries: UploadEntry[] = ctrl?.collection.entries ?? [];
    const collectionState = ctrl ? buildOutputCollectionState(ctrl) : null;
    const progress = collectionState?.progress ?? 0;
    const isUploading = collectionState?.isUploading ?? false;

    if (!showPanel) return nothing;

    return html`
      <div
        class="uc-tray-panel"
        role="region"
        aria-label=${this._t('header-total', { count: entries.length })}
      >
        <div class="uc-tray-header">
          <button
            type="button"
            class="uc-tray-header-clickable"
            @click=${this._handleCollapseToggle}
            aria-expanded=${!this._collapsed}
            title=${this._collapsed ? 'Expand' : 'Collapse'}
          >
            <span class="uc-tray-header-text" aria-live="polite">
              ${ctrl ? this._headerText(ctrl) : ''}
            </span>
            <uc-icon class="uc-tray-chevron" name="arrow-down"></uc-icon>
          </button>
          <button
            type="button"
            class="uc-tray-mini-btn"
            @click=${this._handleAddClick}
            title=${this._t('add-more')}
            aria-label=${this._t('add-more')}
          >
            <uc-icon name="add"></uc-icon>
          </button>
        </div>
        <uc-progress-bar
          class="uc-tray-progress"
          .value=${progress}
          .visible=${isUploading}
        ></uc-progress-bar>
        <div class="uc-tray-body">
          ${repeat(
            entries,
            (entry) => entry.internalId,
            (entry) => html`<uc-file-item .entry=${entry}></uc-file-item>`,
          )}
        </div>
      </div>
    `;
  }
}

if (!customElements.get('uc-uploader-tray')) customElements.define('uc-uploader-tray', UploaderTray);

declare global {
  interface HTMLElementTagNameMap {
    'uc-uploader-tray': UploaderTray;
  }
}
