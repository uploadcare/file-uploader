/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { delay } from '../../src/tools/delay'
import runWithConcurrency from '../../src/tools/runWithConcurrency'

const returnAfter = (value: number, ms = 10): (() => Promise<number>) => () =>
  delay(ms).then(() => value)

const rejectAfter = (error: Error, ms = 10): (() => Promise<never>) => () =>
  delay(ms).then(() => Promise.reject(error))

describe('runWithConcurrency', () => {
  it('should work', async () => {
    await expect(
      runWithConcurrency(1, [returnAfter(1), returnAfter(2), returnAfter(3)])
    ).resolves.toStrictEqual([1, 2, 3])
  })

  it('should work with big concurrency', async () => {
    await expect(
      runWithConcurrency(20, [returnAfter(1), returnAfter(2), returnAfter(3)])
    ).resolves.toStrictEqual([1, 2, 3])
  })

  it('should return arrat with rigth order', async () => {
    await expect(
      runWithConcurrency(2, [
        returnAfter(1, 100),
        returnAfter(2),
        returnAfter(3),
        returnAfter(4, 100),
        returnAfter(5),
        returnAfter(6)
      ])
    ).resolves.toStrictEqual([1, 2, 3, 4, 5, 6])
  })

  it('should reject if any task fails', async () => {
    const error = new Error('test')
    await expect(
      runWithConcurrency(2, [
        returnAfter(1),
        rejectAfter(error),
        returnAfter(3)
      ])
    ).rejects.toThrowError(error)
  })

  it('should not run task after reject', async () => {
    const error = new Error('test')

    const spy = jest.fn()

    await expect(
      runWithConcurrency(2, [returnAfter(1), rejectAfter(error, 0), spy])
    ).rejects.toThrowError(error)

    await delay(20)

    expect(spy).not.toHaveBeenCalled()
  })

  it('should run task with right concurrency', async () => {
    let maxConcurrency = 0
    let running = 0

    const trackedTask = () =>
      Promise.resolve()
        .then(() => (running += 1))
        .then(() => delay(10))
        .then(() => {
          maxConcurrency = Math.max(maxConcurrency, running)
          running -= 1
          return 1
        })

    await expect(
      runWithConcurrency(3, [
        trackedTask,
        trackedTask,
        trackedTask,
        trackedTask,
        trackedTask,
        trackedTask,
        trackedTask
      ])
    ).resolves.toStrictEqual([1, 1, 1, 1, 1, 1, 1])

    expect(maxConcurrency).toBe(3)
  })
})
