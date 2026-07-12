import { html } from 'lit';
import { LitBlock } from '../../lit/LitBlock';
import './modal.css';
import { property } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type { RegisteredActivityType } from '../../lit/activity-constants';
import { getScrollLock } from '../../utils/scroll-lock';

export class Modal extends LitBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-modal'];

  private _mouseDownTarget: EventTarget | null | undefined;

  /** Idempotent release for our acquisition of the shared body scroll lock. */
  private _releaseScrollLock: (() => void) | null = null;

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
    // The native <dialog> "close" event is dispatched from a queued task and
    // can land after this block's ctx was torn down (deferred destroyCtx once
    // the last block disconnects) — there is no router to notify then, and
    // nothing left to close.
    const router = this._getSharedContextInstance('*router', false);
    if (!router) {
      return;
    }
    // Only close when *this* modal is the one currently in the foreground slot.
    // `hide()` fires the native `<dialog>` "close" event even when we hid this
    // modal programmatically to switch to another — without this guard that
    // stale close would tear down the modal we just navigated to.
    if (router.modal !== (this.id as RegisteredActivityType)) {
      return;
    }
    // Close the foreground modal slot; the router owns the close transition
    // (and the `modal-close` event).
    router.closeModal();
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

  protected async show(): Promise<void> {
    await this.updateComplete;
    const dialog = this.dialogEl.value as HTMLDialogElement & {
      showModal?: () => void;
    };
    // Idempotent + null-safe (matching `hide()`): `subRouter` fires on every
    // change, but `showModal()` throws on an already-open dialog, and the ref
    // may be cleared by a teardown racing this async method.
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') {
      this.setAttribute('aria-modal', 'true');
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  protected hide(): void {
    const dialog = this.dialogEl.value as HTMLDialogElement & {
      close?: () => void;
    };
    if (!dialog || !dialog.open) return;
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
    //
    // The scroll lock follows *router* state, not dialog state — a native
    // Esc-close reaches here with the <dialog> already closed (so `hide()`
    // early-returns), and the lock must release regardless. The shared
    // refcount keeps the body locked across modal-to-modal swaps and across
    // other uploader instances on the same page.
    this.subRouter(() => {
      const isForeground = this.router.modal === (this.id as RegisteredActivityType);
      if (isForeground && this.cfg.modalScrollLock) {
        this._releaseScrollLock ??= getScrollLock(document).acquire();
      } else {
        this._releaseScrollLock?.();
        this._releaseScrollLock = null;
      }
      if (isForeground) {
        this.show();
      } else {
        this.hide();
      }
    });
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Release only our own acquisition (idempotent) — never clobber
    // `body.style.overflow` while another holder still has it locked.
    this._releaseScrollLock?.();
    this._releaseScrollLock = null;
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
