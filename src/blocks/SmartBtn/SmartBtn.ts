import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { cache } from 'lit/directives/cache.js';
import { classMap } from 'lit/directives/class-map.js';
import '../../blocks/SmartBtn/smart-btn-mode.css';
import '../../blocks/SmartBtn/smart-btn.css';
import '../DropArea/DropArea';
import '../DropDown/DropDown';
import '../FileItem/FileActionButton';
import '../Icon/Icon';
import './NoWrapModeSmartBtn';
import './PrimaryAction';
import '../SourceBtn/SourceBtn';
import '../Thumb/Thumb';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { buildOutputCollectionState } from '../../abstract/output-collection-state';
import type { OutputCollectionState, OutputCollectionStatus } from '../../types/exported';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

export type SmartButtonMode = 'auto' | 'menu' | 'toolbar' | 'compact';

const AUTO_MODE_INLINE_THRESHOLD = 3;

const iconsBasedOnMode: Record<Exclude<SmartButtonMode, 'toolbar'>, string> = {
  compact: 'paperclip',
  menu: 'arrow-dropdown',
  auto: 'arrow-dropdown',
};

interface SourceSplit {
  main: SourceButtonConfig | null;
  remain: SourceButtonConfig[];
}

const splitSources = (sources: SourceButtonConfig[], mode: SmartButtonMode): SourceSplit => {
  if (mode === 'compact' || sources.length === 0) {
    return { main: null, remain: sources };
  }
  return { main: sources[0] ?? null, remain: sources.slice(1) };
};

/**
 * v2 `<uc-smart-btn>`. Port of v1's SmartBtn — same DOM, same CSS,
 * same state machine. Combines a `<uc-primary-action>` (the main
 * button), optional inline `<uc-source-btn>` row OR `<uc-drop-down>`
 * (overflow menu), and a multi-state `<uc-file-action-button>` for
 * remove / abort. Drives layout from `config.smartButtonViewMode`
 * (`auto | toolbar | menu | compact`).
 *
 * Wraps everything in `<uc-drop-area>` so drag-and-drop targets the
 * whole button. Subscribes to the upload collection + group to keep
 * `_collection` and `_status` in sync, plus to the plugin registry for
 * the source list. Uses v2's `buildOutputCollectionState` (memoized
 * getters identical to v1) so the inner components see the same shape
 * v1 SmartBtn passes around.
 */
export class SmartBtn extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-smart-btn', 'uc-wgt-common'];

  @property({ attribute: 'dropzone', type: Boolean })
  public dropzone = true;

  @state()
  private _mode: SmartButtonMode = 'auto';

  @state()
  private _split: SourceSplit = { main: null, remain: [] };

  // Snapshot of the source-list shape we last split against — used to
  // detect when the resolved list actually changed and the split needs
  // a recompute. The list itself lives on `controller.sources.list`.
  private _splitKey = '';

  // `OutputCollectionState` is built fresh in `render()` (and locally
  // in `_handleRemove`). NOT a `@state` — v1 used a 300ms-throttled
  // setter, but in v2 reactivity already comes from
  // `controller.collection.subscribe`, and storing a fresh wrapper
  // object each cycle as `@state` would loop (every new wrapper is
  // `!==` the previous, so the setter requests another update).

  private _unregisterFileAddHook?: () => void;

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [
      ctrl.sources.subscribe.bind(ctrl.sources),
      ctrl.config.subscribe.bind(ctrl.config),
      ctrl.locale.subscribe.bind(ctrl.locale),
      ctrl.collection.subscribe.bind(ctrl.collection),
      ctrl.upload.subscribe.bind(ctrl.upload),
      ctrl.validation.subscribe.bind(ctrl.validation),
    ];
  }

  protected override controllerReady(ctrl: UploaderController): void {
    // v1's SmartBtn registers an `afterFileAdd` hook that suppresses
    // the default "open upload-list modal" navigation when the user
    // added the file directly from the smart button (no source picker
    // history). The button itself is the persistent status display so
    // there's nothing to surface in a modal.
    //
    //  - `historyLength > 0` (file added after navigating through
    //    start-from → camera, etc.): return `undefined` → fall through
    //    to the default route ('upload-list'), which opens the modal
    //    in regular preset.
    //  - `historyLength === 0` (file added straight from the trigger,
    //    drop, or system dialog): return `null` → `navigate(null)`
    //    closes any modal and clears the activity. The smart button
    //    now displays the upload status inline.
    this._unregisterFileAddHook = ctrl.router.hooks.afterFileAdd(() => {
      if (ctrl.router.history.length > 0) return undefined;
      return null;
    });
  }

  protected override controllerReleased(): void {
    this._unregisterFileAddHook?.();
    this._unregisterFileAddHook = undefined;
  }

  /**
   * Recompute the `@state`-tracked derived values (mode / sources /
   * split). Each is compared for actual change before assigning, so
   * willUpdate is idempotent — repeat calls with the same inputs
   * don't queue another update.
   */
  public override willUpdate(): void {
    const ctrl = this.uploaderOrNull;
    if (!ctrl) return;
    const cfg = ctrl.config.values as { smartButtonViewMode?: SmartButtonMode };
    const mode = cfg.smartButtonViewMode ?? 'auto';
    const sources = ctrl.sources.list;
    // Stable key per (length, mode, source ids) — detects shape change
    // without storing the array itself as state.
    const splitKey = `${mode}|${sources.map((s) => s.id).join(',')}`;
    if (splitKey !== this._splitKey) {
      this._mode = mode;
      this._splitKey = splitKey;
      this._split = splitSources([...sources], mode);
    }
  }

  private get _sources(): readonly SourceButtonConfig[] {
    return this.uploaderOrNull?.sources.list ?? [];
  }

  // ─── Predicates (pure functions of mode + sources + collection) ──────

  private _isCompactMode(): boolean {
    return this._mode === 'compact';
  }

  private _shouldShowPrimary(status: OutputCollectionStatus, hasEntries: boolean): boolean {
    return !this._isCompactMode() || status !== 'idle' || hasEntries;
  }

  private _shouldShowInline(status: OutputCollectionStatus, hasEntries: boolean): boolean {
    return (
      status === 'idle' &&
      !hasEntries &&
      this._sources.length > 1 &&
      (this._mode === 'toolbar' || (this._mode === 'auto' && this._sources.length <= AUTO_MODE_INLINE_THRESHOLD))
    );
  }

  private _shouldShowDropdown(status: OutputCollectionStatus, hasEntries: boolean): boolean {
    return (
      status === 'idle' &&
      !this._shouldShowInline(status, hasEntries) &&
      !hasEntries &&
      (this._sources.length > 1 || this._isCompactMode())
    );
  }

  private _shouldShowAbort(status: OutputCollectionStatus, hasEntries: boolean): boolean {
    return status !== 'idle' && hasEntries;
  }

  // ─── Actions ──────────────────────────────────────────────────────────

  private _handleRemove = (): void => {
    // Re-derive status at click-time — the locally-rendered value may
    // be stale by the time the event fires.
    const ctrl = this.uploaderOrNull;
    if (!ctrl) return;
    const state = buildOutputCollectionState(ctrl);
    switch (state.status) {
      case 'failed':
        for (const entry of state.failedEntries) {
          ctrl.collection.remove(entry.internalId);
        }
        break;
      case 'uploading':
        ctrl.upload.abortAll();
        break;
      default:
        ctrl.collection.clearAll();
    }
  };

  // ─── Renderers ────────────────────────────────────────────────────────

  private _renderInline() {
    return html`
      <uc-no-wrap-mode-smart-btn>
        ${this._split.remain.map(
          (source) => html`
            <uc-source-btn
              .iconOnly=${true}
              role="menuitem"
              .source=${source}
            ></uc-source-btn>
          `,
        )}
      </uc-no-wrap-mode-smart-btn>
    `;
  }

  private _renderDropdown() {
    const icon = iconsBasedOnMode[this._mode as Exclude<SmartButtonMode, 'toolbar'>] ?? 'arrow-dropdown';
    return html`
      <uc-drop-down>
        <uc-icon content-for="dd-header-button" name=${icon}></uc-icon>
        <div content-for="dd-content" role="menu" class="uc-dropdown-menu">
          ${this._split.remain.map(
            (source) => html`
              <uc-source-btn role="menuitem" .source=${source}></uc-source-btn>
            `,
          )}
        </div>
      </uc-drop-down>
    `;
  }

  private _renderPrimary(collection: OutputCollectionState<OutputCollectionStatus, 'maybe-has-group'>) {
    return html`
      <uc-primary-action
        .entries=${collection}
        .source=${this._split.main}
      ></uc-primary-action>
    `;
  }

  private _renderAbort(status: OutputCollectionStatus) {
    return html`
      <uc-file-action-button
        @uc:remove=${this._handleRemove}
        .uploading=${status === 'uploading'}
        .failed=${status === 'failed'}
        .success=${status === 'success'}
        .idle=${status === 'idle'}
      ></uc-file-action-button>
    `;
  }

  private _renderVisualDropArea() {
    return html`
      <div class="uc-visual-drop-area">
        <uc-icon name="arrow-down"></uc-icon>
      </div>
    `;
  }

  private _innerClasses(status: OutputCollectionStatus) {
    return classMap({
      'uc-smart-btn-inner': true,
      'uc-failed': status === 'failed',
      'uc-uploading': status === 'uploading',
      'uc-success': status === 'success',
    });
  }

  public override render() {
    const ctrl = this.uploaderOrNull;
    // Build the v1-compatible OutputCollectionState here (each render).
    // Storing it on the instance as `@state` would loop: the wrapper
    // object identity changes every call.
    const collection = ctrl ? buildOutputCollectionState(ctrl) : null;
    const status: OutputCollectionStatus = collection?.status ?? 'idle';
    const hasEntries = (collection?.allEntries?.length ?? 0) > 0;

    return html`
      <uc-drop-area .disabled=${!this.dropzone}>
        <div class=${this._innerClasses(status)}>
          ${cache(collection && this._shouldShowPrimary(status, hasEntries) ? this._renderPrimary(collection) : null)}
          ${cache(this._shouldShowInline(status, hasEntries) ? this._renderInline() : null)}
          ${cache(this._shouldShowDropdown(status, hasEntries) ? this._renderDropdown() : null)}
          ${cache(this._shouldShowAbort(status, hasEntries) || hasEntries ? this._renderAbort(status) : null)}
          ${cache(this._renderVisualDropArea())}
        </div>
      </uc-drop-area>
    `;
  }
}

if (!customElements.get('uc-smart-btn')) customElements.define('uc-smart-btn', SmartBtn);

// Tag is globally declared by v1's `src/blocks/SmartBtn/SmartBtn.ts`.
