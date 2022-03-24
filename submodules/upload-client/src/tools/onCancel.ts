export const onCancel = (
  signal: AbortSignal | undefined,
  callback: () => void
): void => {
  if (signal) {
    if (signal.aborted) {
      Promise.resolve().then(callback)
    } else {
      signal.addEventListener('abort', () => callback(), { once: true })
    }
  }
}
