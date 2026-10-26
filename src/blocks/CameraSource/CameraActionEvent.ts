import type { CameraMode } from '../../abstract/cameraModes';

/** What the user did in one of the camera's parts; the container decides what it means. */
export type CameraAction =
  | { type: 'back' }
  | { type: 'close' }
  | { type: 'select-camera'; deviceId: string }
  | { type: 'select-microphone'; deviceId: string }
  | { type: 'request-access' }
  | { type: 'video-frame'; ready: boolean }
  | { type: 'select-tab'; tab: CameraMode }
  | { type: 'shutter' }
  | { type: 'retake' }
  | { type: 'accept' }
  | { type: 'toggle-microphone' }
  | { type: 'toggle-playback' };

/** Bubbles from `<uc-camera-header>`, `<uc-camera-preview>` and `<uc-camera-controls>` to `<uc-camera-source>`. */
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
