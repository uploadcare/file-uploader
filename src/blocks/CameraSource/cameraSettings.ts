import type { CameraAudioMode, CameraAudioQuality, CameraResolution } from '../../types/exported';
import { deserializeCsv } from '../../utils/comma-separated';
import { parseAspectRatio } from './aspectRatio';
import { RESOLUTION_SHORT_SIDE } from './buildConstraints';

/** The `cameraAspectRatio` keyword for the camera's own shape, the same as an empty value. */
export const NATIVE_ASPECT_RATIO = 'native';

/**
 * The listed ratios, without repeats. Two spellings of the same ratio (`16:9`, `16 : 9`) count as one. The config has
 * already validated the list, so an invalid item is only skipped.
 */
export const parseAspectRatioOptions = (csv: string): string[] => {
  const seen = new Set<number | null>();
  const options: string[] = [];
  for (const item of deserializeCsv(csv)) {
    const ratio = toRatio(item);
    if (ratio === undefined || seen.has(ratio)) continue;
    seen.add(ratio);
    options.push(item === NATIVE_ASPECT_RATIO ? item : item.replace(/\s+/g, ''));
  }
  return options;
};

/** Width / height of an option or a `cameraAspectRatio` value; `null` for the native shape, `undefined` if invalid. */
export const toRatio = (value: string): number | null | undefined => {
  if (value === NATIVE_ASPECT_RATIO) return null;
  try {
    return parseAspectRatio(value);
  } catch {
    return undefined;
  }
};

/** The values each list option takes. The config validates against them; the pickers keep only these. */
export const RESOLUTIONS: readonly CameraResolution[] = ['auto', '720p', '1080p', '4k'];
export const AUDIO_QUALITIES: readonly CameraAudioQuality[] = ['auto', 'low', 'standard', 'high'];
export const AUDIO_MODES: readonly CameraAudioMode[] = ['voice', 'music'];

/** Leaves out presets above the camera's largest short side. Without a known maximum, every preset stays. */
export const filterResolutionOptions = (
  options: CameraResolution[],
  maxShortSide: number | null,
): CameraResolution[] => {
  if (maxShortSide === null) return options;
  return options.filter((option) => option === 'auto' || RESOLUTION_SHORT_SIDE[option] <= maxShortSide);
};

/** The largest short side the camera reports, if it reports one. */
export const maxShortSideOf = (track: MediaStreamTrack | undefined): number | null => {
  const capabilities = track?.getCapabilities?.();
  const width = capabilities?.width?.max;
  const height = capabilities?.height?.max;
  return width && height ? Math.min(width, height) : null;
};

/** The listed values that are one of `allowed`, in order and without repeats. */
export const parseOptions = <T extends string>(csv: string, allowed: readonly T[]): T[] =>
  [...new Set(deserializeCsv(csv))].filter((item): item is T => (allowed as readonly string[]).includes(item));
