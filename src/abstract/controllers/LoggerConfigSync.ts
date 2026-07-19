import { inject } from '../di/inject';
import { DEFAULT_LEVEL, type LogLevel, logger, maxLevel } from '../logger';
import { ConfigController } from './ConfigController';

/**
 * The middle layer connecting the app's per-ctx `debug` config to the abstract,
 * config-agnostic {@link logger}. This is the ONLY module that imports both — the
 * logger never depends on `ConfigController`, and `ConfigController` never
 * depends on the logger.
 *
 * One instance exists per ctx (container-resolved, eagerly created in
 * `UploaderRegistry.ensure`). Its `init()` subscribes to the ctx's config and
 * maps the `debug` option to a {@link LogLevel} (`debug: true` → `'debug'`, else
 * the default `'warn'`), and its `destroy()` (run on container disposal) removes
 * this ctx's contribution.
 *
 * The logger's verbosity is a single global switch, but config is per-ctx, so
 * this layer aggregates: the logger runs at the **noisiest** level any live ctx
 * asks for (so one uploader enabling `debug` turns debug on globally — the
 * accepted, documented trade-off for a dev-only diagnostic flag). All that
 * multi-ctx bookkeeping lives here, invisible to callers, who just call
 * `logger.warn(...)` / `logger.debug(...)`.
 */

/** Each live sync instance's requested level; the logger runs at their max. */
const sources = new Map<LoggerConfigSync, LogLevel>();

const recompute = (): void => {
  let level: LogLevel = DEFAULT_LEVEL;
  for (const requested of sources.values()) {
    level = maxLevel(level, requested);
  }
  logger.configure({ level });
};

export class LoggerConfigSync {
  @inject(ConfigController) private readonly _config!: ConfigController;
  #unsubscribe?: () => void;

  public init(): void {
    this.#apply();
    this.#unsubscribe = this._config.subscribe(() => this.#apply());
  }

  #apply(): void {
    sources.set(this, this._config.get('debug') ? 'debug' : DEFAULT_LEVEL);
    recompute();
  }

  public destroy(): void {
    this.#unsubscribe?.();
    sources.delete(this);
    recompute();
  }
}
