import AbortController from 'abort-controller'
import { race } from '../../src/tools/race'
import { cancelError } from '../../src/tools/errors'
import { onCancel } from '../../src/tools/onCancel'

const returnAfter = (
  value: number,
  signal: AbortSignal,
  ms = 30
): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    const id = setTimeout(resolve, ms, value)
    onCancel(signal, () => {
      clearTimeout(id)
      reject(cancelError('race cancel'))
    })
  })

describe('race', () => {
  it('should work', async () => {
    const value = await race([
      ({ signal }): Promise<number> => returnAfter(1, signal),
      ({ signal }): Promise<number> => returnAfter(2, signal, 1),
      ({ signal }): Promise<number> => returnAfter(3, signal),
      ({ signal }): Promise<number> => returnAfter(4, signal),
      ({ signal }): Promise<number> => returnAfter(5, signal)
    ])

    expect(value).toBe(2)
  })

  it('should work if first function fails sync', async () => {
    const value = await race([
      (): Promise<number> => {
        throw new Error('test 1')
      },
      ({ signal }): Promise<number> => returnAfter(2, signal, 1),
      ({ signal }): Promise<number> => returnAfter(3, signal),
      ({ signal }): Promise<number> => returnAfter(4, signal),
      ({ signal }): Promise<number> => returnAfter(5, signal)
    ])

    expect(value).toBe(2)
  })

  it('should work if first function fails async', async () => {
    const value = await race([
      (): Promise<number> => Promise.reject('test 1'),
      ({ signal }): Promise<number> => returnAfter(2, signal, 1),
      ({ signal }): Promise<number> => returnAfter(3, signal),
      ({ signal }): Promise<number> => returnAfter(4, signal),
      ({ signal }): Promise<number> => returnAfter(5, signal)
    ])

    expect(value).toBe(2)
  })

  it('should throw error if all function fails', async () => {
    await expect(
      race([
        (): Promise<number> => Promise.reject(new Error('test 1')),
        (): Promise<number> => Promise.reject(new Error('test 2')),
        (): Promise<number> => Promise.reject(new Error('test 3')),
        (): Promise<number> => Promise.reject(new Error('test 4')),
        (): Promise<number> => Promise.reject(new Error('test 5'))
      ])
    ).rejects.toThrowError('test 5')
  })

  it('should cancel all functions when first resolves', async () => {
    const spies = Array.from({ length: 5 }, (i) =>
    jest.fn()
    )

    const createCancelHandler = (index: number) => (error): number => {
      spies[index]()

      throw error
    }

    const value = await race([
      ({ signal }): Promise<number> =>
        returnAfter(1, signal, 1).catch(createCancelHandler(0)),
      ({ signal }): Promise<number> =>
        returnAfter(2, signal).catch(createCancelHandler(1)),
      ({ signal }): Promise<number> =>
        returnAfter(3, signal).catch(createCancelHandler(2)),
      ({ signal }): Promise<number> =>
        returnAfter(4, signal).catch(createCancelHandler(3)),
      ({ signal }): Promise<number> =>
        returnAfter(5, signal).catch(createCancelHandler(4))
    ])

    expect(value).toBe(1)

    spies.forEach((spy, index) => {
      if (index !== 0) {
        expect(spy).toHaveBeenCalled()
      }
    })
  })

  it('should cancel all functions after calling stopRace', async () => {
    const spies = Array.from({ length: 5 }, (i) =>
    jest.fn()
    )

    const createCancelHandler = (index: number) => (error): number => {
      spies[index]()

      throw error
    }

    const value = await race([
      ({ stopRace }): Promise<number> => {
        stopRace()

        return Promise.resolve(1)
      },
      ({ signal }): Promise<number> =>
        returnAfter(2, signal).catch(createCancelHandler(1)),
      ({ signal }): Promise<number> =>
        returnAfter(3, signal).catch(createCancelHandler(2)),
      ({ signal }): Promise<number> =>
        returnAfter(4, signal).catch(createCancelHandler(3)),
      ({ signal }): Promise<number> =>
        returnAfter(5, signal).catch(createCancelHandler(4))
    ])

    expect(value).toBe(1)

    spies.forEach((spy, index) => {
      if (index !== 0) {
        expect(spy).toHaveBeenCalled()
      }
    })
  })

  it('should be cancellable', async () => {
    const controller = new AbortController()

    const spies = Array.from({ length: 5 }, (i) =>
    jest.fn()
    )

    const createCancelHandler = (index: number) => (error): number => {
      spies[index]()

      throw error
    }

    setTimeout(() => controller.abort())

    await expect(
      race(
        [
          ({ signal }): Promise<number> =>
            returnAfter(1, signal).catch(createCancelHandler(0)),
          ({ signal }): Promise<number> =>
            returnAfter(2, signal).catch(createCancelHandler(1)),
          ({ signal }): Promise<number> =>
            returnAfter(3, signal).catch(createCancelHandler(2)),
          ({ signal }): Promise<number> =>
            returnAfter(4, signal).catch(createCancelHandler(3)),
          ({ signal }): Promise<number> =>
            returnAfter(5, signal).catch(createCancelHandler(4))
        ],
        { signal: controller.signal }
      )
    ).rejects.toThrowError('race cancel')

    spies.forEach((spy) => {
      expect(spy).toHaveBeenCalled()
    })
  })
})
