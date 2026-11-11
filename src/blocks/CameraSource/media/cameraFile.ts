const KNOWN_CONTAINERS: Record<string, string> = {
  mp4: 'mp4',
  ogg: 'ogg',
  webm: 'webm',
  quicktime: 'mov',
  'x-matroska': 'mkv',
};

/** The file extension for a recorded clip's mime type, e.g. `video/x-matroska;codecs=avc1,opus` → `mkv`. */
export const guessExtensionByMime = (mime: string | undefined): string => {
  // MediaRecorder.mimeType is an empty string in Firefox, which records WebM by default.
  // @link https://bugzilla.mozilla.org/show_bug.cgi?id=1512175
  if (mime === '') return 'webm';
  const [kind, ...rest] = mime?.split('/') ?? [];
  if (kind === 'video') {
    const container = rest.join('/').split(';')[0];
    if (container && KNOWN_CONTAINERS[container]) return KNOWN_CONTAINERS[container];
  }
  return 'avi';
};

/** A captured photo or clip as a file named after its kind and the time. */
export const createCameraFile = (type: 'camera' | 'video', ext: string, format: string, blob: Blob): File => {
  const date = Date.now();
  return new File([blob], `${type}-${date}.${ext}`, { lastModified: date, type: format });
};
