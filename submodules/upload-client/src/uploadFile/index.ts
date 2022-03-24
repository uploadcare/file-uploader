import uploadBase from './uploadBase'
import uploadFromUrl from './uploadFromUrl'
import uploadFromUploaded from './uploadFromUploaded'
import defaultSettings from '../defaultSettings'

/* Types */
import { Url, Uuid, ProgressCallback } from '../api/types'
import { CustomUserAgent } from '../types'
import { NodeFile, BrowserFile } from '../request/types'
import { isFileData, isUrl, isUuid } from './types'
import { UploadcareFile } from '../tools/UploadcareFile'
import { isMultipart, getFileSize } from '../tools/isMultipart'
import uploadMultipart from './uploadMultipart'

export type FileFromOptions = {
  publicKey: string

  fileName?: string
  baseURL?: string
  secureSignature?: string
  secureExpire?: string
  store?: boolean

  signal?: AbortSignal
  onProgress?: ProgressCallback

  source?: string
  integration?: string
  userAgent?: CustomUserAgent

  retryThrottledRequestMaxTimes?: number

  contentType?: string
  multipartChunkSize?: number
  multipartMaxAttempts?: number
  maxConcurrentRequests?: number

  baseCDN?: string

  checkForUrlDuplicates?: boolean
  saveUrlForRecurrentUploads?: boolean
  pusherKey?: string
}

/**
 * Uploads file from provided data.
 */

function uploadFile(
  data: NodeFile | BrowserFile | Url | Uuid,
  {
    publicKey,

    fileName,
    baseURL = defaultSettings.baseURL,
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
    multipartChunkSize,
    multipartMaxAttempts,
    maxConcurrentRequests,

    baseCDN = defaultSettings.baseCDN,

    checkForUrlDuplicates,
    saveUrlForRecurrentUploads,
    pusherKey
  }: FileFromOptions
): Promise<UploadcareFile> {
  if (isFileData(data)) {
    const fileSize = getFileSize(data)

    if (isMultipart(fileSize)) {
      return uploadMultipart(data, {
        publicKey,
        contentType,
        multipartChunkSize,
        multipartMaxAttempts,

        fileName,
        baseURL,
        secureSignature,
        secureExpire,
        store,

        signal,
        onProgress,

        source,
        integration,
        userAgent,

        maxConcurrentRequests,
        retryThrottledRequestMaxTimes,

        baseCDN
      })
    }

    return uploadBase(data, {
      publicKey,

      fileName,
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

      baseCDN
    })
  }

  if (isUrl(data)) {
    return uploadFromUrl(data, {
      publicKey,

      fileName,
      baseURL,
      baseCDN,
      checkForUrlDuplicates,
      saveUrlForRecurrentUploads,
      secureSignature,
      secureExpire,
      store,

      signal,
      onProgress,

      source,
      integration,
      userAgent,

      retryThrottledRequestMaxTimes,
      pusherKey
    })
  }

  if (isUuid(data)) {
    return uploadFromUploaded(data, {
      publicKey,

      fileName,
      baseURL,

      signal,
      onProgress,

      source,
      integration,
      userAgent,

      retryThrottledRequestMaxTimes,

      baseCDN
    })
  }

  throw new TypeError(`File uploading from "${data}" is not supported`)
}

export {
  uploadFile,
  uploadFromUrl,
  uploadBase,
  uploadFromUploaded,
  uploadMultipart
}
