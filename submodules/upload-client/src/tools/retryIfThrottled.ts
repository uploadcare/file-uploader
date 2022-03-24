import { UploadClientError } from './errors'
import retrier from './retry'

const REQUEST_WAS_THROTTLED_CODE = 'RequestThrottledError'
const DEFAULT_RETRY_AFTER_TIMEOUT = 15000

function getTimeoutFromThrottledRequest(error: UploadClientError): number {
  const { headers } = error || {}

  return (
    (headers &&
      Number.parseInt(headers['x-throttle-wait-seconds'] as string) * 1000) ||
    DEFAULT_RETRY_AFTER_TIMEOUT
  )
}

function retryIfThrottled<T>(
  fn: () => Promise<T>,
  retryThrottledMaxTimes: number
): Promise<T> {
  return retrier(({ attempt, retry }) =>
    fn().catch((error: Error | UploadClientError) => {
      if (
        'response' in error &&
        error?.code === REQUEST_WAS_THROTTLED_CODE &&
        attempt < retryThrottledMaxTimes
      ) {
        return retry(getTimeoutFromThrottledRequest(error))
      }

      throw error
    })
  )
}

export default retryIfThrottled
