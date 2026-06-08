import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import { addDropzone, DropzoneState, type DropzoneStateValue } from '../../blocks/DropArea/addDropzone';
import '../../blocks/DropArea/drop-area.css';
import type { DropItem } from '../../blocks/DropArea/getDropItems';
import '../Icon/Icon';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';

const DROPZONE_NAMES: Record<DropzoneStateValue, string> = {
  [DropzoneState.ACTIVE]: 'active',
  [DropzoneState.INACTIVE]: 'inactive',
  [DropzoneState.NEAR]: 'near',
  [DropzoneState.OVER]: 'over',
};

/**
 * v2 `<uc-drop-area>`. Drag-and-drop target backed by `addDropzone` (the
 * same pure utility v1 used). Drops route into
 * `controller.collection.addFile(...)` /
 * `controller.collection.addFileFromUrl(...)`. With `clickable`, a click
 * opens the system file picker via `api.openSystemDialog()`.
 *
 * Same `[uc-drop-area]` style attribute and same DOM layout as v1 so
 * `drop-area.css` applies unchanged.
 */
export class DropArea extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-drop-area'];

  @property({ type: Boolean, reflect: true })
  public disabled = false;

  @property({ type: Boolean, reflect: true })
  public clickable = false;

  @property({ type: Boolean, attribute: 'with-icon', reflect: true })
  public withIcon = false;

  @property({ type: Boolean, noAccessor: true })
  public ghost = false;

  @property({ type: Boolean, noAccessor: true })
  public single = false;

  @property({ type: Boolean, reflect: true })
  public initflow = false;

  @property({ type: String })
  public text?: string;

  @state()
  private _dropTextKey = 'drop-files-here';

  private _contentWrapperRef: Ref<HTMLDivElement> = createRef();
  private _destroyDropzone?: () => void;
  private _destroyContentWrapperDropzone?: () => void;
  private _clickListenerAttached = false;

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.config.subscribe.bind(ctrl.config), ctrl.locale.subscribe.bind(ctrl.locale)];
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    this._updateDragState(DropzoneState.INACTIVE);

    this._destroyDropzone = addDropzone({
      element: this,
      shouldIgnore: () => this._shouldIgnore(),
      onChange: (state) => this._updateDragState(state),
      onItems: (items) => this._handleItems(items),
    });
  }

  public override disconnectedCallback(): void {
    this._destroyDropzone?.();
    this._destroyContentWrapperDropzone?.();
    this._destroyDropzone = undefined;
    this._destroyContentWrapperDropzone = undefined;
    this._detachClickListener();
    super.disconnectedCallback();
  }

  // `_updateDropText` writes to `@state() _dropTextKey`; doing that in
  // `updated()` triggers another update cycle and Lit's
  // "change-in-update" dev warning. Compute it in `willUpdate()` instead
  // so the new value lands inside the current render. The other side-
  // effects (DOM listeners, dropzone wiring) only read attributes/refs
  // populated by the render, so they still belong in `updated()`.
  public override willUpdate(): void {
    this._updateDropText();
  }

  public override updated(): void {
    this._updateClickListener();
    this._wireContentWrapperDropzone();
  }

  // ─── Behaviour ────────────────────────────────────────────────────────

  private _shouldIgnore(): boolean {
    if (this.disabled) return true;
    const cfg = this.uploaderOrNull?.config.values as
      | {
          multiple?: boolean;
          multipleMax?: number;
        }
      | undefined;
    const total = this.uploaderOrNull?.collection.size ?? 0;
    if (cfg?.multiple && cfg.multipleMax && total >= cfg.multipleMax) return true;
    if (cfg && !cfg.multiple && total > 0) return true;
    return false;
  }

  private _updateDragState(state: DropzoneStateValue): void {
    this.setAttribute('drag-state', DROPZONE_NAMES[state]);
  }

  private _handleItems(items: DropItem[]): void {
    if (!items.length) return;
    const ctrl = this.uploaderOrNull;
    if (!ctrl) return;
    for (const item of items) {
      if (item.type === 'url') {
        ctrl.collection.addFileFromUrl(item.url, { source: 'drop-area' });
      } else {
        ctrl.collection.addFile(item.file, { source: 'drop-area' });
      }
    }
    if (ctrl.collection.size > 0) {
      // Goes through the hook chain — DynamicBtn can suppress the
      // upload-list modal when there's no history (drop landed on the
      // dynamic button itself).
      ctrl.router.afterFileAdd();
    }
  }

  private _updateDropText(): void {
    const ctrl = this.uploaderOrNull;
    if (!ctrl) return;
    const multiple = (ctrl.config.values as { multiple?: boolean }).multiple ?? true;
    if (this.text) {
      this._dropTextKey = ctrl.locale.t(this.text) || this.text;
    } else {
      this._dropTextKey = ctrl.locale.t(multiple ? 'drop-files-here' : 'drop-file-here');
    }
  }

  // Click handling — opens the system dialog (or initFlow for the
  // minimal preset's auto-launch behaviour).

  private _handleClick = (event: Event): void => {
    if (event instanceof KeyboardEvent) {
      if (event.code !== 'Space' && event.code !== 'Enter') return;
    } else if (!(event instanceof MouseEvent)) {
      return;
    }
    if (this.initflow) {
      this.uploader.api.open();
      return;
    }
    this.uploader.api.openSystemDialog();
  };

  private _updateClickListener(): void {
    if (this.clickable && !this._clickListenerAttached) {
      this.addEventListener('click', this._handleClick);
      this.addEventListener('keydown', this._handleClick);
      this._clickListenerAttached = true;
    } else if (!this.clickable && this._clickListenerAttached) {
      this._detachClickListener();
    }
  }

  private _detachClickListener(): void {
    this.removeEventListener('click', this._handleClick);
    this.removeEventListener('keydown', this._handleClick);
    this._clickListenerAttached = false;
  }

  // The content wrapper acts as a nested dropzone so styling can target
  // the OVER state on the inner element specifically.
  private _wireContentWrapperDropzone(): void {
    if (this._destroyContentWrapperDropzone) return;
    const wrapper = this._contentWrapperRef.value;
    if (!wrapper) return;
    this._destroyContentWrapperDropzone = addDropzone({
      element: wrapper,
      shouldIgnore: () => this._shouldIgnore(),
      onChange: (state) => {
        wrapper.setAttribute('drag-state', DROPZONE_NAMES[state]);
      },
      onItems: () => {
        /* outer dropzone handles items */
      },
    });
  }

  public override render() {
    // Content-wrapper is the default — it only renders when the
    // drop-area has no light-DOM children. When wrapping other content
    // (e.g. SimpleBtn's button) the children replace this default.
    return html`${this.yield(
      '',
      html`
        <div ${ref(this._contentWrapperRef)} class="uc-content-wrapper">
          <div class="uc-icon-container" ?hidden=${!this.withIcon}>
            <uc-icon name="default"></uc-icon>
            <uc-icon name="arrow-down"></uc-icon>
          </div>
          <span class="uc-text">${this._dropTextKey}</span>
        </div>
      `,
    )}`;
  }
}

if (!customElements.get('uc-drop-area')) customElements.define('uc-drop-area', DropArea);
