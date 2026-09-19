import type { StoredImage } from './files';

/**
 * The dimensions the fake API reports for an upload, read out of the bytes themselves rather than trusted from the
 * declared mime type — the suite uploads a PNG named `square.jpg` as `image/jpeg`, and the real API answers with what
 * it decoded, not with what it was told. Bytes that decode as nothing are a non-image: `is_image: false`, no
 * `image_info`, which is the same answer the real API gives the fixture whose contents are the word "content".
 *
 * Only the formats the suite actually uploads. Anything else reads as a non-image, so a test that starts uploading,
 * say, a WebP will see `is_image: false` and should send us back here.
 */
export const imageSize = (bytes: Uint8Array): StoredImage | undefined => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = (offset: number) => view.getUint8(offset);

  // PNG: an 8-byte signature, then an IHDR chunk whose first two fields are the dimensions.
  if (bytes.byteLength > 24 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    return { width: view.getUint32(16), height: view.getUint32(20), format: 'PNG' };
  }

  // GIF: "GIF8", then the logical screen descriptor, little-endian.
  if (bytes.byteLength > 10 && at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true), format: 'GIF' };
  }

  // JPEG: walk the segments to the start-of-frame, which is the only one carrying the dimensions.
  if (bytes.byteLength > 4 && at(0) === 0xff && at(1) === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.byteLength) {
      if (at(offset) !== 0xff) {
        // Not on a marker boundary: either padding, or entropy-coded data we have no business walking.
        offset += 1;
        continue;
      }
      const marker = at(offset + 1);
      const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isStartOfFrame) {
        return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7), format: 'JPEG' };
      }
      // Standalone markers carry no length field; everything else states how far the next one is.
      offset += marker >= 0xd0 && marker <= 0xd9 ? 2 : 2 + view.getUint16(offset + 2);
    }
  }

  return undefined;
};
