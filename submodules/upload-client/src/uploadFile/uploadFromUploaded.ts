import { UploadcareFile } from '../tools/UploadcareFile'
import info from '../api/info'

/* Types */
import { Uuid } from '..'
import { ProgressCallback } from '../api/types'
import { CustomUserAgent } from '../types'

type FromUploadedOptions = {
  publicKey: string

  fileName?: string
  baseURL?: string

  signal?: AbortSignal
  onProgress?: ProgressCallback

  source?: string
  integration?: string
  userAgent?: CustomUserAgent

  retryThrottledRequestMaxTimes?: number

  baseCDN?: string
}

const uploadFromUploaded = (
  uuid: Uuid,
  {
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
  }: FromUploadedOptions
): Promise<UploadcareFile> => {
  return info(uuid, {
    publicKey,
    baseURL,
    signal,
    source,
    integration,
    userAgent,
    retryThrottledRequestMaxTimes
  })
    .then((fileInfo) => new UploadcareFile(fileInfo, { baseCDN, fileName }))
    .then((result) => {
      // hack for node ¯\_(ツ)_/¯
      if (onProgress)
        onProgress({
          isComputable: true,
          value: 1
        })

      return result
    })
}

export default uploadFromUploaded
