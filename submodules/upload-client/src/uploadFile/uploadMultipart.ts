import defaultSettings from '../defaultSettings'
import { prepareChunks } from './prepareChunks.node'
import multipartStart from '../api/multipartStart'
import multipartUpload from '../api/multipartUpload'
import multipartComplete from '../api/multipartComplete'
import runWithConcurrency from '../tools/runWithConcurrency'
import { UploadcareFile } from '../tools/UploadcareFile'
import { getFileSize } from '../tools/isMultipart'
import { isReadyPoll } from '../tools/isReadyPoll'
import retrier from '../tools/retry'

/* Types */
import {
  MultipartUploadResponse,
  MultipartUploadOptions
} from '../api/multipartUpload'
import {
  ComputableProgressInfo,
  ProgressCallback,
  UnknownProgressInfo
} from '../api/types'
import { CustomUserAgent } from '../types'
import { NodeFile, BrowserFile } from '../request/types'

export type MultipartOptions = {
  publicKey: string
  contentType?: string
  multipartChunkSize?: number
  fileName?: string
  fileSize?: number
  baseURL?: string
  secureSignature?: string
  secureExpire?: string
  store?: boolean
  signal?: AbortSignal
  onProgress?: ProgressCallback<ComputableProgressInfo>
  source?: string
  integration?: string
  userAgent?: CustomUserAgent
  retryThrottledRequestMaxTimes?: number
  maxConcurrentRequests?: number
  multipartMaxAttempts?: number
  baseCDN?: string
}

const uploadPartWithRetry = (
  chunk: Buffer | Blob,
  url: string,
  {
    publicKey,
    onProgress,
    signal,
    integration,
    multipartMaxAttempts
  }: MultipartUploadOptions & { multipartMaxAttempts: number }
): Promise<MultipartUploadResponse> =>
  retrier(({ attempt, retry }) =>
    multipartUpload(chunk, url, {
      publicKey,
      onProgress,
      signal,
      integration
    }).catch((error) => {
      if (attempt < multipartMaxAttempts) {
        return retry()
      }

      throw error
    })
  )

const uploadMultipart = (
  file: NodeFile | BrowserFile,
  {
    publicKey,

    fileName,
    fileSize,
    baseURL,
    secureSignature,
    secureExpire,
    store,

    signal,
    onProgress,

    source,
    integration,
    userAgent,

    retryThrottledRequestMaxTimes,

    contentType,
    multipartChunkSize = defaultSettings.multipartChunkSize,
    maxConcurrentRequests = defaultSettings.maxConcurrentRequests,
    multipartMaxAttempts = defaultSettings.multipartMaxAttempts,

    baseCDN
  }: MultipartOptions
): Promise<UploadcareFile> => {
  const size = fileSize || getFileSize(file)

  let progressValues: number[]
  const createProgressHandler = (
    totalChunks: number,
    chunkIdx: number
  ): ProgressCallback | undefined => {
    if (!onProgress) return
    if (!progressValues) {
      progressValues = Array(totalChunks).fill(0)
    }

    const sum = (values: number[]): number =>
      values.reduce((sum, next) => sum + next, 0)

    return (info: ComputableProgressInfo | UnknownProgressInfo): void => {
      if (!info.isComputable) {
        return
      }
      progressValues[chunkIdx] = info.value
      onProgress({
        isComputable: true,
        value: sum(progressValues) / totalChunks
      })
    }
  }

  return multipartStart(size, {
    publicKey,
    contentType,
    fileName: fileName ?? (file as File).name,
    baseURL,
    secureSignature,
    secureExpire,
    store,
    signal,
    source,
    integration,
    userAgent,
    retryThrottledRequestMaxTimes
  })
    .then(({ uuid, parts }) => {
      const getChunk = prepareChunks(file, size, multipartChunkSize)
      return Promise.all([
        uuid,
        runWithConcurrency(
          maxConcurrentRequests,
          parts.map((url, index) => (): Promise<MultipartUploadResponse> =>
            uploadPartWithRetry(getChunk(index), url, {
              publicKey,
              onProgress: createProgressHandler(parts.length, index),
              signal,
              integration,
              multipartMaxAttempts
            })
          )
        )
      ])
    })
    .then(([uuid]) =>
      multipartComplete(uuid, {
        publicKey,
        baseURL,
        source,
        integration,
        userAgent,
        retryThrottledRequestMaxTimes
      })
    )
    .then((fileInfo) => {
      if (fileInfo.isReady) {
        return fileInfo
      } else {
        return isReadyPoll({
          file: fileInfo.uuid,
          publicKey,
          baseURL,
          source,
          integration,
          userAgent,
          retryThrottledRequestMaxTimes,
          onProgress,
          signal
        })
      }
    })
    .then((fileInfo) => new UploadcareFile(fileInfo, { baseCDN }))
}

export default uploadMultipart
