import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Per-host reactive controller that registers the host's DOM scope with a
 * shared, per-ctx aggregator — the `ClipboardController` (`paste`) and `A11y`
 * (`keydown`/`keyup`) window-listener owners — while the host is connected, and
 * unregisters it when the host goes away.
 *
 * The `register` thunk resolves the aggregator and registers this host's scope,
 * returning the matching unregister — so this controller stays agnostic of which
 * aggregator it drives. Because the aggregators are resolved from the ctx's DI
 * container (only available once adopted), the owning block creates this in
 * `controllerReady` and tears it down via an `addDisposer` teardown that
 * `ChildBlock` drains on release; `hostConnected` registers (fires immediately on
 * `addController` since the host is already connected by then) and
 * `hostDisconnected` unregisters (idempotent, so an explicit teardown followed by
 * Lit's own disconnect callback can't double-fire).
 */
export class HostScopeController implements ReactiveController {
  #register: () => () => void;
  #unregister: (() => void) | null = null;

  public constructor(host: ReactiveControllerHost, register: () => () => void) {
    this.#register = register;
    host.addController(this);
  }

  public hostConnected(): void {
    this.#unregister ??= this.#register();
  }

  public hostDisconnected(): void {
    this.#unregister?.();
    this.#unregister = null;
  }
}
