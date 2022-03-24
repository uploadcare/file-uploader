type EmptyCallback = () => void
type Callback<T> = (data: T) => void
type ListenerStore<T extends Record<string, unknown>> = {
  [U in keyof T]: ((data: T[U]) => void)[]
}

class Events<T extends Record<string, unknown>> {
  events: ListenerStore<T> = Object.create({})

  emit<U extends keyof T>(event: U, data: T[U]): void {
    this.events[event]?.forEach((fn) => fn(data))
  }

  on<U extends keyof T>(event: U, callback: Callback<T[U]>): void {
    this.events[event] = this.events[event] || []
    this.events[event].push(callback)
  }

  off<U extends keyof T>(
    event: U,
    callback?: Callback<T[U]> | EmptyCallback
  ): void {
    if (callback) {
      this.events[event] = this.events[event].filter((fn) => fn !== callback)
    } else {
      this.events[event] = []
    }
  }
}

export { Events }
