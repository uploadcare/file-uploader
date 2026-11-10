import { isAbortError } from '../../abstract/di/Lifetime';

export type DeviceOption = { text: string; value: string };

const WATCHED_PERMISSIONS = ['camera', 'microphone'] as const;

/** The camera block's adoption-bound async helpers (see `ChildBlock`), lent to the parts that do its async work. */
export type CameraLifetime = {
  whileAdopted: <T>(work: PromiseLike<T>, dispose?: (value: T) => void) => Promise<T>;
  runTask: (task: () => unknown) => void;
  adoptionSignal: () => AbortSignal;
};

/** What the camera block lends: its lifetime, config reads and its reaction to changes. */
export type CameraDevicesHost = {
  lifetime: CameraLifetime;
  audioEnabled: () => boolean;
  /** The label for an unnamed camera, by its position in the list. */
  cameraLabel: (index: number) => string;
  onPermissionChange: () => void;
  onDevicesChange: (devices: { cameras: DeviceOption[]; microphones: DeviceOption[] }) => void;
  /** Reports a failure that the block recovers from: to the log with `message`, to telemetry with `context`. */
  report: (message: string, error: unknown, context: string) => void;
};

/** The camera's permissions and devices: watches the permission state and lists the cameras and microphones. */
export class CameraDevices {
  /** Aborted to remove the permission listeners: when watching stops, and when it starts over. */
  private _permissionWatch: AbortController | null = null;

  public constructor(private readonly _host: CameraDevicesHost) {}

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
        status.addEventListener('change', () => this._host.onPermissionChange(), { signal: watch.signal });
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

  /** Lists the devices again whenever they change, until `adoption` ends. */
  public watchDeviceChanges(adoption = this._host.lifetime.adoptionSignal()): void {
    navigator.mediaDevices?.addEventListener('devicechange', () => this._host.lifetime.runTask(() => this.list()), {
      signal: adoption,
    });
  }

  /** Lists the cameras, and the microphones when audio recording is on, and hands them to `onDevicesChange`. */
  public async list(): Promise<void> {
    try {
      const devices = await this._host.lifetime.whileAdopted(navigator.mediaDevices.enumerateDevices());
      const cameras = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          text: device.label.trim() || this._host.cameraLabel(index),
          value: device.deviceId,
        }));
      const microphones = this._host.audioEnabled()
        ? devices
            .filter((device) => device.kind === 'audioinput')
            .map((device) => ({ text: device.label.trim(), value: device.deviceId }))
        : [];
      this._host.onDevicesChange({ cameras, microphones });
    } catch (error) {
      if (isAbortError(error)) throw error;
      this._host.report('Failed to get devices', error, 'camera devices. Failed to get devices');
    }
  }
}
