import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { UploaderController } from './UploaderController';

export type TrayPhase = 'hidden' | 'visible';

/**
 * Drives the tray's visibility from upload-collection size. Two phases —
 * `hidden` when the collection is empty, `visible` when it isn't. The host
 * re-renders when `phase` flips via `host.requestUpdate()`.
 *
 * No auto-hide timer, no fade phase: the tray stays visible as long as the
 * uploader has files. Manual collapse is a separate concern owned by the
 * host (it's a UI state, not a phase).
 */
export class TrayLifecycleController implements ReactiveController {
  private _host: ReactiveControllerHost;
  private _phase: TrayPhase = 'hidden';
  private _ctrl: UploaderController | null = null;
  private _unsubCollection?: () => void;

  public constructor(host: ReactiveControllerHost) {
    this._host = host;
    host.addController(this);
  }

  public get phase(): TrayPhase {
    return this._phase;
  }

  public attach(ctrl: UploaderController): void {
    if (this._ctrl === ctrl) return;
    this._detachSubscriptions();
    this._ctrl = ctrl;
    this._unsubCollection = ctrl.collection.subscribe(() => this._recompute());
    this._recompute();
  }

  public detach(): void {
    this._detachSubscriptions();
    this._ctrl = null;
  }

  public hostDisconnected(): void {
    this.detach();
  }

  private _detachSubscriptions(): void {
    this._unsubCollection?.();
    this._unsubCollection = undefined;
  }

  private _recompute(): void {
    const ctrl = this._ctrl;
    if (!ctrl) return;
    this._setPhase(ctrl.collection.entries.length > 0 ? 'visible' : 'hidden');
  }

  private _setPhase(next: TrayPhase): void {
    if (this._phase === next) return;
    this._phase = next;
    this._host.requestUpdate();
  }
}
