/**
 * Centralized, DOM-free, container-free logger for the whole codebase.
 *
 * Two tiers:
 * - **Always-on** (`error` / `warn` / `warnOnce`) — print unconditionally.
 * - **Gated / verbose** (`log` / `debug` and the pretty helpers `table` / `group`
 *   / `dir`) — print only when the scoped logger's `isVerbose()` predicate is
 *   true. The base `logger` is never verbose, so a bare `logger.debug(...)` is a
 *   no-op; verbose output comes from a scoped logger.
 *
 * Every log line is prefixed `[uc]`, then the **ctx-name** when the scope can
 * resolve one (so multi-uploader output is attributable to its uploader), then
 * the **scope** — e.g. `[uc][my-uploader][secure-uploads]`, or `[uc][event-bus]`
 * for a container-less scope with no ctx. Both `isVerbose` and `ctxName` are
 * caller-supplied lazy resolvers read at log time, so the logger stays
 * config-agnostic and per-ctx accurate.
 *
 * Do NOT call the log methods inline on `logger.scope(...)`. Create ONE scoped
 * logger per file/class at the top and reuse it (enforced by the `no-restricted-syntax`
 * lint rule): `const log = logger.scope('my-scope');` then `log.warn(...)`.
 */

/** `log`/`debug` accept plain args OR a single `() => unknown[]` thunk (not built when gated off). */
export type LazyArgs = [() => unknown[]];

/** Options for a scoped logger. Both resolvers are read lazily, at log time. */
export interface ScopeOptions {
  /** Verbose gate: `log`/`debug`/pretty helpers print only when this returns true. */
  isVerbose?: () => boolean;
  /** Resolves the current ctx-name for the prefix; omit for ctx-less scopes. */
  ctxName?: () => string | undefined;
}

export interface Logger {
  /** Always-on. */
  error(...args: unknown[]): void;
  /** Always-on. */
  warn(...args: unknown[]): void;
  /** Always-on; dedupes by message across the process. */
  warnOnce(message: string): void;
  /** Verbose. No-op unless this scope's `isVerbose()` is true. */
  log(...args: unknown[] | LazyArgs): void;
  /** Verbose. No-op unless this scope's `isVerbose()` is true. */
  debug(...args: unknown[] | LazyArgs): void;
  /** Verbose pretty helper: a labelled `console.table` for structured/tabular data. */
  table(label: string, data: unknown, columns?: readonly string[]): void;
  /**
   * Verbose pretty helper: open a `console.group` and return a closer. The closer
   * closes the group iff this call opened one (captured at open time) and is
   * idempotent — so a verbosity flip (or ctx teardown) between open and close can
   * never leave a dangling group or fire an unmatched `groupEnd`. Use with
   * try/finally: `const end = log.group('x'); try { … } finally { end(); }`.
   */
  group(label: string): () => void;
  /** Verbose pretty helper: `console.dir` for deep object inspection. */
  dir(obj: unknown): void;
  /** A child scope. Prefer one per file/class at the top; do not chain a log call on the result. */
  scope(name: string, options?: ScopeOptions): Logger;
}

const warnedOnce = new Set<string>();

// Per-segment DevTools badges for the verbose (dev-only) stream: `uc`, the
// ctx-name, and the scope each get a distinct background so the three are visually
// separable. No-op styling in non-browser consoles (the `%c` + style args are
// simply ignored there). Exported so tests can pin the exact styles.
const CHIP = 'color:#fff;padding:1px 5px;border-radius:2px;margin-right:1px;font-weight:600';
export const UC_BADGE_STYLE = `background:#7048e8;${CHIP}`; // purple — `uc`
export const CTX_BADGE_STYLE = `background:#0ca678;${CHIP}`; // teal — ctx-name
export const SCOPE_BADGE_STYLE = `background:#495057;${CHIP}`; // slate — scope

const resolveArgs = (args: unknown[] | LazyArgs): unknown[] =>
  args.length === 1 && typeof args[0] === 'function' ? (args[0] as () => unknown[])() : (args as unknown[]);

const create = (scopeName: string, isVerbose: () => boolean, getCtxName?: () => string | undefined): Logger => {
  // Always-on plain prefix, e.g. `[uc][my-uploader][scope]` — greppable, and
  // DevTools already colors warn/error by level. ctxName is resolved per call.
  const plainPrefix = (): string => {
    const parts = ['uc'];
    const ctx = getCtxName?.();
    if (ctx) parts.push(ctx);
    if (scopeName) parts.push(scopeName);
    return parts.map((p) => `[${p}]`).join('');
  };
  // Verbose styled prefix: returns `[format, ...styleArgs]` to spread into a
  // console call — one `%c` chip per present segment, then a reset so the
  // following user args aren't styled.
  const styledPrefix = (): unknown[] => {
    const chips = ['%c uc '];
    const styles: string[] = [UC_BADGE_STYLE];
    const ctx = getCtxName?.();
    if (ctx) {
      chips.push(`%c ${ctx} `);
      styles.push(CTX_BADGE_STYLE);
    }
    if (scopeName) {
      chips.push(`%c ${scopeName} `);
      styles.push(SCOPE_BADGE_STYLE);
    }
    return [`${chips.join('')}%c`, ...styles, ''];
  };
  return {
    error(...args: unknown[]): void {
      console.error(plainPrefix(), ...args);
    },
    warn(...args: unknown[]): void {
      console.warn(plainPrefix(), ...args);
    },
    warnOnce(message: string): void {
      if (warnedOnce.has(message)) return;
      warnedOnce.add(message);
      console.warn(plainPrefix(), message);
    },
    log(...args: unknown[] | LazyArgs): void {
      if (isVerbose()) console.log(...styledPrefix(), ...resolveArgs(args));
    },
    debug(...args: unknown[] | LazyArgs): void {
      if (isVerbose()) console.log(...styledPrefix(), ...resolveArgs(args));
    },
    table(labelText: string, data: unknown, columns?: readonly string[]): void {
      if (!isVerbose()) return;
      console.log(...styledPrefix(), labelText);
      columns ? console.table(data, columns as string[]) : console.table(data);
    },
    group(labelText: string): () => void {
      if (!isVerbose()) return () => {};
      console.group(...styledPrefix(), labelText);
      let closed = false;
      return () => {
        if (closed) return;
        closed = true;
        console.groupEnd();
      };
    },
    dir(obj: unknown): void {
      if (!isVerbose()) return;
      console.log(...styledPrefix());
      console.dir(obj);
    },
    scope(name: string, options?: ScopeOptions): Logger {
      // A child inherits the parent's resolvers unless it overrides them.
      return create(name, options?.isVerbose ?? isVerbose, options?.ctxName ?? getCtxName);
    },
  };
};

/** The base logger: always-on tiers print; the verbose tier is a no-op (never verbose). */
export const logger: Logger = create('', () => false);

/** Test-only: reset the `warnOnce` dedupe set between cases. */
export const __resetLoggerForTests = (): void => {
  warnedOnce.clear();
};
