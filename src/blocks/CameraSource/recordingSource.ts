import { centerCrop } from './aspectRatio';

/** Two ratios this close count as the same shape: rounding in the camera's resolution must not force a re-encode. */
const RATIO_TOLERANCE = 0.01;

export type RecordingPlan = 'direct' | 'canvas' | 'unsupported';

/**
 * How a recording gets the same shape and mirroring as a photo. `direct` records the camera stream as is, which costs
 * nothing; `canvas` redraws each frame cropped and mirrored; `unsupported` means it needs the canvas but the browser
 * can't record one.
 */
export const planRecording = ({
  width,
  height,
  aspectRatio,
  mirror,
  canCaptureCanvas,
}: {
  width: number;
  height: number;
  aspectRatio: number | null;
  mirror: boolean;
  canCaptureCanvas: boolean;
}): RecordingPlan => {
  const needsCrop = aspectRatio !== null && height > 0 && Math.abs(width / height - aspectRatio) > RATIO_TOLERANCE;
  if (!needsCrop && !mirror) {
    return 'direct';
  }
  return canCaptureCanvas ? 'canvas' : 'unsupported';
};

export type RecordingSource = {
  stream: MediaStream;
  /** Whether the recorded frames are mirrored, so playback must not mirror them a second time. */
  mirrored: boolean;
  /** Stops redrawing frames. The camera tracks are left alone: they belong to the preview. */
  stop: () => void;
};

const canCaptureCanvas = (): boolean =>
  typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';

/**
 * The stream to record from `video`, which shows the live camera `stream`: cropped to `aspectRatio` from the center
 * and mirrored like photos are.
 */
export const createRecordingSource = ({
  video,
  stream,
  aspectRatio,
  mirror,
}: {
  video: HTMLVideoElement;
  stream: MediaStream;
  aspectRatio: number | null;
  mirror: boolean;
}): RecordingSource => {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const plan = planRecording({ width, height, aspectRatio, mirror, canCaptureCanvas: canCaptureCanvas() });

  if (plan !== 'canvas') {
    if (plan === 'unsupported') {
      console.warn(
        'This browser cannot crop or mirror video recordings (no canvas.captureStream), recording the camera as is.',
      );
    }
    return { stream, mirrored: false, stop: () => {} };
  }

  const crop = centerCrop(width, height, aspectRatio ?? width / height);
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('Failed to get a canvas context for the recording, recording the camera as is.');
    return { stream, mirrored: false, stop: () => {} };
  }
  if (mirror) {
    ctx.translate(crop.width, 0);
    ctx.scale(-1, 1);
  }

  const draw = () => ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  // The first frame goes in before the recorder starts, so the clip doesn't open on a blank frame.
  draw();

  // Redraw on every new camera frame where the browser says when one arrives, otherwise on every repaint.
  let stopped = false;
  let handle = 0;
  const canWatchFrames = typeof video.requestVideoFrameCallback === 'function';
  const loop = () => {
    if (stopped) return;
    draw();
    handle = canWatchFrames ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
  };
  handle = canWatchFrames ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);

  const frameRate = stream.getVideoTracks()[0]?.getSettings().frameRate;
  const canvasStream = canvas.captureStream(frameRate || 30);
  for (const track of stream.getAudioTracks()) {
    canvasStream.addTrack(track);
  }

  return {
    stream: canvasStream,
    mirrored: mirror,
    stop: () => {
      stopped = true;
      if (canWatchFrames) {
        video.cancelVideoFrameCallback(handle);
      } else {
        cancelAnimationFrame(handle);
      }
      // Only the canvas track: the audio tracks are the camera's own and keep running for the next take.
      for (const track of canvasStream.getVideoTracks()) {
        track.stop();
      }
    },
  };
};
