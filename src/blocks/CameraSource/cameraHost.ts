import type { ConfigController } from '../../abstract/controllers/ConfigController';

/** The camera block's adoption-bound async helpers (see `ChildBlock`), lent to the parts that do its async work. */
export type CameraLifetime = {
  whileAdopted: <T>(work: PromiseLike<T>, dispose?: (value: T) => void) => Promise<T>;
  runTask: (task: () => unknown) => void;
  adoptionSignal: () => AbortSignal;
};

/**
 * The config as the camera reads it. Each read says what it is: `getTracked` where a render must follow the value,
 * `get` for a value taken as an action happens, `observe` to react to a change.
 */
export type CameraConfig = Pick<ConfigController, 'get' | 'getTracked' | 'observe'>;

/** Reports a failure the camera recovers from: to the log at `level`, and to telemetry with `context`. */
export type CameraReport = (level: 'warn' | 'error', message: string, error: unknown, context: string) => void;
