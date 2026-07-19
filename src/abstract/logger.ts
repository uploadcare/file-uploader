/**
 * Centralized, DOM-free, container-free logger for the whole codebase.
 *
 * Two tiers:
 * - **Always-on** (`error` / `warn` / `warnOnce`) — print unconditionally, with a
 *   plain `[uc]` / `[uc][scope]` prefix (greppable). Usable by container-less
 *   primitives (`EventBus`, `Listeners`, `Disposables`, utils) via the bare
 *   `logger`, since they need no ctx.
 * - **Gated** (`log` / `debug` and the pretty helpers `table` / `group` /
 *   `groupEnd` / `dir`) — print only when the scoped logger is enabled. The base
 *   `logger` is never enabled, so a bare `logger.debug(...)` is a no-op; gated
 *   output comes from a **ctx-scoped** logger created via
 *   `logger.scope(name, { isEnabled })`.
 *
 * The logger stays config-agnostic: gating is a caller-supplied
 * `isEnabled: () => boolean` predicate, NOT a `ConfigController`. Each per-ctx
 * caller binds it to its OWN config's `debug` flag (see `ChildBlock._log` and the
 * upload/plugin controllers), so debug output is per-ctx accurate — one uploader
 * enabling `debug` never turns on another's, and lines carry that ctx's scope.
 */

/** `log`/`debug` accept plain args OR a single `() => unknown[]` thunk (not built when gated off). */
export type LazyArgs = [() => unknown[]];

export interface Logger {
  /** Always-on. */
  error(...args: unknown[]): void;
  /** Always-on. */
  warn(...args: unknown[]): void;
  /** Always-on; dedupes by message across the process. */
  warnOnce(message: string): void;
  /** Gated (info). No-op unless this scoped logger is enabled. */
  log(...args: unknown[] | LazyArgs): void;
  /** Gated (verbose). No-op unless this scoped logger is enabled. */
  debug(...args: unknown[] | LazyArgs): void;
  /** Gated pretty helper: a labelled `console.table` for structured/tabular data. */
  table(label: string, data: unknown, columns?: readonly string[]): void;
  /** Gated pretty helper: open a `console.group` (pair with `groupEnd`). */
  group(label: string): void;
  /** Gated pretty helper: close the current group. */
  groupEnd(): void;
  /** Gated pretty helper: `console.dir` for deep object inspection. */
  dir(obj: unknown): void;
  /** A child logger prefixed `[uc][scope]`; pass `isEnabled` to gate its verbose tier. */
  scope(name: string, options?: { isEnabled?: () => boolean }): Logger;
}

const warnedOnce = new Set<string>();

// A subtle DevTools badge for the gated (dev-only) stream. No-op styling in
// non-browser consoles (the `%c` + style arg is simply ignored there).
const BADGE_STYLE = 'background:#7048e8;color:#fff;padding:1px 5px;border-radius:3px;font-weight:600';

const resolveArgs = (args: unknown[] | LazyArgs): unknown[] =>
  args.length === 1 && typeof args[0] === 'function' ? (args[0] as () => unknown[])() : (args as unknown[]);

const create = (label: string, isEnabled: () => boolean): Logger => {
  const plain = label ? `[uc][${label}]` : '[uc]';
  const badge = label ? `%c[uc][${label}]` : '%c[uc]';
  return {
    error(...args: unknown[]): void {
      console.error(plain, ...args);
    },
    warn(...args: unknown[]): void {
      console.warn(plain, ...args);
    },
    warnOnce(message: string): void {
      if (warnedOnce.has(message)) return;
      warnedOnce.add(message);
      console.warn(plain, message);
    },
    log(...args: unknown[] | LazyArgs): void {
      if (isEnabled()) console.log(badge, BADGE_STYLE, ...resolveArgs(args));
    },
    debug(...args: unknown[] | LazyArgs): void {
      if (isEnabled()) console.log(badge, BADGE_STYLE, ...resolveArgs(args));
    },
    table(labelText: string, data: unknown, columns?: readonly string[]): void {
      if (!isEnabled()) return;
      console.log(badge, BADGE_STYLE, labelText);
      // `columns` narrows which object keys are shown, when supported.
      columns ? console.table(data, columns as string[]) : console.table(data);
    },
    group(labelText: string): void {
      if (isEnabled()) console.group(badge, BADGE_STYLE, labelText);
    },
    groupEnd(): void {
      if (isEnabled()) console.groupEnd();
    },
    dir(obj: unknown): void {
      if (!isEnabled()) return;
      console.log(badge, BADGE_STYLE);
      console.dir(obj);
    },
    scope(name: string, options?: { isEnabled?: () => boolean }): Logger {
      const childLabel = label ? `${label}][${name}` : name;
      // A child without its own predicate inherits the parent's gate.
      return create(childLabel, options?.isEnabled ?? isEnabled);
    },
  };
};

/** The base logger: always-on tiers print; the gated tier is a no-op (never enabled). */
export const logger: Logger = create('', () => false);

/** Test-only: reset the `warnOnce` dedupe set between cases. */
export const __resetLoggerForTests = (): void => {
  warnedOnce.clear();
};
