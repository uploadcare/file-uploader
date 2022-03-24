import { BrowserFile, NodeFile } from '../request/types'
import { FileTransformer, ReactNativeAsset } from './types'

export const transformFile: FileTransformer = (
  file: BrowserFile | NodeFile,
  name: string
): ReactNativeAsset => {
  if (!file) {
    return file
  }
  const uri = URL.createObjectURL(file)
  const type = (file as BrowserFile).type
  return { uri, name, type }
}

export default (): FormData => new FormData()
