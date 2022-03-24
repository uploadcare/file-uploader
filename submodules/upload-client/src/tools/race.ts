import { AbortController } from 'abort-controller'
import { onCancel } from './onCancel'

type Callback = () => void
type StrangeFn<T> = (args: {
  stopRace: Callback
  signal: AbortSignal
}) => Promise<T>

const race = <T>(
  fns: StrangeFn<T>[],
  { signal }: { signal?: AbortSignal } = {}
): Promise<T> => {
  let lastError: Error | null = null
  let winnerIndex: number | null = null
  const controllers = fns.map(() => new AbortController())
  const createStopRaceCallback = (i: number) => (): void => {
    winnerIndex = i

    controllers.forEach(
      (controller, index) => index !== i && controller.abort()
    )
  }

  onCancel(signal, () => {
    controllers.forEach((controller) => controller.abort())
  })

  return Promise.all(
    fns.map((fn, i) => {
      const stopRace = createStopRaceCallback(i)

      return Promise.resolve()
        .then(() => fn({ stopRace, signal: controllers[i].signal }))
        .then((result) => {
          stopRace()

          return result
        })
        .catch((error) => {
          lastError = error
          return null
        })
    })
  ).then((results) => {
    if (winnerIndex === null) {
      throw lastError
    } else {
      return results[winnerIndex] as T
    }
  })
}

export { race }
