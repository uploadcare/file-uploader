import type { CameraCommand } from '../CameraSession';

/**
 * What the preview reports about its `<video>`, outside the session's commands: `<uc-camera-source>` lends the element
 * and its frames to the session, and keeps the frame size for the settings icon.
 */
export type PreviewPlumbing =
  /** The preview rendered its `<video>`, which the stream can now be shown in. */
  | { type: 'video-element'; video: HTMLVideoElement }
  | { type: 'video-frame'; ready: boolean }
  /** The preview's frame size, on its first frame and whenever the camera's shape changes, as on turning a phone. */
  | { type: 'preview-resize'; width: number; height: number };

/** Bubbles from the camera's parts to `<uc-camera-source>`. */
export class CameraActionEvent extends Event {
  public static readonly eventName = 'uc-internal:camera-action';

  public constructor(public readonly action: CameraCommand | PreviewPlumbing) {
    super(CameraActionEvent.eventName, { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    [CameraActionEvent.eventName]: CameraActionEvent;
  }
}
