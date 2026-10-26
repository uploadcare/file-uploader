import type { CameraConstraints, CameraConstraintsResolver } from '../../types/exported';
import type { CameraMode } from './CameraSource';

export const DEFAULT_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: {
    ideal: 1920,
  },
  height: {
    ideal: 1080,
  },
  frameRate: {
    ideal: 30,
  },
};

export type BuildConstraintsInput = {
  mode: CameraMode;
  enableAudio: boolean;
  /** Width / height from `cameraAspectRatio`, or `null` for the camera's native shape. */
  aspectRatio: number | null;
  /** `cameraConstraints` from the config. */
  custom: CameraConstraints | CameraConstraintsResolver | null;
  cameraId: string | null;
  audioId: string | null;
};

/** The integrator's constraints for a mode. A resolver that throws counts as none, so a bug there can't block the camera. */
export const resolveCustomConstraints = (
  custom: CameraConstraints | CameraConstraintsResolver | null,
  mode: CameraMode,
): CameraConstraints => {
  if (typeof custom !== 'function') {
    return custom ?? {};
  }
  try {
    return custom({ mode }) ?? {};
  } catch (error) {
    console.warn('cameraConstraints threw, opening the camera without it', error);
    return {};
  }
};

/**
 * The constraints the camera opens with, layered per property:
 * built-in defaults < `cameraAspectRatio` < `cameraConstraints` < the device picked in the camera screen.
 */
export const buildConstraints = ({
  mode,
  enableAudio,
  aspectRatio,
  custom,
  cameraId,
  audioId,
}: BuildConstraintsInput): MediaStreamConstraints & { video: MediaTrackConstraints } => {
  const resolved = resolveCustomConstraints(custom, mode);

  const video: MediaTrackConstraints = {
    ...DEFAULT_VIDEO_CONSTRAINTS,
    // Only `ideal`: most cameras offer a few native shapes, and the photo is cropped to the exact ratio anyway.
    ...(aspectRatio && { aspectRatio: { ideal: aspectRatio } }),
    ...resolved.video,
  };
  if (cameraId) {
    video.deviceId = { exact: cameraId };
  }

  if (!enableAudio) {
    return { video, audio: false };
  }

  const audio: MediaTrackConstraints = { ...resolved.audio };
  if (audioId) {
    audio.deviceId = { exact: audioId };
  }
  return { video, audio };
};
