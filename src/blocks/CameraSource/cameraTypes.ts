import type { CameraMode } from '../../abstract/cameraModes';
import type { CameraSetting } from './CaptureSettings';

/** Where the capture stands: the live preview, a photo taken, a clip being recorded, or a clip recorded. */
export type CameraPhase = 'live' | 'shot' | 'recording' | 'recorded';

/** What the user did in one of the camera's parts; the session decides what it means. */
export type CameraCommand =
  | { type: 'back' }
  | { type: 'close' }
  | { type: 'select-camera'; deviceId: string }
  | { type: 'select-microphone'; deviceId: string }
  | { type: 'request-access' }
  | { type: 'pick-setting'; setting: CameraSetting; value: string }
  | { type: 'select-tab'; tab: CameraMode }
  | { type: 'shutter' }
  | { type: 'retake' }
  | { type: 'accept' }
  | { type: 'toggle-microphone' }
  | { type: 'toggle-playback' };

/** What the controls render of the recording clock. */
export type ClockView = { readonly timerText: string; readonly progress: number | null };
