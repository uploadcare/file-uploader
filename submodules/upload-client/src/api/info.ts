import request from '../request/request.node'
import getUrl from '../tools/getUrl'
import defaultSettings from '../defaultSettings'
import { getUserAgent } from '../tools/userAgent'
import camelizeKeys from '../tools/camelizeKeys'
import { UploadClientError } from '../tools/errors'
import retryIfThrottled from '../tools/retryIfThrottled'

/* Types */
import { Uuid, FileInfo } from './types'
import { CustomUserAgent } from '../types'
import { FailedResponse } from '../request/types'

type Response = FileInfo | FailedResponse

export type InfoOptions = {
  publicKey: string

  baseURL?: string

  signal?: AbortSignal

  source?: string
  integration?: string
  userAgent?: CustomUserAgent

  retryThrottledRequestMaxTimes?: number
}

/**
 * Returns a JSON dictionary holding file info.
 */
export default function info(
  uuid: Uuid,
  {
    publicKey,
    baseURL = defaultSettings.baseURL,
    signal,
    source,
    integration,
    userAgent,
    retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes
  }: InfoOptions
): Promise<FileInfo> {
  return retryIfThrottled(
    () =>
      request({
        method: 'GET',
        headers: {
          'X-UC-User-Agent': getUserAgent({ publicKey, integration, userAgent })
        },
        url: getUrl(baseURL, '/info/', {
          jsonerrors: 1,
          pub_key: publicKey,
          file_id: uuid,
          source
        }),
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
