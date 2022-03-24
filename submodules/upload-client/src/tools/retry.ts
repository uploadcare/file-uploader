import { delay } from './delay'

type Args<T> = {
  attempt: number
  retry: (delayMs?: number) => Promise<T>
}

type Options = {
  factor: number
  time: number
}

type Creator<T> = (args: Args<T>) => Promise<T>

const defaultOptions = {
  factor: 2,
  time: 100
}

function retrier<T>(
  fn: Creator<T>,
  options: Options = defaultOptions
): Promise<T> {
  let attempts = 0

  function runAttempt(fn: Creator<T>): Promise<T> {
    const defaultDelayTime = Math.round(
      options.time * options.factor ** attempts
    )

    const retry = (ms?: number): Promise<T> =>
      delay(ms ?? defaultDelayTime).then(() => {
        attempts += 1
        return runAttempt(fn)
      })

    return fn({
      attempt: attempts,
      retry
    })
  }

  return runAttempt(fn)
}

export default retrier
