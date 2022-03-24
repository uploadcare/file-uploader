import { FailedResponse } from '../request/types'
import { Uuid, FileInfo } from './types'
import { CustomUserAgent } from '../types'

import request from '../request/request.node'
import getFormData from '../tools/buildFormData'
import getUrl from '../tools/getUrl'
import defaultSettings from '../defaultSettings'
import { getUserAgent } from '../tools/userAgent'
import camelizeKeys from '../tools/camelizeKeys'
import retryIfThrottled from '../tools/retryIfThrottled'
import { UploadClientError } from '../tools/errors'

export type MultipartCompleteOptions = {
  publicKey: string
  baseURL?: string
  signal?: AbortSignal
  source?: string
  integration?: string
  userAgent?: CustomUserAgent
  retryThrottledRequestMaxTimes?: number
}

type Response = FailedResponse | FileInfo

/**
 * Complete multipart uploading.
 */
export default function multipartComplete(
  uuid: Uuid,
  {
    publicKey,
    baseURL = defaultSettings.baseURL,
    source = 'local',
    signal,
    integration,
    userAgent,
    retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes
  }: MultipartCompleteOptions
): Promise<FileInfo> {
  return retryIfThrottled(
    () =>
      request({
        method: 'POST',
        url: getUrl(baseURL, '/multipart/complete/', { jsonerrors: 1 }),
        headers: {
          'X-UC-User-Agent': getUserAgent({ publicKey, integration, userAgent })
        },
        data: getFormData([
          ['uuid', uuid],
          ['UPLOADCARE_PUB_KEY', publicKey],
          ['source', source]
        ]),
        signal
      }).then(({ data, headers, request }) => {
        const response = camelizeKeys<Response>(JSON.parse(data))

        if ('error' in response) {
          throw new UploadClientError(
            response.error.content,
            response.error.errorCode,
            request,
            response,
            headers
          )
        } else {
          return response
        }
      }),
    retryThrottledRequestMaxTimes
  )
}
