import NodeFormData from 'form-data'
import {
  ComputableProgressInfo,
  ProgressCallback,
  UnknownProgressInfo
} from '../api/types'

export type Headers = {
  [key: string]: string | string[] | undefined
}

export type RequestOptions = {
  method?: string
  url: string
  query?: string
  data?: NodeFormData | FormData | BrowserFile | NodeFile
  headers?: Headers
  signal?: AbortSignal
  onProgress?: ProgressCallback<ComputableProgressInfo | UnknownProgressInfo>
}

export type ErrorRequestInfo = {
  method?: string
  url: string
  query?: string
  data?: NodeFormData | FormData | BrowserFile | NodeFile
  headers?: Headers
}

export type RequestResponse = {
  request: RequestOptions
  data: string
  headers: Headers
  status?: number
}

export type FailedResponse = {
  error: {
    content: string
    statusCode: number
    errorCode: string
  }
}

export type BrowserFile = Blob | File
export type NodeFile = Buffer // | NodeJS.ReadableStream
