import type { CameraQuality } from '../../types/exported';
import { deserializeCsv } from '../../utils/comma-separated';
import { parseAspectRatio } from './aspectRatio';
import { QUALITY_SHORT_SIDE } from './buildConstraints';

/** The `cameraAspectRatioOptions` keyword for the camera's own shape, i.e. `cameraAspectRatio: ''`. */
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

export const parseQualityOptions = (csv: string): CameraQuality[] => {
  const known: string[] = ['auto', ...Object.keys(QUALITY_SHORT_SIDE)];
  return [...new Set(deserializeCsv(csv))].filter((item): item is CameraQuality => known.includes(item));
};

/** Leaves out presets above the camera's largest short side. Without a known maximum, every preset stays. */
export const filterQualityOptions = (options: CameraQuality[], maxShortSide: number | null): CameraQuality[] => {
  if (maxShortSide === null) return options;
  return options.filter((option) => option === 'auto' || QUALITY_SHORT_SIDE[option] <= maxShortSide);
};

/** The largest short side the camera reports, if it reports one. */
export const maxShortSideOf = (track: MediaStreamTrack | undefined): number | null => {
  const capabilities = track?.getCapabilities?.();
  const width = capabilities?.width?.max;
  const height = capabilities?.height?.max;
  return width && height ? Math.min(width, height) : null;
};

/**
 * Where a picker starts: the configured value when it is listed, otherwise the first option. `listed` tells the
 * caller whether to warn about the mismatch.
 */
export const pickInitial = <T>(options: T[], isConfigured: (option: T) => boolean): { value: T; listed: boolean } => {
  const configured = options.find(isConfigured);
  return configured === undefined ? { value: options[0] as T, listed: false } : { value: configured, listed: true };
};

/** The listed values that are one of `allowed`, in order and without repeats. */
export const parseOptions = <T extends string>(csv: string, allowed: readonly T[]): T[] =>
  [...new Set(deserializeCsv(csv))].filter((item): item is T => (allowed as readonly string[]).includes(item));
