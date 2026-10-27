import type {
  CameraAudioMode,
  CameraAudioQuality,
  CameraConstraints,
  CameraConstraintsResolver,
  CameraQuality,
} from '../../types/exported';
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

/** Short side, in pixels, of each `cameraQuality` preset. `'auto'` keeps the defaults. */
export const QUALITY_SHORT_SIDE: Record<Exclude<CameraQuality, 'auto'>, number> = {
  '720p': 720,
  '1080p': 1080,
  '4k': 2160,
};

/**
 * The resolution a preset asks for: its short side, with the long side from the ratio (16:9 without one).
 *
 * `'auto'` keeps the 1920×1080 defaults without a ratio. With one, it asks for a 1080 short side in that shape:
 * fixed 1920×1080 ideals outweigh an `aspectRatio` ideal, so the camera would never deliver the ratio.
 */
export const qualityResolution = (
  quality: CameraQuality,
  aspectRatio: number | null,
): Pick<MediaTrackConstraints, 'width' | 'height'> => {
  if (quality === 'auto' && aspectRatio === null) {
    return {};
  }
  const shortSide = QUALITY_SHORT_SIDE[quality === 'auto' ? '1080p' : quality];
  const ratio = aspectRatio ?? 16 / 9;
  if (ratio >= 1) {
    return { width: { ideal: Math.round(shortSide * ratio) }, height: { ideal: shortSide } };
  }
  return { width: { ideal: shortSide }, height: { ideal: Math.round(shortSide / ratio) } };
};

/**
 * Microphone settings per `cameraAudioMode`. `voice` keeps the browser defaults: mono, with echo cancellation, noise
 * suppression and auto gain. `music` turns that processing off and asks for stereo; Chromium turns processing off for
 * stereo anyway, so the two only make sense together.
 */
export const AUDIO_MODE_CONSTRAINTS: Record<CameraAudioMode, MediaTrackConstraints> = {
  voice: {},
  music: {
    echoCancellation: { ideal: false },
    noiseSuppression: { ideal: false },
    autoGainControl: { ideal: false },
    channelCount: { ideal: 2 },
  },
};

/** Recorder audio bitrate per `cameraAudioQuality`. `'auto'` leaves it to the browser. */
export const AUDIO_QUALITY_BITRATE: Record<Exclude<CameraAudioQuality, 'auto'>, number> = {
  low: 32_000,
  standard: 96_000,
  high: 192_000,
};

/**
 * The audio bitrate to record with. An explicit `mediaRecorderOptions` bitrate wins: `bitsPerSecond` covers audio and
 * video together, so it counts too.
 */
export const audioBitsPerSecond = (
  recorderOptions: MediaRecorderOptions | null,
  quality: CameraAudioQuality,
): number | undefined => {
  if (recorderOptions?.audioBitsPerSecond || recorderOptions?.bitsPerSecond) {
    return recorderOptions.audioBitsPerSecond;
  }
  return quality === 'auto' ? undefined : AUDIO_QUALITY_BITRATE[quality];
};

export type BuildConstraintsInput = {
  mode: CameraMode;
  enableAudio: boolean;
  audioMode: CameraAudioMode;
  /** Width / height from `cameraAspectRatio`, or `null` for the camera's native shape. */
  aspectRatio: number | null;
  quality: CameraQuality;
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
 * built-in defaults < `cameraQuality` < `cameraAspectRatio` < `cameraConstraints` < the device picked in the camera
 * screen. Audio: `cameraAudioMode` < `cameraConstraints` < the picked microphone.
 */
export const buildConstraints = ({
  mode,
  enableAudio,
  audioMode,
  aspectRatio,
  quality,
  custom,
  cameraId,
  audioId,
}: BuildConstraintsInput): MediaStreamConstraints & { video: MediaTrackConstraints } => {
  const resolved = resolveCustomConstraints(custom, mode);

  const video: MediaTrackConstraints = {
    ...DEFAULT_VIDEO_CONSTRAINTS,
    ...qualityResolution(quality, aspectRatio),
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

  const audio: MediaTrackConstraints = { ...AUDIO_MODE_CONSTRAINTS[audioMode], ...resolved.audio };
  if (audioId) {
    audio.deviceId = { exact: audioId };
  }
  return { video, audio };
};
