/* eslint-disable @typescript-eslint/explicit-function-return-type */
import retryIfThrottled from '../../src/tools/retryIfThrottled'
import { UploadClientError } from '../../src/tools/errors'

const createRunner = ({
  attempts = 10,
  error,
  resolve = 0
}: { attempts?: number; error?: Error; resolve?: number } = {}) => {
  let runs = 0
  const spy = jest.fn()

  const task = () =>
    Promise.resolve().then(() => {
      ++runs

      spy()

      if (runs <= attempts) {
        throw error
          ? error
          : new UploadClientError(
              'test error',
              'RequestThrottledError',
              undefined,
              {
                error: {
                  statusCode: 429,
                  content: 'test',
                  errorCode: 'RequestThrottledError'
                }
              },
              { 'x-throttle-wait-seconds': '1' }
            )
      }

      return resolve
    })

  return { spy, task }
}

describe('retryIfThrottled', () => {
  it('should work', async () => {
    const { spy, task } = createRunner({ attempts: 1 })

    await expect(retryIfThrottled<number>(task, 10)).resolves.toBe(0)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('should rejected with error if no Throttled', async () => {
    const error = new Error()
    const { spy, task } = createRunner({ error })

    await expect(retryIfThrottled<number>(task, 2)).rejects.toThrowError(error)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should rejected with UploadClientError if MaxTimes = 0', async () => {
    const { spy, task } = createRunner()

    await expect(retryIfThrottled<number>(task, 0)).rejects.toThrowError(
      UploadClientError
    )
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should resolve if task resolve', async () => {
    const { spy, task } = createRunner({ attempts: 3, resolve: 100 })

    await expect(retryIfThrottled<number>(task, 10)).resolves.toBe(100)
    expect(spy).toHaveBeenCalledTimes(4)
  })

  it('should resolve without errors if task resolve', async () => {
    const { spy, task } = createRunner({ attempts: 0 })

    await expect(retryIfThrottled<number>(task, 10)).resolves.toBe(0)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
