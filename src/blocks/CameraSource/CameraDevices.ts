import { isAbortError } from '../../abstract/di/Lifetime';
import { signalState } from '../../abstract/di/signalState';
import type { CameraReport, CameraTasks } from './cameraHost';

export type DeviceOption = { text: string; value: string };

/** What the session lends: its lifetime, config reads and its reaction to changes. */
export type CameraDevicesHost = CameraTasks & {
  audioEnabled: () => boolean;
  /** The label for an unnamed camera, by its position in the list. */
  cameraLabel: (index: number) => string;
  /** The same for an unnamed microphone. */
  microphoneLabel: (index: number) => string;
  onDevicesChange: (devices: { cameras: DeviceOption[]; microphones: DeviceOption[] }) => void;
  report: CameraReport;
};

/**
 * The device to show as selected: the current choice while it is still listed, otherwise the one the open stream
 * actually uses, otherwise the first.
 */
const resolveSelectedId = (
  devices: DeviceOption[],
  currentId: string | null,
  track: MediaStreamTrack | undefined,
): string | null => {
  const listed = (id: string | null | undefined) => !!id && devices.some((device) => device.value === id);
  if (listed(currentId)) return currentId;
  const activeId = track?.getSettings().deviceId;
  if (listed(activeId)) return activeId ?? null;
  return devices[0]?.value ?? null;
};

/**
 * The camera's devices: lists the cameras and microphones, and again whenever they change, and holds the ones picked.
 */
export class CameraDevices {
  @signalState() public cameras: DeviceOption[] = [];
  @signalState() public microphones: DeviceOption[] = [];
  @signalState() public selectedCameraId: string | null = null;
  @signalState() public selectedMicrophoneId: string | null = null;

  public constructor(private readonly _host: CameraDevicesHost) {}

  /** Starts from the lists and the picks of the session before, which a DOM move must not lose. */
  public keep(previous: CameraDevices): void {
    this.cameras = previous.cameras;
    this.microphones = previous.microphones;
    this.selectedCameraId = previous.selectedCameraId;
    this.selectedMicrophoneId = previous.selectedMicrophoneId;
  }

  public pickCamera(id: string): void {
    this.selectedCameraId = id;
  }

  public pickMicrophone(id: string): void {
    this.selectedMicrophoneId = id;
  }

  /** Stores the lists and resolves the selection against the open stream's tracks. */
  public adopt(lists: { cameras: DeviceOption[]; microphones: DeviceOption[] }, stream: MediaStream | null): void {
    this.cameras = lists.cameras;
    this.selectedCameraId = resolveSelectedId(lists.cameras, this.selectedCameraId, stream?.getVideoTracks()[0]);
    this.microphones = lists.microphones;
    this.selectedMicrophoneId = resolveSelectedId(
      lists.microphones,
      this.selectedMicrophoneId,
      stream?.getAudioTracks()[0],
    );
  }

  /** Lists the devices again whenever they change, until the lifetime ends. */
  public watchDeviceChanges(): void {
    navigator.mediaDevices?.addEventListener('devicechange', () => this._host.runTask(() => this.list()), {
      signal: this._host.lifetime.signal,
    });
  }

  /** Lists the cameras, and the microphones when audio recording is on, and hands them to `onDevicesChange`. */
  public async list(): Promise<void> {
    try {
      const devices = await this._host.lifetime.guard(navigator.mediaDevices.enumerateDevices());
      const cameras = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          text: device.label.trim() || this._host.cameraLabel(index),
          value: device.deviceId,
        }));
      const microphones = this._host.audioEnabled()
        ? devices
            .filter((device) => device.kind === 'audioinput')
            .map((device, index) => ({
              text: device.label.trim() || this._host.microphoneLabel(index),
              value: device.deviceId,
            }))
        : [];
      this._host.onDevicesChange({ cameras, microphones });
    } catch (error) {
      if (isAbortError(error)) throw error;
      this._host.report('warn', 'Failed to get devices', error, 'camera devices. Failed to get devices');
    }
  }
}
