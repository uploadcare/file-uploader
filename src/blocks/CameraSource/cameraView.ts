import type { CameraMode } from '../../abstract/cameraModes';

/** Camera access: not asked yet, being asked, or the outcome. */
export type CameraPermission = 'idle' | 'prompt' | 'granted' | 'denied';

/** Why the camera could not start: access was refused, there is no camera, or it is busy or broken. */
export type CameraFailure = 'denied' | 'not-found' | 'unavailable';

/** Reads a `getUserMedia` rejection by its name; anything unknown counts as the camera being unavailable. */
export const cameraFailureOf = (error: unknown): CameraFailure => {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found';
  return 'unavailable';
};

const FAILURE_MESSAGE = {
  denied: 'camera-permissions-denied',
  'not-found': 'camera-not-found',
  unavailable: 'camera-unavailable',
} as const satisfies Record<CameraFailure, string>;

/** Where the capture stands: the live preview, a photo taken, a clip being recorded, or a clip recorded. */
export type CameraPhase = 'live' | 'shot' | 'recording' | 'recorded';

export type CameraViewInput = {
  permission: CameraPermission;
  /** Why access ended `denied`; refused access when not given. */
  failure?: CameraFailure;
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
  message: 'camera-permissions-prompt' | (typeof FAILURE_MESSAGE)[CameraFailure];
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
  const {
    permission,
    failure = 'denied',
    phase,
    tab,
    cameraModes,
    audioEnabled,
    cameraCount,
    microphoneCount,
    muted,
  } = input;
  const granted = permission === 'granted';
  const captured = phase === 'shot' || phase === 'recorded';
  const recordingOrRecorded = phase === 'recording' || phase === 'recorded';
  // The tabs give way while asking for access and once a capture is under way.
  const tabsHidden = permission === 'prompt' || phase !== 'live';
  const onVideo = tab === 'video';

  return {
    videoHidden: !granted,
    messageHidden: permission !== 'prompt' && permission !== 'denied',
    message: permission === 'prompt' ? 'camera-permissions-prompt' : FAILURE_MESSAGE[failure],
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
