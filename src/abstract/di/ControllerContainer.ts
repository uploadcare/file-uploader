/**
 * DOM-free dependency-injection container for the v2 controller layer.
 *
 * One container exists per `ctx-name`. It lazily constructs controllers with
 * zero-arg constructors, tags each instance so `@inject` fields can resolve
 * their dependencies on access, caches the singleton, and finally runs an
 * optional `init()`. Teardown happens in reverse insertion order.
 *
 * Controllers must NOT import `lit` or touch the DOM — host/boundary values
 * (the upload-client SDK, DOM callbacks, …) enter only through `bind()`.
 */

import { logger } from '../logger';

const log = logger.scope('controller-container');

// A token constructor. Unbound tokens are built by the container with a
// zero-arg `new Ctrl()`; a token whose value isn't a zero-arg-constructible
// class (e.g. `PluginManagerBridge`, a `declare`-only token whose value is built
// by a bound factory) MUST be `bind()`-ed with a factory, so its args never
// reach the container's `new`. The `never[]` rest
// keeps such constructors assignable as tokens while still permitting the
// zero-arg `new Ctrl()` on the unbound path (`never` is assignable to any arg).
export type Ctor<T> = new (...args: never[]) => T;
export type Token<T> = Ctor<T> | (() => Ctor<T>);

/** Tag written onto every container-built instance so `@inject` can resolve. */
export const CONTAINER = Symbol('uc.container');

/**
 * The `ControllerContainer` that built `instance` (via the `CONTAINER` tag), or
 * `undefined` if it wasn't container-built. Lets a controller resolve its own
 * ctx (e.g. `containerOf(this)?.ctxName` for logging attribution) without
 * threading the container in.
 */
export const containerOf = (instance: unknown): ControllerContainer | undefined =>
  (instance as { [CONTAINER]?: ControllerContainer })?.[CONTAINER];

/**
 * A thunk `() => Ctor` has no `.prototype` (arrow functions never do), while a
 * class constructor always does — that distinction discriminates the two
 * `Token` shapes without invoking either.
 */
const isThunk = <T>(t: Token<T>): t is () => Ctor<T> => typeof t === 'function' && !(t as Ctor<T>).prototype;

export const resolveToken = <T>(t: Token<T>): Ctor<T> => (isThunk(t) ? t() : t);

/** A teardown closure a `whenController` callback may return. */
type Teardown = () => void;

/**
 * Normalize a `whenController` callback's return into a single teardown (or
 * `undefined`): a function passes through, an array is composed, anything else
 * (void, a Promise, a non-function) yields no teardown.
 */
const toTeardown = (result: void | Teardown | Teardown[]): Teardown | undefined => {
  if (typeof result === 'function') {
    return () => {
      try {
        result();
      } catch (err) {
        log.warn('a whenController teardown threw', err);
      }
    };
  }
  if (Array.isArray(result)) {
    const fns = result.filter((fn): fn is Teardown => typeof fn === 'function');
    return fns.length > 0
      ? () => {
          // Isolate-and-warn: one throwing teardown must not stop the rest.
          for (const fn of fns) {
            try {
              fn();
            } catch (err) {
              log.warn('a whenController teardown threw', err);
            }
          }
        }
      : undefined;
  }
  return undefined;
};

export interface Initializable {
  init?(): void;
}

export interface Destroyable {
  destroy?(): void;
}

export class ControllerContainer {
  /**
   * The `ctx-name` this container serves, set by `UploaderRegistry` at creation.
   * Purely informational (e.g. for logging attribution) — resolution keys off
   * the container instance, not this name. `undefined` for throwaway containers
   * built directly (tests) rather than via the registry.
   */
  public ctxName?: string;

  #instances = new Map<Ctor<unknown>, unknown>();
  #order: Ctor<unknown>[] = [];
  #resolving = new Set<Ctor<unknown>>();
  #consumers = new Set<unknown>();
  #boundValues = new Map<Ctor<unknown>, (c: ControllerContainer) => unknown>();
  #controllerWaiters = new Map<Ctor<unknown>, Set<(inst: unknown) => void>>();

  /** Register a factory for a host/boundary value. Only valid before resolution. */
  public bind<T>(token: Token<T>, factory: (c: ControllerContainer) => T): void {
    const Ctrl = resolveToken(token);
    if (this.#instances.has(Ctrl)) {
      throw new Error(`[uc] bind(${Ctrl.name}) after resolution`);
    }
    this.#boundValues.set(Ctrl, factory as (c: ControllerContainer) => unknown);
  }

  public get<T>(token: Token<T>): T {
    const Ctrl = resolveToken(token);
    // `has()` (not `get() !== undefined`): a bound factory may legitimately
    // yield `undefined`, and treating that as a miss would re-run the factory
    // on every access, breaking the singleton-per-token contract.
    if (this.#instances.has(Ctrl)) {
      // Erasure boundary: the map stores heterogeneous instances as `unknown`,
      // keyed by their own constructor, so the cast back to `T` is sound.
      return this.#instances.get(Ctrl) as T;
    }
    if (this.#resolving.has(Ctrl)) {
      throw new Error(`[uc] controller cycle at ${Ctrl.name}`);
    }
    this.#resolving.add(Ctrl);
    try {
      const boundFactory = this.#boundValues.get(Ctrl);
      const inst = (boundFactory ? boundFactory(this) : new Ctrl()) as T & { [CONTAINER]?: ControllerContainer };
      inst[CONTAINER] = this; // tag BEFORE init so @inject works in init()
      this.#instances.set(Ctrl, inst); // cache BEFORE init so re-entrant get() is safe
      this.#order.push(Ctrl);
      try {
        (inst as Initializable).init?.();
      } catch (err) {
        // `init()` threw: the cached-before-init instance is only partially
        // wired, so roll it back (remove from `#instances`/`#order`) rather than
        // leaving a broken singleton every later `get()` would return. A
        // dependency `init()` resolved before throwing stays cached (it is
        // fully built); only `Ctrl` — appended once, guaranteed non-re-entrant
        // by `#resolving` — is removed. Best-effort teardown, then rethrow.
        this.#instances.delete(Ctrl);
        const idx = this.#order.indexOf(Ctrl);
        if (idx !== -1) {
          this.#order.splice(idx, 1);
        }
        try {
          (inst as Destroyable).destroy?.();
        } catch {
          // Teardown of a half-initialized instance is best-effort — never let
          // it mask the original `init()` failure.
        }
        throw err;
      }
      // Flush any `whenController` waiters AFTER a successful init, so they
      // receive a fully initialized instance (and never fire for an instance
      // that was rolled back above). Do this inside `get()` (the single
      // resolution point) so it covers both the unbound `new Ctrl()` path and
      // the `bind()`-ed factory path.
      this.#flushControllerWaiters(Ctrl, inst);
      return inst;
    } finally {
      this.#resolving.delete(Ctrl);
    }
  }

  public has<T>(token: Token<T>): boolean {
    return this.#instances.has(resolveToken(token));
  }

  /**
   * Null-safe resolve: return the controller only if the token is already bound
   * (constructed) on this container, else `null` — WITHOUT constructing it.
   * Reserved for conditionally-bound tokens (e.g. `PluginController`, bound only
   * in uploader scopes by `ensurePluginManager`): a plain `get()` on such an
   * unbound token would `new` a zero-arg instance its real ctor can't satisfy,
   * so callers that may run in a non-uploader scope reach for this instead.
   */
  public getOrNull<T>(token: Token<T>): T | null {
    return this.has(token) ? this.get(token) : null;
  }

  /**
   * Run `cb` with the controller as soon as it is resolved on this container:
   * synchronously now if already constructed, otherwise on the first `get()`
   * that constructs it (e.g. a conditionally-bound `PluginController` resolved
   * later by `ensurePluginManager`). The cross-token analogue of the registry's
   * `whenAvailable`, for tokens that appear after container creation.
   *
   * `cb` may return a teardown — a `() => void` or an array of them (e.g. the
   * observers it attaches to the resolved controller). The returned unsubscribe
   * then disposes that teardown once `cb` has fired, or cancels a still-pending
   * waiter if it hasn't — so a caller returns its observers directly instead of
   * hand-tracking them. A `void` return keeps the old "cancel waiter only"
   * behavior.
   */
  public whenController<T>(token: Token<T>, cb: (inst: T) => void | Teardown | Teardown[]): () => void {
    const Ctrl = resolveToken(token);
    // Fire immediately only if the instance is FULLY resolved: present
    // (`has()`, not `get() !== undefined` — a bound factory may legitimately
    // yield `undefined`, and treating that as "not resolved" would register a
    // waiter that never fires) AND not still mid-init. A token in `#resolving`
    // is cached-before-init (line in `get()`), so its instance is only
    // partially wired — defer to the post-init flush rather than hand a waiter a
    // half-built instance. Isolate-and-warn on the immediate callback, matching
    // `#flushControllerWaiters`.
    if (this.#instances.has(Ctrl) && !this.#resolving.has(Ctrl)) {
      let teardown: Teardown | undefined;
      try {
        teardown = toTeardown(cb(this.#instances.get(Ctrl) as T));
      } catch (err) {
        log.warn(`a whenController immediate callback for ${Ctrl.name} threw`, err);
      }
      return () => teardown?.();
    }
    let set = this.#controllerWaiters.get(Ctrl);
    if (!set) {
      set = new Set();
      this.#controllerWaiters.set(Ctrl, set);
    }
    // Wrap `cb` so the teardown it returns when the waiter fires is captured
    // here and disposed by the unsubscribe below.
    let teardown: Teardown | undefined;
    let fired = false;
    const waiter = (inst: unknown): void => {
      fired = true;
      teardown = toTeardown(cb(inst as T));
    };
    set.add(waiter);
    return () => {
      // Already fired: dispose whatever the callback returned.
      if (fired) {
        teardown?.();
        return;
      }
      // Still pending: cancel the waiter. Stale-unsubscribe guard — only mutate
      // the set STILL registered for this token. Once flushed/cleared,
      // `#controllerWaiters` may hold a fresh set for the same token; a
      // captured-set `delete` (and especially the empty cleanup below) must not
      // touch it.
      if (this.#controllerWaiters.get(Ctrl) !== set) {
        return;
      }
      set.delete(waiter);
      if (set.size === 0) this.#controllerWaiters.delete(Ctrl);
    };
  }

  #flushControllerWaiters(Ctrl: Ctor<unknown>, inst: unknown): void {
    const set = this.#controllerWaiters.get(Ctrl);
    if (!set) {
      return;
    }
    // Drop the entry before firing so a waiter that (re-)subscribes for the same
    // token isn't flushed twice, and snapshot so a waiter mutating the set
    // mid-iteration is safe. Isolate-and-warn: one throwing waiter must not
    // abort the rest or bubble out of `get()`.
    this.#controllerWaiters.delete(Ctrl);
    for (const waiter of [...set]) {
      try {
        waiter(inst);
      } catch (err) {
        log.warn(`a whenController waiter for ${Ctrl.name} threw`, err);
      }
    }
  }

  public addConsumer(c: unknown): void {
    this.#consumers.add(c);
  }

  public removeConsumer(c: unknown): void {
    this.#consumers.delete(c);
  }

  public isUnreferenced(): boolean {
    return this.#consumers.size === 0;
  }

  public dispose(): void {
    // Clear pending `whenController` waiters BEFORE running destroys: a
    // `destroy()` may resolve a not-yet-built `@inject` peer via `get()`, which
    // flushes waiters — those must not fire against a container mid-teardown.
    this.#controllerWaiters.clear();
    // Drain the live LIFO list rather than iterating fixed indexes: a
    // `destroy()` can touch a not-yet-resolved `@inject` peer, which appends a
    // fresh instance to `#order` mid-loop. Popping until empty guarantees every
    // instance — including any lazily resolved during teardown — is destroyed
    // exactly once, still in reverse-insertion order.
    while (this.#order.length > 0) {
      const Ctrl = this.#order.pop()!;
      const inst = this.#instances.get(Ctrl) as Destroyable | undefined;
      try {
        inst?.destroy?.();
      } catch (err) {
        // Isolate-and-warn: one controller's failed teardown must not abort the
        // rest of the disposal chain (mirrors EventBus/Listeners fan-out).
        log.warn(`${Ctrl.name}.destroy() threw`, err);
      }
      // Clear the CONTAINER tag after destroy to signal disposed state and prevent
      // @inject from accessing stale container references in post-disposal closures.
      if (inst && typeof inst === 'object' && CONTAINER in inst) {
        delete (inst as Destroyable & { [CONTAINER]?: ControllerContainer })[CONTAINER];
      }
    }
    this.#instances.clear();
    this.#order = [];
    this.#boundValues.clear();
    this.#consumers.clear();
    this.#controllerWaiters.clear();
  }
}
