import { isAbortError } from '../../abstract/di/Lifetime';
import { stopTracks } from './CameraStream';

export type DeviceOption = { text: string; value: string };

const WATCHED_PERMISSIONS = ['camera', 'microphone'] as const;

/** What the camera block lends: its adoption-bound async helpers, config reads and its reaction to changes. */
export type CameraDevicesHost = {
  whileAdopted: <T>(work: PromiseLike<T>, dispose?: (value: T) => void) => Promise<T>;
  runTask: (task: () => unknown) => void;
  adoptionSignal: () => AbortSignal;
  audioEnabled: () => boolean;
  /** The label for an unnamed camera, by its position in the list. */
  cameraLabel: (index: number) => string;
  onPermissionChange: () => void;
  onDevicesChange: (devices: { cameras: DeviceOption[]; microphones: DeviceOption[] }) => void;
  /** Reports a failure that the block recovers from: to the log with `message`, to telemetry with `context`. */
  onError: (error: unknown, context: string, message: string) => void;
};

/** The camera's permissions and devices: watches the permission state and lists the cameras and microphones. */
export class CameraDevices {
  private _permissionCleanups: Array<() => void> = [];

  public constructor(private readonly _host: CameraDevicesHost) {}

  /**
   * Calls `onPermissionChange` whenever the camera or microphone permission changes. Returns false when the
   * Permissions API can't be used, in which case the block asks for access directly.
   */
  public async watchPermissions(): Promise<boolean> {
    try {
      this.stopWatchingPermissions();
      for (const name of WATCHED_PERMISSIONS) {
        const status = await this._host.whileAdopted(navigator.permissions.query({ name: name as PermissionName }));
        const onChange = () => this._host.onPermissionChange();
        status.addEventListener('change', onChange);
        this._permissionCleanups.push(() => status.removeEventListener('change', onChange));
      }
      return true;
    } catch (error) {
      this.stopWatchingPermissions();
      if (isAbortError(error)) throw error;
      this._host.onError(
        error,
        'camera permissions. Failed to use permissions API',
        'Failed to use permissions API. Fallback to manual request mode.',
      );
      return false;
    }
  }

  public stopWatchingPermissions(): void {
    for (const cleanup of this._permissionCleanups) cleanup();
    this._permissionCleanups = [];
  }

  /**
   * Follows changes to the devices, then asks for access once, so the device labels are readable, and lists them.
   * When that check fails, the session lists them after its first successful capture.
   */
  public async requestAccess(): Promise<void> {
    navigator.mediaDevices.addEventListener('devicechange', () => this._host.runTask(() => this.list()), {
      signal: this._host.adoptionSignal(),
    });
    try {
      // Only probes for permission; the block opens the real stream.
      const probe = await this._host.whileAdopted(
        navigator.mediaDevices.getUserMedia({ video: true, audio: this._host.audioEnabled() }),
        stopTracks,
      );
      stopTracks(probe);
      await this.list();
    } catch (error) {
      // Asks the lifetime, not the error: `getUserMedia` names a camera that fails to start `AbortError` too.
      if (this._host.adoptionSignal().aborted) throw error;
      this._host.onError(error, 'camera devices. Failed to get user media', 'Failed to get user media');
    }
  }

  /** Lists the cameras, and the microphones when audio recording is on, and hands them to `onDevicesChange`. */
  public async list(): Promise<void> {
    try {
      const devices = await this._host.whileAdopted(navigator.mediaDevices.enumerateDevices());
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
      this._host.onError(error, 'camera devices. Failed to get devices', 'Failed to get devices');
    }
  }
}
