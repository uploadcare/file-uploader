export const sliceChunk = (
  file: Buffer | Blob,
  index: number,
  fileSize: number,
  chunkSize: number
): Buffer | Blob => {
  const start = chunkSize * index
  const end = Math.min(start + chunkSize, fileSize)

  return file.slice(start, end)
}
