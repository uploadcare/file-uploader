import type { ConfigController } from '../../abstract/controllers/ConfigController';
import type { Lifetime } from '../../abstract/di/Lifetime';

/** What a session and its parts do their async work under: both last one adoption of the camera block. */
export type CameraTasks = {
  /** Ends with the adoption, which stops every await guarded by it. */
  lifetime: Lifetime;
  /** Starts fire-and-forget work under `lifetime`: its abort is swallowed, any other failure is logged. */
  runTask: (task: () => unknown) => void;
};

/**
 * The config as the camera reads it. Each read says what it is: `getTracked` where a render must follow the value,
 * `get` for a value taken as an action happens, `observe` to react to a change.
 */
export type CameraConfig = Pick<ConfigController, 'get' | 'getTracked' | 'observe'>;

/** Reports a failure the camera recovers from: to the log at `level`, and to telemetry with `context`. */
export type CameraReport = (level: 'warn' | 'error', message: string, error: unknown, context: string) => void;
