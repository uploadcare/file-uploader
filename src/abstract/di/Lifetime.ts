/** Whether `error` is the abort a {@link Lifetime} raises (or any other `AbortError`). */
export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

/**
 * The span during which an owner (a block between adoption and release) may still act. Async work started inside it
 * stops at its next {@link guard}ed await once the lifetime ends, instead of carrying on against torn-down state — so
 * the work itself does not need null checks or `isConnected` guards after every await.
 *
 * DOM-free: an owner creates one per lifetime and calls {@link end} when it is over.
 */
export class Lifetime {
  readonly #controller = new AbortController();

  /** A lifetime that has already ended — the state of an owner that is not (or no longer) live. */
  public static ended(): Lifetime {
    const lifetime = new Lifetime();
    lifetime.end();
    return lifetime;
  }

  /** Aborted once the lifetime ends. Pass it to APIs that take one (`fetch`, `addEventListener`, upload-client). */
  public get signal(): AbortSignal {
    return this.#controller.signal;
  }

  public end(): void {
    this.#controller.abort(new DOMException('The owner of this work is gone', 'AbortError'));
  }

  /**
   * Await `work`, but abort if the lifetime ended before it settled. A value that arrives too late is handed to
   * `dispose` (stop a stream, close a handle) since nobody is left to release it; a late rejection is reported as the
   * abort rather than as its own error.
   */
  public async guard<T>(work: PromiseLike<T>, dispose?: (value: T) => void): Promise<T> {
    const signal = this.signal;
    let value: T;
    try {
      value = await work;
    } catch (error) {
      throw signal.aborted ? signal.reason : error;
    }
    if (signal.aborted) {
      dispose?.(value);
      throw signal.reason;
    }
    return value;
  }

  /**
   * Start fire-and-forget async work, synchronously up to its first await. The abort raised by a {@link guard}ed
   * await once the lifetime ends is expected and swallowed; any other error goes to `onError`, so a failure is still
   * reported rather than lost.
   */
  public run(task: (signal: AbortSignal) => unknown, onError: (error: unknown) => void): void {
    let result: unknown;
    try {
      result = task(this.signal);
    } catch (error) {
      result = Promise.reject(error);
    }
    Promise.resolve(result).then(undefined, (error: unknown) => {
      if (!isAbortError(error)) {
        onError(error);
      }
    });
  }
}
