import { html, type PropertyValues } from 'lit';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { inject, injectOrNull } from '../../abstract/di/inject';
import { ChildBlock } from '../../lit/ChildBlock';
import { blocksRendered, firstFocusable } from '../../lit/focus';
import { delay } from '../../utils/delay';
import './modal.css';
import { property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type { RegisteredActivityType } from '../../abstract/activity-constants';
import type { ControllerContainer } from '../../abstract/di/ControllerContainer';
import type { PluginLabel } from '../../abstract/managers/plugin/PluginTypes';
import { acquireScrollLock } from '../../utils/scroll-lock';

export class Modal extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-modal'];

  @inject(ConfigController) private readonly _config!: ConfigController;
  @injectOrNull(RouterController) private readonly _router!: RouterController | null;

  private _mouseDownTarget: EventTarget | null | undefined;

  /** When the inline dialog last opened: the click that opened it is still bubbling and must not close it. */
  private _inlineOpenedAt = 0;
  // What had focus when an inline dialog opened. The browser returns focus only while it is still inside the dialog,
  // and a screen change inside it can drop focus to the body first.
  private _inlineOpener: HTMLElement | null = null;

  /**
   * `close` events still queued from our own `hide()`. `dialog.close()` dispatches its `close` from a task, so a modal
   * reopened before then would see that stale event; the router already knows about a close we made, so we skip it.
   */
  private _ownClosesPending = 0;

  /** Idempotent release for our acquisition of the shared body scroll lock. */
  private _releaseScrollLock: (() => void) | null = null;

  /** WARNING: Do not rename/change this, it's used in dashboard */
  protected dialogEl = createRef<HTMLDialogElement>();

  /** Names the `<dialog>`: plain text or an l10n key. Whoever renders the modal knows what it holds. */
  @property({ attribute: 'dialog-label' })
  public dialogLabel: PluginLabel | null = null;

  /**
   * CSS-only attribute
   */
  @property({ type: Boolean, reflect: true })
  public strokes = false;

  /** WARNING: Do not rename/change this, it's used in dashboard */
  protected closeDialog = (): void => {
    // The native <dialog> "close" event is dispatched from a queued task and
    // can land after this block's ctx was torn down (deferred destroyCtx once
    // the last block disconnects) — there is no router to notify then, and
    // nothing left to close. `_router` is `@injectOrNull` (not `@inject`): it
    // reads `null` once the container is released, exactly the post-teardown
    // race this guard exists to absorb, rather than throwing.
    const router = this._router;
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
    // (and the `modal-close` event). The deprecated `setCurrentActivity()` + `setModalState(true)` leave the activity
    // staged in the background too; closing it there as well reports `activity-change(null)`, as v1 did.
    if (router.activity === router.modal) {
      router.close();
    } else {
      router.closeModal();
    }
  };

  private _handleDialogClose = (): void => {
    if (this._ownClosesPending > 0) {
      this._ownClosesPending--;
      return;
    }
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

  private _isInlineOpen(): boolean {
    return this._config.get('modalPresentation') === 'inline' && !!this.dialogEl.value?.open;
  }

  // `modalPresentation: 'inline'` leaves the page interactive, so nothing native closes the dialog: an outside click
  // or Escape anywhere on the page goes through `closeDialog`, as the backdrop click and native Escape do for 'modal'.
  private _handleDocumentClick = (e: MouseEvent): void => {
    if (
      this._isInlineOpen() &&
      e.timeStamp >= this._inlineOpenedAt &&
      !e.composedPath().includes(this.dialogEl.value as HTMLDialogElement)
    ) {
      this.closeDialog();
    }
  };

  private _handleDocumentKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this._isInlineOpen()) {
      this.closeDialog();
    }
  };

  protected override controllerReady(container: ControllerContainer): void {
    super.controllerReady(container);
    const signal = this.adoptionSignal;
    document.addEventListener('click', this._handleDocumentClick, { signal });
    document.addEventListener('keydown', this._handleDocumentKeyDown, { signal });
  }

  protected async show(): Promise<void> {
    await this.whileAdopted(this.updateComplete);
    // Rendered by now: the ref is cleared only on disconnect, which ends the adoption the await above is bound to.
    const dialog = this.dialogEl.value as HTMLDialogElement;
    // Idempotent: `willUpdate` calls this on every update while the modal is in the foreground, but `showModal()`
    // throws on an already-open dialog.
    if (this._config.get('modalPresentation') === 'inline') {
      // In the page, not the top layer: no backdrop, nothing made inert. `show()` moves focus in, as `showModal()`
      // does, and `hide()` returns it to the opener.
      if (dialog.open && !dialog.matches(':modal')) return;
      if (dialog.open) {
        // The option changed while the modal dialog was open: only `close()` takes it out of the top layer.
        this._ownClosesPending++;
        dialog.close();
      } else {
        const active = document.activeElement;
        this._inlineOpener = active instanceof HTMLElement && !dialog.contains(active) ? active : null;
      }
      dialog.show();
      this._inlineOpenedAt = performance.now();
      await this._settleInitialFocus(dialog);
      return;
    }
    if (dialog.open) {
      // Moving an open dialog in the DOM takes it out of the top layer but keeps `open`, leaving it in-flow with no
      // backdrop or Escape. Re-enter the top layer; dropping the attribute (unlike `close()`) fires no `close`.
      if (dialog.matches(':modal')) return;
      dialog.removeAttribute('open');
    }
    dialog.showModal();
    await this._settleInitialFocus(dialog);
  }

  /**
   * v1's first focus stop: the first control once the activity has rendered. Opening focuses what is there at that
   * moment, which can be the dialog itself (the camera renders its controls later) or the drop area, a focus stop v1
   * did not have.
   */
  // NEXT-MAJOR(a11y): let the dialog's own focusing steps pick the first stop, the drop area included. Kept for 1.x
  // compat.
  private async _settleInitialFocus(dialog: HTMLDialogElement): Promise<void> {
    const initial = document.activeElement;
    const isDropArea = initial instanceof HTMLElement && initial.localName === 'uc-drop-area';
    if (initial !== dialog && !(isDropArea && dialog.contains(initial))) return;
    await blocksRendered(dialog, (work) => this.whileAdopted(work));
    // The user, or the activity itself, moved focus meanwhile.
    if (document.activeElement !== initial) return;
    firstFocusable(dialog, (el) => el.localName === 'uc-drop-area')?.focus();
  }

  protected hide(): void {
    // No ref before the first render: the first `willUpdate` runs ahead of it.
    const dialog = this.dialogEl.value;
    if (!dialog || !dialog.open) return;
    const wasInline = !dialog.matches(':modal');
    this._ownClosesPending++;
    dialog.close();
    const opener = this._inlineOpener;
    this._inlineOpener = null;
    if (wasInline && opener) {
      // A task later: the Escape that closed an inline dialog still reaches keyux's window listener, which blurs.
      this.runTask(async () => {
        await this.whileAdopted(delay(0));
        const active = document.activeElement;
        if (opener.isConnected && (active === document.body || dialog.contains(active))) opener.focus();
      });
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);

    // Host CSS attribute: `:where([uc-modal])[strokes] > dialog::backdrop` keys
    // off `strokes` ON THE HOST, so drive it there from the tracked config
    // signal (the Copyright `willUpdate` + `getTracked` recipe). Reading
    // `modalBackdropStrokes` via `getTracked` auto-tracks under `SignalWatcher`,
    // so a config change re-runs this update and re-toggles the attribute.
    // `strokes` is not a signal, so toggling it schedules no further update.
    this.toggleAttribute('strokes', !!this._config.getTracked('modalBackdropStrokes'));

    // Show when the router's foreground modal slot is this modal's id; hide
    // otherwise. `router.modal` is a tracked signal, so a modal-open/close
    // transition re-runs this update and drives the imperative `<dialog>`
    // side-effects below, with no effective-activity dedup (a modal opening on
    // the id that's already the background activity still transitions the modal
    // slot, so it still shows).
    //
    // The scroll lock follows *router* state, not dialog state — a native
    // Esc-close reaches here with the <dialog> already closed (so `hide()`
    // early-returns), and the lock must release regardless. The shared
    // refcount keeps the body locked across modal-to-modal swaps and across
    // other uploader instances on the same page. `modalScrollLock` is read
    // untracked: the router-slot signal is what re-runs this.
    const isForeground = this._router?.modal === (this.id as RegisteredActivityType);
    // Tracked so a runtime change re-runs this and reaches the next `show()`; an inline dialog takes no scroll lock.
    const isInline = this._config.getTracked('modalPresentation') === 'inline';
    if (isForeground && !isInline && this._config.get('modalScrollLock')) {
      this._releaseScrollLock ??= acquireScrollLock();
    } else {
      this._releaseScrollLock?.();
      this._releaseScrollLock = null;
    }
    if (isForeground) {
      this.runTask(() => this.show());
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

  public override render() {
    return html`
  <dialog data-testid="dialog" aria-label=${ifDefined(this.pluginLabel(this.dialogLabel) || undefined)} ${ref(this.dialogEl)} @close=${this._handleDialogClose} @mousedown=${this._handleDialogMouseDown} @mouseup=${this._handleDialogMouseUp}>
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
