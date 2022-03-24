import NodeFormData from 'form-data'
import { FileTransformer } from './types'
import { identity } from './identity'

export const transformFile: FileTransformer = identity
export default (): NodeFormData | FormData => new NodeFormData()
