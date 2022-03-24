import getFormData, { transformFile } from './getFormData.node'

import NodeFormData from 'form-data'
import { BrowserFile, NodeFile } from '../request/types'

/**
 * Constructs FormData instance from array.
 * Uses 'form-data' package in node or native FormData
 * in browsers.
 */

type FileTuple = ['file', BrowserFile | NodeFile, string]
type BaseType = string | number | void
type FormDataTuple = [string, BaseType | BaseType[]]

const isFileTuple = (tuple: FormDataTuple | FileTuple): tuple is FileTuple =>
  tuple[0] === 'file'

function buildFormData(
  body: (FormDataTuple | FileTuple)[]
): FormData | NodeFormData {
  const formData = getFormData()

  for (const tuple of body) {
    if (Array.isArray(tuple[1])) {
      // refactor this
      tuple[1].forEach(
        (val) => val && formData.append(tuple[0] + '[]', `${val}`)
      )
    } else if (isFileTuple(tuple)) {
      const name = tuple[2]
      const file = transformFile(tuple[1], name) as Blob // lgtm[js/superfluous-trailing-arguments]
      formData.append(tuple[0], file, name)
    } else if (tuple[1] != null) {
      formData.append(tuple[0], `${tuple[1]}`)
    }
  }

  return formData
}

export default buildFormData
