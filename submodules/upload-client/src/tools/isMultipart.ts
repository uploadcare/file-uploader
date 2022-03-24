import defaultSettings from '../defaultSettings'

/* Types */
import { NodeFile, BrowserFile } from '../request/types'

/**
 * Get file size.
 */
export const getFileSize = (file: NodeFile | BrowserFile): number => {
  return (file as Buffer).length || (file as Blob).size
}

/**
 * Check if FileData is multipart data.
 */
export const isMultipart = (
  fileSize: number,
  multipartMinFileSize: number = defaultSettings.multipartMinFileSize
): boolean => {
  return fileSize >= multipartMinFileSize
}
