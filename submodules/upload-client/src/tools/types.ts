import { BrowserFile, NodeFile } from '../request/types'

export type ReactNativeAsset = { name?: string; type?: string; uri: string }

export type FileTransformer = (
  file: NodeFile | BrowserFile,
  name: string
) => NodeFile | BrowserFile | ReactNativeAsset
