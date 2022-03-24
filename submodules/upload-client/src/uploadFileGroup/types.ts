import { isFileData, isUrl, isUuid } from '../uploadFile/types'
import { Url, Uuid } from '../api/types'
import { NodeFile, BrowserFile } from '../request/types'

/**
 * FileData type guard.
 */
export const isFileDataArray = (
  data: (NodeFile | BrowserFile)[] | Url[] | Uuid[]
): data is (NodeFile | BrowserFile)[] => {
  for (const item of data) {
    if (!isFileData(item)) {
      return false
    }
  }

  return true
}

/**
 * Uuid type guard.
 */
export const isUuidArray = (
  data: (NodeFile | BrowserFile)[] | Url[] | Uuid[]
): data is Uuid[] => {
  for (const item of data) {
    if (!isUuid(item)) {
      return false
    }
  }

  return true
}

/**
 * Url type guard.
 */
export const isUrlArray = (
  data: (NodeFile | BrowserFile)[] | Url[] | Uuid[]
): data is Url[] => {
  for (const item of data) {
    if (!isUrl(item)) {
      return false
    }
  }

  return true
}
