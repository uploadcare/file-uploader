import { cancelError } from './errors'
import { onCancel } from '../tools/onCancel'

type CheckFunction<T> = (signal?: AbortSignal) => Promise<false | T> | false | T

const DEFAULT_INTERVAL = 500

const poll = <T>({
  check,
  interval = DEFAULT_INTERVAL,
  signal
}: {
  check: CheckFunction<T>
  timeout?: number
  interval?: number
  signal?: AbortSignal
}): Promise<T> =>
  new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout

    onCancel(signal, () => {
      timeoutId && clearTimeout(timeoutId)
      reject(cancelError('Poll cancelled'))
    })

    const tick = (): void => {
      try {
        Promise.resolve(check(signal))
          .then((result) => {
            if (result) {
              resolve(result)
            } else {
              timeoutId = setTimeout(tick, interval)
            }
          })
          .catch((error) => reject(error))
      } catch (error) {
        reject(error)
      }
    }

    timeoutId = setTimeout(tick, 0)
  })

export { poll, CheckFunction }
