import { deserializeCsv } from '../../utils/comma-separated';

/**
 * The MIME types each `cameraVideoFormats` shorthand tries, best first.
 *
 * `mp4` asks for H.264 + AAC before plain `video/mp4`: Chromium fills a bare `video/mp4` with VP9 + Opus, which
 * QuickTime and many phones can't play.
 */
export const VIDEO_FORMAT_MIME_TYPES: Record<string, string[]> = {
  webm: ['video/webm'],
  mp4: ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'],
};

/**
 * A `cameraVideoFormats` item: a shorthand, or a MIME type such as `video/mp4;codecs=avc1`. A codec list can't be one:
 * its commas split the list.
 */
const isShorthand = (item: string): boolean => Object.hasOwn(VIDEO_FORMAT_MIME_TYPES, item);

export const isVideoFormat = (item: string): boolean => isShorthand(item) || /^video\/[\w.+-]+(\s*;.*)?$/.test(item);

/**
 * The MIME type to record with: an explicit `mediaRecorderOptions.mimeType` the browser supports, else the first
 * supported entry of `cameraVideoFormats`. `undefined` lets the browser pick, rather than ask for a type it can't
 * record and fail.
 */
export const pickVideoMimeType = ({
  explicit,
  formats,
  isSupported,
}: {
  explicit: string | undefined;
  formats: string;
  isSupported: (mimeType: string) => boolean;
}): string | undefined => {
  if (explicit && isSupported(explicit)) {
    return explicit;
  }
  for (const item of deserializeCsv(formats)) {
    const candidates =
      (isShorthand(item) ? VIDEO_FORMAT_MIME_TYPES[item] : undefined) ?? (isVideoFormat(item) ? [item] : []);
    const supported = candidates.find(isSupported);
    if (supported) {
      return supported;
    }
  }
  return undefined;
};

/**
 * The file type for a recording: the recorder's own type without its codecs, e.g. `video/x-matroska` rather than an
 * extension-derived `video/mkv`. Firefox used to report an empty type while recording WebM.
 */
export const recordingFileType = (recorderMimeType: string | undefined): string => {
  const base = recorderMimeType?.split(';')[0]?.trim();
  return base?.startsWith('video/') ? base : 'video/webm';
};
