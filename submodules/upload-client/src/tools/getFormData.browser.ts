import { FileTransformer } from './types'
import { identity } from './identity'

export const transformFile: FileTransformer = identity
export default (): FormData => new FormData()
