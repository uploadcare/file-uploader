import { type Logger, logger } from '../logger';

const defaultLog = logger.scope('disposables');

/**
 * A tiny composable teardown registry. Controllers `add()` their teardown
 * closures at each closure's creation site and call `run()` from `destroy()`,
 * instead of hand-rolling a `Set<() => void>` + a try/catch loop per controller.
 *
 * Has-a, not is-a: this codebase DRYs cross-cutting behavior via composition
 * (e.g. `SignalMap` composes `Listeners`), so `Disposables` is held as a private
 * field rather than mixed in. It covers ONLY teardown-closure running — a
 * controller's own state clearing (map/set `.clear()`, timeout clears, flag
 * sets, child `.destroy()` loops) stays in its `destroy()`.
 *
 * A host that owns a scoped logger (e.g. a `ChildBlock` whose `_log` carries its
 * tag + ctx-name) can pass a `getLog` thunk so the isolate-and-warn message
 * keeps that context instead of the generic `disposables` scope. The thunk is
 * resolved lazily at `run()` time, so a host may pass `() => this._log` from a
 * field initializer before `_log` itself is assigned.
 */
export class Disposables {
  #fns = new Set<() => void>();
  #getLog: () => Logger;

  public constructor(getLog: () => Logger = () => defaultLog) {
    this.#getLog = getLog;
  }

  /** Register a teardown fn; returns a canceller that unregisters it (without running it). */
  public add(fn: () => void): () => void {
    this.#fns.add(fn);
    return () => {
      this.#fns.delete(fn);
    };
  }

  /**
   * Run all registered teardowns, then clear the registry. Fan-out is
   * isolate-and-warn (AGENTS.md #3): a throwing teardown is caught and logged so
   * the remaining teardowns still run.
   */
  public run(): void {
    for (const fn of this.#fns) {
      try {
        fn();
      } catch (err) {
        this.#getLog().warn('Disposables: a teardown threw', err);
      }
    }
    this.#fns.clear();
  }

  public get size(): number {
    return this.#fns.size;
  }
}
