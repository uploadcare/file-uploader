import fromUrlStatus, { Status } from '../api/fromUrlStatus'
import fromUrl, { TypeEnum, FromUrlOptions } from '../api/fromUrl'
import { UploadClientError, cancelError } from '../tools/errors'
import { poll } from '../tools/poll'
import { race } from '../tools/race'
import { isReadyPoll } from '../tools/isReadyPoll'
import defaultSettings from '../defaultSettings'
import { onCancel } from '../tools/onCancel'

import { getPusher, preconnect } from './pusher'

/* Types */
import { FileInfo } from '../api/types'
import { CustomUserAgent } from '../types'
import { UploadcareFile } from '../tools/UploadcareFile'
import { ProgressCallback } from '../api/types'

function pollStrategy({
  token,
  publicKey,
  baseURL,
  integration,
  userAgent,
  retryThrottledRequestMaxTimes,
  onProgress,
  signal
}: {
  token: string
  publicKey: string
  baseURL?: string
  integration?: string
  userAgent?: CustomUserAgent
  retryThrottledRequestMaxTimes?: number
  onProgress?: ProgressCallback
  signal?: AbortSignal
}): Promise<FileInfo | UploadClientError> {
  return poll<FileInfo | UploadClientError>({
    check: (signal) =>
      fromUrlStatus(token, {
        publicKey,
        baseURL,
        integration,
        userAgent,
        retryThrottledRequestMaxTimes,
        signal
      }).then((response) => {
        switch (response.status) {
          case Status.Error: {
            return new UploadClientError(response.error, response.errorCode)
          }
          case Status.Waiting: {
            return false
          }
          case Status.Unknown: {
            return new UploadClientError(`Token "${token}" was not found.`)
          }
          case Status.Progress: {
            if (onProgress) {
              if (response.total === 'unknown') {
                onProgress({ isComputable: false })
              } else {
                onProgress({
                  isComputable: true,
                  value: response.done / response.total
                })
              }
            }
            return false
          }
          case Status.Success: {
            if (onProgress)
              onProgress({
                isComputable: true,
                value: response.done / response.total
              })
            return response
          }
          default: {
            throw new Error('Unknown status')
          }
        }
      }),
    signal
  })
}

type UploadFromUrlOptions = {
  baseCDN?: string
  onProgress?: ProgressCallback
  pusherKey?: string
} & FromUrlOptions

const pushStrategy = ({
  token,
  pusherKey,
  signal,
  onProgress
}: {
  token: string
  pusherKey: string
  signal: AbortSignal
  onProgress?: ProgressCallback
}): Promise<FileInfo | UploadClientError> =>
  new Promise((resolve, reject) => {
    const pusher = getPusher(pusherKey)
    const unsubErrorHandler = pusher.onError(reject)
    const destroy = (): void => {
      unsubErrorHandler()
      pusher.unsubscribe(token)
    }

    onCancel(signal, () => {
      destroy()
      reject(cancelError('pusher cancelled'))
    })

    pusher.subscribe(token, (result) => {
      switch (result.status) {
        case Status.Progress: {
          if (onProgress) {
            if (result.total === 'unknown') {
              onProgress({ isComputable: false })
            } else {
              onProgress({
                isComputable: true,
                value: result.done / result.total
              })
            }
          }
          break
        }

        case Status.Success: {
          destroy()
          if (onProgress)
            onProgress({
              isComputable: true,
              value: result.done / result.total
            })
          resolve(result)
          break
        }

        case Status.Error: {
          destroy()
          reject(new UploadClientError(result.msg, result.error_code))
        }
      }
    })
  })

const uploadFromUrl = (
  sourceUrl: string,
  {
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
    pusherKey = defaultSettings.pusherKey
  }: UploadFromUrlOptions
): Promise<UploadcareFile> =>
  Promise.resolve(preconnect(pusherKey))
    .then(() =>
      fromUrl(sourceUrl, {
        publicKey,
        fileName,
        baseURL,
        checkForUrlDuplicates,
        saveUrlForRecurrentUploads,
        secureSignature,
        secureExpire,
        store,
        signal,
        source,
        integration,
        userAgent,
        retryThrottledRequestMaxTimes
      })
    )
    .catch((error) => {
      const pusher = getPusher(pusherKey)
      pusher?.disconnect()
      return Promise.reject(error)
    })
    .then((urlResponse) => {
      if (urlResponse.type === TypeEnum.FileInfo) {
        return urlResponse
      } else {
        return race<FileInfo | UploadClientError>(
          [
            ({ signal }): Promise<FileInfo | UploadClientError> =>
              pollStrategy({
                token: urlResponse.token,
                publicKey,
                baseURL,
                integration,
                userAgent,
                retryThrottledRequestMaxTimes,
                onProgress,
                signal
              }),
            ({ signal }): Promise<FileInfo | UploadClientError> =>
              pushStrategy({
                token: urlResponse.token,
                pusherKey,
                signal,
                onProgress
              })
          ],
          { signal }
        )
      }
    })
    .then((result) => {
      if (result instanceof UploadClientError) throw result

      return result
    })
    .then((result) =>
      isReadyPoll({
        file: result.uuid,
        publicKey,
        baseURL,
        integration,
        userAgent,
        retryThrottledRequestMaxTimes,
        onProgress,
        signal
      })
    )
    .then((fileInfo) => new UploadcareFile(fileInfo, { baseCDN }))

export default uploadFromUrl
