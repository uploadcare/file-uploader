/**
 * Centralized, DOM-free, container-free logger for the whole codebase.
 *
 * It knows nothing about the uploader's config, the DI container, or Lit — so
 * container-less primitives (`EventBus`, `Listeners`, `Disposables`,
 * `UploaderRegistry`, utils) and DOM-free controllers can all `import { logger }`
 * and just call a method. The logger itself decides whether to print, based on a
 * single configurable verbosity {@link LogLevel}.
 *
 * The verbosity is wired to the per-ctx `debug` config option by a separate
 * middle layer (`logger-config-sync.ts`), so this module never depends on
 * `ConfigController`. By default only `error`/`warn`/`warnOnce` print; `log` and
 * `debug` are silent until verbosity is raised (what `<uc-config debug>` does).
 */

/** Verbosity, ordered least→most noisy. A method prints iff `level >= its tier`. */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const SEVERITY: Record<LogLevel, number> = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

/** Errors + isolate-and-warn diagnostics print; `log`/`debug` are gated off. */
export const DEFAULT_LEVEL: LogLevel = 'warn';

/** The noisier of two levels — the config→logger sync uses it to aggregate across ctxs. */
export const maxLevel = (a: LogLevel, b: LogLevel): LogLevel => (SEVERITY[a] >= SEVERITY[b] ? a : b);

/**
 * `log`/`debug` accept either plain args or a single `() => unknown[]` thunk, so
 * an expensive message isn't built when the level gates it out.
 */
type LazyArgs = [() => unknown[]];

export interface ScopedLogger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  warnOnce(message: string): void;
  log(...args: unknown[] | LazyArgs): void;
  debug(...args: unknown[] | LazyArgs): void;
}

export interface Logger extends ScopedLogger {
  /** Set the verbosity. Called only by the config→logger middle layer. */
  configure(options: { level: LogLevel }): void;
  /** Current verbosity (mainly for the sync layer / tests). */
  readonly level: LogLevel;
  /** A logger whose output is prefixed `[uc][name]` — optional source tagging. */
  scope(name: string): ScopedLogger;
}

let currentLevel: LogLevel = DEFAULT_LEVEL;
const warnedOnce = new Set<string>();

const enabled = (tier: LogLevel): boolean => SEVERITY[currentLevel] >= SEVERITY[tier];

const resolveArgs = (args: unknown[] | LazyArgs): unknown[] =>
  args.length === 1 && typeof args[0] === 'function' ? (args[0] as () => unknown[])() : (args as unknown[]);

/** Build the method set for a given prefix (`[uc]` or `[uc][scope]`). */
const makeScoped = (prefix: string): ScopedLogger => ({
  error(...args: unknown[]): void {
    if (enabled('error')) console.error(prefix, ...args);
  },
  warn(...args: unknown[]): void {
    if (enabled('warn')) console.warn(prefix, ...args);
  },
  warnOnce(message: string): void {
    // Dedupe by message (byte-for-byte with the old `warnOnce` util), so the
    // same warning from repeated calls prints once per process.
    if (!enabled('warn') || warnedOnce.has(message)) return;
    warnedOnce.add(message);
    console.warn(prefix, message);
  },
  log(...args: unknown[] | LazyArgs): void {
    if (enabled('info')) console.log(prefix, ...resolveArgs(args));
  },
  // Uses `console.log`, not `console.debug`: `console.debug` maps to DevTools'
  // "Verbose" level, which is hidden by default — so `<uc-config debug>` output
  // (the old `createDebugPrinter` used `console.log`) would appear to vanish.
  debug(...args: unknown[] | LazyArgs): void {
    if (enabled('debug')) console.log(prefix, ...resolveArgs(args));
  },
});

const root = makeScoped('[uc]');

export const logger: Logger = {
  ...root,
  configure({ level }: { level: LogLevel }): void {
    currentLevel = level;
  },
  get level(): LogLevel {
    return currentLevel;
  },
  scope(name: string): ScopedLogger {
    return makeScoped(`[uc][${name}]`);
  },
};

/** Test-only: reset verbosity + the `warnOnce` dedupe set between cases. */
export const __resetLoggerForTests = (): void => {
  currentLevel = DEFAULT_LEVEL;
  warnedOnce.clear();
};
