/** The camera block's adoption-bound async helpers (see `ChildBlock`), lent to the parts that do its async work. */
export type CameraLifetime = {
  whileAdopted: <T>(work: PromiseLike<T>, dispose?: (value: T) => void) => Promise<T>;
  runTask: (task: () => unknown) => void;
  adoptionSignal: () => AbortSignal;
};

/** Reports a failure the camera recovers from: to the log at `level`, and to telemetry with `context`. */
export type CameraReport = (level: 'warn' | 'error', message: string, error: unknown, context: string) => void;
