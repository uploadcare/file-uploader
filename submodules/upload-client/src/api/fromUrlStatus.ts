import { FileInfo, Token } from './types'
import { FailedResponse } from '../request/types'
import { CustomUserAgent } from '../types'

import request from '../request/request.node'
import getUrl from '../tools/getUrl'

import defaultSettings from '../defaultSettings'
import { getUserAgent } from '../tools/userAgent'
import camelizeKeys from '../tools/camelizeKeys'
import { UploadClientError } from '../tools/errors'
import retryIfThrottled from '../tools/retryIfThrottled'

export enum Status {
  Unknown = 'unknown',
  Waiting = 'waiting',
  Progress = 'progress',
  Error = 'error',
  Success = 'success'
}

type StatusUnknownResponse = {
  status: Status.Unknown
}

type StatusWaitingResponse = {
  status: Status.Waiting
}

type StatusProgressResponse = {
  status: Status.Progress
  size: number
  done: number
  total: number | 'unknown'
}

type StatusErrorResponse = {
  status: Status.Error
  error: string
  errorCode: string
}

type StatusSuccessResponse = {
  status: Status.Success
} & FileInfo

export type FromUrlStatusResponse =
  | StatusUnknownResponse
  | StatusWaitingResponse
  | StatusProgressResponse
  | StatusErrorResponse
  | StatusSuccessResponse

type Response = FromUrlStatusResponse | FailedResponse

const isErrorResponse = (
  response: Response
): response is StatusErrorResponse => {
  return 'status' in response && response.status === Status.Error
}

export type FromUrlStatusOptions = {
  publicKey?: string

  baseURL?: string

  signal?: AbortSignal

  integration?: string
  userAgent?: CustomUserAgent

  retryThrottledRequestMaxTimes?: number
}

/**
 * Checking upload status and working with file tokens.
 */
export default function fromUrlStatus(
  token: Token,
  {
    publicKey,
    baseURL = defaultSettings.baseURL,
    signal,
    integration,
    userAgent,
    retryThrottledRequestMaxTimes = defaultSettings.retryThrottledRequestMaxTimes
  }: FromUrlStatusOptions = {}
): Promise<FromUrlStatusResponse> {
  return retryIfThrottled(
    () =>
      request({
        method: 'GET',
        headers: publicKey
          ? {
              'X-UC-User-Agent': getUserAgent({
                publicKey,
                integration,
                userAgent
              })
            }
          : undefined,
        url: getUrl(baseURL, '/from_url/status/', {
          jsonerrors: 1,
          token
        }),
        signal
      }).then(({ data, headers, request }) => {
        const response = camelizeKeys<Response>(JSON.parse(data))

        if ('error' in response && !isErrorResponse(response)) {
          throw new UploadClientError(
            response.error.content,
            undefined,
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
