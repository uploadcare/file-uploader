import { sliceChunk } from './sliceChunk'

export function prepareChunks(
  file: Buffer | Blob,
  fileSize: number,
  chunkSize: number
): (index: number) => Buffer | Blob {
  return (index: number): Buffer | Blob =>
    sliceChunk(file, index, fileSize, chunkSize)
}
