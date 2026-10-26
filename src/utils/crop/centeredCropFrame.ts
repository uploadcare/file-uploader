/** The largest crop of `aspectRatio` that fits a `width` x `height` image, centred on it. */
export function calculateMaxCenteredCropFrame(
  width: number,
  height: number,
  aspectRatio: number,
): { x: number; y: number; width: number; height: number } {
  const imageAspectRatio = width / height;
  let cropWidth: number;
  let cropHeight: number;

  if (imageAspectRatio > aspectRatio) {
    cropWidth = Math.round(height * aspectRatio);
    cropHeight = height;
  } else {
    cropWidth = width;
    cropHeight = Math.round(width / aspectRatio);
  }

  const cropX = Math.round((width - cropWidth) / 2);
  const cropY = Math.round((height - cropHeight) / 2);

  if (cropX + cropWidth > width) {
    cropWidth = width - cropX;
  }
  if (cropY + cropHeight > height) {
    cropHeight = height - cropY;
  }

  return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
}
