import { MultipartPart } from './multipartStart'

import request from '../request/request.node'

import { ComputableProgressInfo, ProgressCallback } from './types'
import { NodeFile, BrowserFile } from '../request/types'

export type MultipartUploadOptions = {
  publicKey?: string
  signal?: AbortSignal
  onProgress?: ProgressCallback<ComputableProgressInfo>
  integration?: string
  retryThrottledRequestMaxTimes?: number
}

export type MultipartUploadResponse = {
  code?: number
}

/**
 * Complete multipart uploading.
 */

export default function multipartUpload(
  part: NodeFile | BrowserFile,
  url: MultipartPart,
  { signal, onProgress }: MultipartUploadOptions
): Promise<MultipartUploadResponse> {
  return request({
    method: 'PUT',
    url,
    data: part,
    // Upload request can't be non-computable because we always know exact size
    onProgress: onProgress as ProgressCallback,
    signal
  })
    .then((result) => {
      // hack for node ¯\_(ツ)_/¯
      if (onProgress)
        onProgress({
          isComputable: true,
          value: 1
        })

      return result
    })
    .then(({ status }) => ({ code: status }))
}
