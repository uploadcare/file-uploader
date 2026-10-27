/**
 * Parses a `"w:h"` ratio such as `"16:9"` or `"1:1"` into width / height. `""` means the camera's native shape and
 * gives `null`.
 * @throws When the value is not empty and not two positive numbers separated by a colon.
 */
export const parseAspectRatio = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  const match = /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/.exec(trimmed);
  const width = Number(match?.[1]);
  const height = Number(match?.[2]);
  if (!match || !(width > 0) || !(height > 0)) {
    throw new Error(`Invalid aspect ratio: "${value}". Expected "w:h", e.g. "16:9" or "1:1".`);
  }
  return width / height;
};

export type CropRect = { x: number; y: number; width: number; height: number };

/** The largest centered rectangle of `ratio` (width / height) that fits in a `width` × `height` frame. */
export const centerCrop = (width: number, height: number, ratio: number): CropRect => {
  if (width / height > ratio) {
    const cropWidth = Math.round(height * ratio);
    return { x: Math.round((width - cropWidth) / 2), y: 0, width: cropWidth, height };
  }
  const cropHeight = Math.round(width / ratio);
  return { x: 0, y: Math.round((height - cropHeight) / 2), width, height: cropHeight };
};
