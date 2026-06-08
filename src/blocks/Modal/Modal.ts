import { html } from 'lit';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import '../../blocks/Modal/modal.css';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';

/**
 * v2 `<uc-modal>`. Wraps a `<dialog>` and toggles it open/closed based
 * on whether the router's current activity matches the modal's `id`.
 *
 * Same DOM + style attribute (`uc-modal`) as v1 so `modal.css` applies
 * unchanged. Click-on-backdrop and `<dialog>`'s built-in escape-close
 * route back through the router so events are emitted consistently.
 */
export class Modal extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-modal'];

  private _dialogRef: Ref<HTMLDialogElement> = createRef();
  private _mouseDownTarget: EventTarget | null = null;
  private _closingProgrammatically = false;

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.router.subscribe.bind(ctrl.router), ctrl.config.subscribe.bind(ctrl.config)];
  }

  public override updated(): void {
    this._syncOpenState();
    const cfg = this.uploaderOrNull?.config.values as
      | { modalBackdropStrokes?: boolean; modalScrollLock?: boolean }
      | undefined;
    this.toggleAttribute('strokes', !!cfg?.modalBackdropStrokes);
    if (cfg?.modalScrollLock && this._isOpen()) {
      document.body.style.overflow = 'hidden';
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.body.style.overflow = '';
  }

  private _isOpen(): boolean {
    return this.uploaderOrNull?.router.modal === this.id;
  }

  private _syncOpenState(): void {
    const dialog = this._dialogRef.value;
    if (!dialog) return;
    const shouldOpen = this._isOpen();
    if (shouldOpen && !dialog.open) {
      this.setAttribute('aria-modal', 'true');
      dialog.showModal();
    } else if (!shouldOpen && dialog.open) {
      this.setAttribute('aria-modal', 'false');
      this._closingProgrammatically = true;
      dialog.close();
      this._closingProgrammatically = false;
      const cfg = this.uploaderOrNull?.config.values as { modalScrollLock?: boolean } | undefined;
      if (cfg?.modalScrollLock) document.body.style.overflow = '';
    }
  }

  private _handleDialogRef = (dialog: Element | undefined): void => {
    this._dialogRef = { value: dialog } as Ref<HTMLDialogElement>;
    if (!dialog) return;
    const el = dialog as HTMLDialogElement;
    el.addEventListener('close', this._handleClose);
    el.addEventListener('mousedown', this._handleMouseDown);
    el.addEventListener('mouseup', this._handleMouseUp);
  };

  private _handleClose = (): void => {
    // Skip our own programmatic close — only act on user-initiated close
    // (escape key or programmatic close from elsewhere).
    if (this._closingProgrammatically) return;
    if (this._isOpen()) this.uploader.api.close();
  };

  private _handleMouseDown = (e: MouseEvent): void => {
    this._mouseDownTarget = e.target;
  };

  private _handleMouseUp = (e: MouseEvent): void => {
    if (e.target === this._dialogRef.value && e.target === this._mouseDownTarget) {
      this.uploader.api.close();
    }
    this._mouseDownTarget = null;
  };

  public override render() {
    return html`<dialog ${ref(this._handleDialogRef)}>${this.yield('')}</dialog>`;
  }
}

if (!customElements.get('uc-modal')) customElements.define('uc-modal', Modal);
