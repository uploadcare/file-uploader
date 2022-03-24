import { GroupId, GroupInfo } from './types'
import { FailedResponse } from '../request/types'
import { CustomUserAgent } from '../types'

import request from '../request/request.node'
import getUrl from '../tools/getUrl'

import defaultSettings from '../defaultSettings'
import { getUserAgent } from '../tools/userAgent'
import camelizeKeys from '../tools/camelizeKeys'
import { UploadClientError } from '../tools/errors'
import retryIfThrottled from '../tools/retryIfThrottled'

export type GroupInfoOptions = {
  publicKey: string
  baseURL?: string

  signal?: AbortSignal

  source?: string
  integration?: string
  userAgent?: CustomUserAgent

  retryThrottledRequestMaxTimes?: number
}

type Response = GroupInfo | FailedResponse

/**
 * Get info about group.
 */
export default function groupInfo(
  id: GroupId,
  {
    publicKey,
    baseURL = defaultSettings.baseURL,
    signal,
    source,
    integration,
    userAgent,
    retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes
  }: GroupInfoOptions
): Promise<GroupInfo> {
  return retryIfThrottled(
    () =>
      request({
        method: 'GET',
        headers: {
          'X-UC-User-Agent': getUserAgent({ publicKey, integration, userAgent })
        },
        url: getUrl(baseURL, '/group/info/', {
          jsonerrors: 1,
          pub_key: publicKey,
          group_id: id,
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
