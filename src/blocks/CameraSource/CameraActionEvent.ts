import type { CameraMode } from '../../abstract/cameraModes';

/** A camera setting the user can pick in the settings popup, besides the devices. */
export type CameraSetting = 'aspectRatio' | 'resolution' | 'audioQuality' | 'audioMode';

/** What the user did in one of the camera's parts; the container decides what it means. */
export type CameraAction =
  | { type: 'back' }
  | { type: 'close' }
  | { type: 'select-camera'; deviceId: string }
  | { type: 'select-microphone'; deviceId: string }
  | { type: 'request-access' }
  | { type: 'video-frame'; ready: boolean }
  /** The preview's frame size, on its first frame and whenever the camera's shape changes, as on turning a phone. */
  | { type: 'preview-resize'; width: number; height: number }
  | { type: 'pick-setting'; setting: CameraSetting; value: string }
  /** The preview rendered its `<video>`, which the stream can now be shown in. */
  | { type: 'video-element' }
  | { type: 'select-tab'; tab: CameraMode }
  | { type: 'shutter' }
  | { type: 'retake' }
  | { type: 'accept' }
  | { type: 'toggle-microphone' }
  | { type: 'toggle-playback' };

/** Bubbles from the camera's parts to `<uc-camera-source>`. */
export class CameraActionEvent extends Event {
  public static readonly eventName = 'uc-internal:camera-action';

  public constructor(public readonly action: CameraAction) {
    super(CameraActionEvent.eventName, { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    [CameraActionEvent.eventName]: CameraActionEvent;
  }
}
