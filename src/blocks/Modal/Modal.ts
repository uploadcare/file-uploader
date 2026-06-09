import { html } from 'lit';
import { LitBlock } from '../../lit/LitBlock';
import './modal.css';
import { property } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type { RegisteredActivityType } from '../../lit/LitActivityBlock';

export class Modal extends LitBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-modal'];

  private _mouseDownTarget: EventTarget | null | undefined;

  /** WARNING: Do not rename/change this, it's used in dashboard */
  protected dialogEl = createRef<HTMLDialogElement>();

  /**
   * CSS-only attribute
   */
  @property({ type: Boolean, noAccessor: true })
  public strokes = false;

  /**
   * CSS-only attribute
   */
  @property({ type: Boolean, attribute: 'block-body-scrolling', noAccessor: true })
  public blockBodyScrolling = false;

  /** WARNING: Do not rename/change this, it's used in dashboard */
  protected closeDialog = (): void => {
    // Only close when *this* modal is the one currently in the foreground slot.
    // `hide()` fires the native `<dialog>` "close" event even when we hid this
    // modal programmatically to switch to another — without this guard that
    // stale close would tear down the modal we just navigated to.
    if (this.router.modal !== (this.id as RegisteredActivityType)) {
      return;
    }
    // Close the foreground modal slot; the router owns the close transition
    // (and the `modal-close` event).
    this.router.closeModal();
  };

  private _handleDialogClose = (): void => {
    this.closeDialog();
  };

  private _handleDialogMouseDown = (e: MouseEvent): void => {
    this._mouseDownTarget = e.target;
  };

  private _handleDialogMouseUp = (e: MouseEvent): void => {
    const target = e.target as EventTarget | null;
    if (target === this.dialogEl.value && target === this._mouseDownTarget) {
      this.closeDialog();
    }
  };

  public async show(): Promise<void> {
    await this.updateComplete;
    const dialog = this.dialogEl.value as HTMLDialogElement & {
      showModal?: () => void;
    };
    // Idempotent: `subRouter` fires on every change, but `showModal()` throws
    // on an already-open dialog.
    if (dialog?.open) return;
    if (typeof dialog.showModal === 'function') {
      this.setAttribute('aria-modal', 'true');
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    if (this.cfg.modalScrollLock) {
      document.body.style.overflow = 'hidden';
    }
  }

  public hide(): void {
    const dialog = this.dialogEl.value as HTMLDialogElement & {
      close?: () => void;
    };
    if (!dialog || !dialog.open) return;
    document.body.style.overflow = '';
    if (typeof dialog.close === 'function') {
      this.setAttribute('aria-modal', 'false');
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  public override initCallback(): void {
    super.initCallback();

    this.subConfigValue('modalBackdropStrokes', (val: boolean) => {
      if (val) {
        this.setAttribute('strokes', '');
      } else {
        this.removeAttribute('strokes');
      }
    });

    // Show when the router's foreground modal slot is this modal's id; hide
    // otherwise. The router emits `modal-open`/`modal-close` centrally. Uses
    // `subRouter` (no effective-activity dedup) so a modal opening on the id
    // that's already the background activity still shows.
    this.subRouter(() => {
      if (this.router.modal === (this.id as RegisteredActivityType)) {
        this.show();
      } else {
        this.hide();
      }
    });
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.body.style.overflow = '';
    this._mouseDownTarget = undefined;
  }

  private _handleDialogRef(dialog: Element | undefined): void {
    this.dialogEl = { value: dialog } as typeof this.dialogEl;

    this.dialogEl.value?.addEventListener('close', this._handleDialogClose);
    this.dialogEl.value?.addEventListener('mousedown', this._handleDialogMouseDown);
    this.dialogEl.value?.addEventListener('mouseup', this._handleDialogMouseUp);
  }

  public override render() {
    return html`
  <dialog ${ref(this._handleDialogRef)}>
    ${this.yield('')}
  </dialog>
`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-modal': Modal;
  }
}
