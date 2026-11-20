/** Why the camera could not start: access was refused, there is no camera, or it is busy or broken. */
export type CameraFailure = 'denied' | 'not-found' | 'unavailable';

/** Reads a `getUserMedia` rejection by its name; anything unknown counts as the camera being unavailable. */
export const cameraFailureOf = (error: unknown): CameraFailure => {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found';
  return 'unavailable';
};
