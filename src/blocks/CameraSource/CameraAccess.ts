import { isAbortError } from '../../abstract/di/Lifetime';
import { signalState } from '../../abstract/di/signalState';
import { debounce } from '../../utils/debounce';
import type { CameraLifetime } from './CameraSession';

/** Camera access: not asked yet, being asked, or the outcome. */
export type CameraPermission = 'idle' | 'prompt' | 'granted' | 'denied';

/** Why the camera could not start: access was refused, there is no camera, or it is busy or broken. */
export type CameraFailure = 'denied' | 'not-found' | 'unavailable';

/** A permission state once asking started. */
export type SettledPermission = Exclude<CameraPermission, 'idle'>;

/** Reads a `getUserMedia` rejection by its name; anything unknown counts as the camera being unavailable. */
export const cameraFailureOf = (error: unknown): CameraFailure => {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found';
  return 'unavailable';
};

const WATCHED_PERMISSIONS = ['camera', 'microphone'] as const;

/** How long the permission state settles before it shows; a quick prompt→granted never flashes the prompt. */
const PERMISSION_STATE_DELAY = 300;

/** What the camera block lends: its lifetime and its reactions. */
export type CameraAccessHost = {
  lifetime: CameraLifetime;
  onPermissionChange: (name: (typeof WATCHED_PERMISSIONS)[number]) => void;
  /** Reports a failure that the block recovers from: to the log with `message`, to telemetry with `context`. */
  report: (message: string, error: unknown, context: string) => void;
};

/** The camera's access state: what shows for it, settled after a short delay, and the watch on its permissions. */
export class CameraAccess {
  @signalState() public permission: CameraPermission = 'idle';
  /** Why access ended `denied`, which picks the message shown. */
  @signalState() public failure: CameraFailure = 'denied';

  /** Aborted to remove the permission listeners: when watching stops, and when it starts over. */
  private _permissionWatch: AbortController | null = null;

  private readonly _settle = debounce(
    (state: SettledPermission, failure: CameraFailure = 'denied', onSettled: (state: SettledPermission) => void) => {
      // A state settling after the camera was released belongs to no one.
      if (this._host.lifetime.adoptionSignal().aborted) return;
      this.failure = failure;
      this.permission = state;
      onSettled(state);
    },
    PERMISSION_STATE_DELAY,
  );

  public constructor(private readonly _host: CameraAccessHost) {}

  /**
   * Calls `onPermissionChange` whenever the camera or microphone permission changes. Returns false when the
   * Permissions API can't be used, in which case the block asks for access directly.
   */
  public async watchPermissions(): Promise<boolean> {
    this.stopWatchingPermissions();
    const watch = new AbortController();
    this._permissionWatch = watch;
    try {
      for (const name of WATCHED_PERMISSIONS) {
        const status = await this._host.lifetime.whileAdopted(
          navigator.permissions.query({ name: name as PermissionName }),
        );
        status.addEventListener('change', () => this._host.onPermissionChange(name), { signal: watch.signal });
      }
      return true;
    } catch (error) {
      // Only its own watch: after a move the next adoption has already started another.
      if (this._permissionWatch === watch) this.stopWatchingPermissions();
      if (isAbortError(error)) throw error;
      this._host.report(
        'Failed to use permissions API. Fallback to manual request mode.',
        error,
        'camera permissions. Failed to use permissions API',
      );
      return false;
    }
  }

  public stopWatchingPermissions(): void {
    this._permissionWatch?.abort();
    this._permissionWatch = null;
  }

  /**
   * Shows `state` once it held for 300 ms; a later call replaces it. Dropped when the adoption ended by then. Sets
   * `failure` (refused access when not given), then `permission`, then calls `onSettled`.
   */
  public settleLater(
    state: SettledPermission,
    failure: CameraFailure | undefined,
    onSettled: (state: SettledPermission) => void,
  ): void {
    this._settle(state, failure, onSettled);
  }

  /** Drops a pending state. */
  public cancel(): void {
    this._settle.cancel();
  }
}
