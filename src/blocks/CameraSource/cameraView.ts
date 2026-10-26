import type { CameraMode } from '../../abstract/cameraModes';

/** Camera access: not asked yet, being asked, or the outcome. */
export type CameraPermission = 'idle' | 'prompt' | 'granted' | 'denied';

/** Where the capture stands: the live preview, a photo taken, a clip being recorded, or a clip recorded. */
export type CameraPhase = 'live' | 'shot' | 'recording' | 'recorded';

export type CameraViewInput = {
  permission: CameraPermission;
  phase: CameraPhase;
  tab: CameraMode | null;
  cameraModes: readonly CameraMode[];
  audioEnabled: boolean;
  cameraCount: number;
  microphoneCount: number;
  muted: boolean;
};

/** What the camera shows, as a function of its state: every `hidden` toggle, the message, and the shutter. */
export type CameraView = {
  videoHidden: boolean;
  messageHidden: boolean;
  /** The l10n key of the message, when one shows. */
  message: string;
  /** The camera picker; the caption shows in its place. */
  cameraSelectHidden: boolean;
  photoTabHidden: boolean;
  videoTabHidden: boolean;
  /** The recording timer; the tab switcher shows in its place. */
  timerHidden: boolean;
  actionsHidden: boolean;
  shotHidden: boolean;
  shotIcon: 'camera-full' | 'video-camera-full' | 'square';
  shotClass: string;
  microphoneHidden: boolean;
  microphoneIcon: 'microphone' | 'microphone-mute';
  audioSelectHidden: boolean;
  audioSelectDisabled: boolean;
};

const SHOT_CLASS = 'uc-shot-btn uc-camera-action';

export function deriveCameraView(input: CameraViewInput): CameraView {
  const { permission, phase, tab, cameraModes, audioEnabled, cameraCount, microphoneCount, muted } = input;
  const granted = permission === 'granted';
  const captured = phase === 'shot' || phase === 'recorded';
  const recordingOrRecorded = phase === 'recording' || phase === 'recorded';
  // The tabs give way while asking for access and once a capture is under way.
  const tabsHidden = permission === 'prompt' || phase !== 'live';
  const onVideo = tab === 'video';

  return {
    videoHidden: !granted,
    messageHidden: permission !== 'prompt' && permission !== 'denied',
    message: permission === 'prompt' ? 'camera-permissions-prompt' : 'camera-permissions-denied',
    cameraSelectHidden: cameraCount <= 1 || phase !== 'live',
    photoTabHidden: tabsHidden || !cameraModes.includes('photo'),
    videoTabHidden: tabsHidden || !cameraModes.includes('video'),
    timerHidden: !recordingOrRecorded,
    actionsHidden: permission === 'denied' || !captured,
    shotHidden: !granted || captured,
    shotIcon: phase === 'recording' ? 'square' : onVideo ? 'video-camera-full' : 'camera-full',
    shotClass: phase === 'recording' ? `${SHOT_CLASS} uc-stop-record` : SHOT_CLASS,
    microphoneHidden: !onVideo || !audioEnabled || phase === 'recorded',
    microphoneIcon: muted ? 'microphone-mute' : 'microphone',
    audioSelectHidden: !onVideo || !audioEnabled || microphoneCount <= 1 || phase !== 'live',
    audioSelectDisabled: !audioEnabled || muted,
  };
}
