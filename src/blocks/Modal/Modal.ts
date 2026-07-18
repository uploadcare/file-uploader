import { html, type PropertyValues } from 'lit';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { inject } from '../../abstract/di/inject';
import { ChildBlock } from '../../lit/ChildBlock';
import './modal.css';
import { property } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type { RegisteredActivityType } from '../../lit/activity-constants';
import { getScrollLock } from '../../utils/scroll-lock';

export class Modal extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-modal'];

  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(RouterController) private readonly _router!: RouterController;

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
    // nothing left to close. Deliberately kept on the null-safe
    // `useOrNull(RouterController)` rather than `use(RouterController)`: the
    // latter throws once the container is released, exactly the post-teardown
    // race this guard exists to absorb.
    const router = this.useOrNull(RouterController);
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

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);

    // Host CSS attribute: `:where([uc-modal])[strokes] > dialog::backdrop` keys
    // off `strokes` ON THE HOST, so drive it there from the tracked config
    // signal (the Copyright `willUpdate` + `getTracked` recipe). Reading
    // `modalBackdropStrokes` via `getTracked` auto-tracks under `SignalWatcher`,
    // so a config change re-runs this update and re-toggles the attribute —
    // matching the reactivity of the v1 `subConfigValue('modalBackdropStrokes')`
    // it replaces. `strokes` is not a signal, so toggling it schedules no
    // further update.
    this.toggleAttribute('strokes', !!this._config.getTracked('modalBackdropStrokes'));

    // Show when the router's foreground modal slot is this modal's id; hide
    // otherwise. `router.modal` is a tracked signal (M-god step 6b-3), so a
    // modal-open/close transition re-runs this update and drives the imperative
    // `<dialog>` side-effects below — replacing the v1 `subRouter` subscription
    // with no effective-activity dedup (a modal opening on the id that's already
    // the background activity still transitions the modal slot, so it still shows).
    //
    // The scroll lock follows *router* state, not dialog state — a native
    // Esc-close reaches here with the <dialog> already closed (so `hide()`
    // early-returns), and the lock must release regardless. The shared
    // refcount keeps the body locked across modal-to-modal swaps and across
    // other uploader instances on the same page. `modalScrollLock` is read
    // untracked (v1 read it fresh inside the router callback, not as its own
    // reactive trigger) — the router-slot signal is what re-runs this.
    const isForeground = this._router.modal === (this.id as RegisteredActivityType);
    if (isForeground && this._config.get('modalScrollLock')) {
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
