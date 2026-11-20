import type { CameraFailure } from '../../abstract/camera/cameraFailure';
import { isAbortError, type Lifetime } from '../../abstract/di/Lifetime';
import { signalState } from '../../abstract/di/signalState';
import { debounce } from '../../utils/debounce';
import type { CameraReport } from './cameraHost';

/** Camera access: not asked yet, being asked, or the outcome. */
export type CameraPermission = 'idle' | 'prompt' | 'granted' | 'denied';

/** A permission state once asking started. */
export type SettledPermission = Exclude<CameraPermission, 'idle'>;

const WATCHED_PERMISSIONS = ['camera', 'microphone'] as const;

/** How long the permission state settles before it shows; a quick prompt→granted never flashes the prompt. */
const PERMISSION_STATE_DELAY = 300;

/** What the session lends: its lifetime and its reactions. */
export type CameraAccessHost = {
  lifetime: Lifetime;
  onPermissionChange: (name: (typeof WATCHED_PERMISSIONS)[number]) => void;
  /** Runs once a permission state settled and shows. */
  onSettled: (state: SettledPermission) => void;
  report: CameraReport;
};

/** The camera's access state: what shows for it, settled after a short delay, and the watch on its permissions. */
export class CameraAccess {
  @signalState() public permission: CameraPermission = 'idle';
  /** Why access ended `denied`, which picks the message shown. */
  @signalState() public failure: CameraFailure = 'denied';

  private readonly _settle = debounce((state: SettledPermission, failure: CameraFailure = 'denied') => {
    // A state settling after the camera was released belongs to no one.
    if (this._host.lifetime.signal.aborted) return;
    this.failure = failure;
    this.permission = state;
    this._host.onSettled(state);
  }, PERMISSION_STATE_DELAY);

  public constructor(private readonly _host: CameraAccessHost) {}

  /** Shows what the session before showed, so a DOM move does not flash the camera as not asked for yet. */
  public keep(previous: CameraAccess): void {
    this.permission = previous.permission;
    this.failure = previous.failure;
  }

  /**
   * Calls `onPermissionChange` whenever the camera or microphone permission changes, until the lifetime ends. When the
   * Permissions API can't be used it reports that and watches nothing.
   */
  public async watchPermissions(): Promise<void> {
    const { lifetime } = this._host;
    // Its own controller, so a watch that fails halfway takes its first listener off too.
    const watch = new AbortController();
    lifetime.signal.addEventListener('abort', () => watch.abort(), { once: true });
    try {
      for (const name of WATCHED_PERMISSIONS) {
        const status = await lifetime.guard(navigator.permissions.query({ name: name as PermissionName }));
        status.addEventListener('change', () => this._host.onPermissionChange(name), { signal: watch.signal });
      }
    } catch (error) {
      watch.abort();
      if (isAbortError(error)) throw error;
      this._host.report(
        'warn',
        'Failed to use permissions API. Fallback to manual request mode.',
        error,
        'camera permissions. Failed to use permissions API',
      );
    }
  }

  /**
   * Shows `state` once it held for 300 ms; a later call replaces it. Dropped when the lifetime ended by then. Sets
   * `failure` (refused access when not given), then `permission`, then calls `onSettled`.
   */
  public settleLater(state: SettledPermission, failure?: CameraFailure): void {
    this._settle(state, failure);
  }
}
