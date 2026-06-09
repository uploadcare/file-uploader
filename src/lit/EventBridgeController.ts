import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { EventBus } from '../abstract/EventBus';

type EventBridgeHost = ReactiveControllerHost & EventTarget;

/**
 * Bridges the DOM-free {@link EventBus} to documented DOM `CustomEvent`s on the
 * host element (`<uc-upload-ctx-provider>`).
 *
 * A reactive Lit controller — the UI-coupled half of the event system. The
 * DOM-free controllers emit on the per-ctx `UploaderController.events` bus; this
 * controller subscribes (`onAny`) while the host is connected and re-dispatches
 * each event as `new CustomEvent(type, { detail })`, exactly as v1's
 * `EventEmitter._dispatch` did. It subscribes immediately (so events flow
 * regardless of when it's attached relative to the connect lifecycle) and
 * re-subscribes/tears down across reconnects.
 */
export class EventBridgeController implements ReactiveController {
  private _host: EventBridgeHost;
  private _getBus: () => EventBus;
  private _unsubscribe?: () => void;

  public constructor(host: EventBridgeHost, getBus: () => EventBus) {
    this._host = host;
    this._getBus = getBus;
    host.addController(this);
    this._subscribe();
  }

  public hostConnected(): void {
    this._subscribe();
  }

  public hostDisconnected(): void {
    this._unsubscribe?.();
    this._unsubscribe = undefined;
  }

  private _subscribe(): void {
    if (this._unsubscribe) {
      return;
    }
    this._unsubscribe = this._getBus().onAny((type, payload) => {
      this._host.dispatchEvent(new CustomEvent(type, { detail: payload }));
    });
  }
}
