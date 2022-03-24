import retrier from '../../src/tools/retry'

describe('retrier', () => {
  test('retry function should work with delay parameter', async () => {
    const a = await retrier(({ attempt, retry }) =>
      Promise.resolve().then(() => (attempt < 2 ? retry(10) : 10))
    )

    expect(a).toBe(10)
  })

  test('retry function should work without delay parameter', async () => {
    const a = await retrier(({ attempt, retry }) =>
      Promise.resolve().then(() => (attempt < 2 ? retry() : 10))
    )

    expect(a).toBe(10)
  })

  test('attempt parameter should be incremented after every execution', async () => {
    let i = 0
    const a = await retrier(({ attempt, retry }) =>
      Promise.resolve().then(() => {
        expect(attempt).toBe(i)
        i += 1

        return attempt < 2 ? retry() : 'result'
      })
    )

    expect(a).toBe('result')
  })

  test('retrier should throw errors', async () => {
    await expect(
      retrier(({ attempt, retry }) =>
        Promise.resolve().then(() => {
          if (attempt < 2) {
            return retry(10)
          } else {
            throw Error('hello error')
          }
        })
      )
    ).rejects.toThrowError('hello error')
  })
})
