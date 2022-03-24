import { sliceChunk } from './sliceChunk'

/**
 * React-native hack for blob slicing
 *
 * We need to store references to sliced blobs to prevent source blob from
 * being deallocated until uploading complete. Access to deallocated blob
 * causes app crash.
 *
 * See https://github.com/uploadcare/uploadcare-upload-client/issues/306
 * and https://github.com/facebook/react-native/issues/27543
 */
export function prepareChunks(
  file: Buffer | Blob,
  fileSize: number,
  chunkSize: number
): (index: number) => Buffer | Blob {
  const chunks: (Buffer | Blob)[] = []
  return (index: number): Buffer | Blob => {
    const chunk = sliceChunk(file, index, fileSize, chunkSize)
    chunks.push(chunk)
    return chunk
  }
}
