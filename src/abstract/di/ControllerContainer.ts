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

// A token constructor. Unbound tokens are built by the container with a
// zero-arg `new Ctrl()`; a token whose value isn't a zero-arg-constructible
// class (e.g. `UploadHostBridge`, a plain value built by `buildUploaderScopeDeps`)
// MUST be `bind()`-ed with a factory, so its args never reach the container's
// `new`. The `never[]` rest
// keeps such constructors assignable as tokens while still permitting the
// zero-arg `new Ctrl()` on the unbound path (`never` is assignable to any arg).
export type Ctor<T> = new (...args: never[]) => T;
export type Token<T> = Ctor<T> | (() => Ctor<T>);

/** Tag written onto every container-built instance so `@inject` can resolve. */
export const CONTAINER = Symbol('uc.container');

/**
 * A thunk `() => Ctor` has no `.prototype` (arrow functions never do), while a
 * class constructor always does — that distinction discriminates the two
 * `Token` shapes without invoking either.
 */
const isThunk = <T>(t: Token<T>): t is () => Ctor<T> => typeof t === 'function' && !(t as Ctor<T>).prototype;

export const resolveToken = <T>(t: Token<T>): Ctor<T> => (isThunk(t) ? t() : t);

export interface Initializable {
  init?(): void;
}

export interface Destroyable {
  destroy?(): void;
}

export class ControllerContainer {
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
    const cached = this.#instances.get(Ctrl);
    if (cached !== undefined) {
      // Erasure boundary: the map stores heterogeneous instances as `unknown`,
      // keyed by their own constructor, so the cast back to `T` is sound.
      return cached as T;
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
      (inst as Initializable).init?.();
      // Flush any `whenController` waiters AFTER init, so they receive a fully
      // initialized instance. Do this inside `get()` (the single resolution
      // point) so it covers both the unbound `new Ctrl()` path and the
      // `bind()`-ed factory path.
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
   * later by `ensurePluginManager`). Returns an unsubscribe that cancels a
   * still-pending waiter (no-op once fired). The cross-token analogue of the
   * registry's `whenAvailable`, for tokens that appear after container creation.
   */
  public whenController<T>(token: Token<T>, cb: (inst: T) => void): () => void {
    const Ctrl = resolveToken(token);
    const existing = this.#instances.get(Ctrl);
    if (existing !== undefined) {
      cb(existing as T);
      return () => {};
    }
    let set = this.#controllerWaiters.get(Ctrl);
    if (!set) {
      set = new Set();
      this.#controllerWaiters.set(Ctrl, set);
    }
    const waiter = cb as (inst: unknown) => void;
    set.add(waiter);
    return () => {
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
        console.warn(`[uc] a whenController waiter for ${Ctrl.name} threw`, err);
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
    for (let i = this.#order.length - 1; i >= 0; i--) {
      const inst = this.#instances.get(this.#order[i]!) as Destroyable;
      try {
        inst.destroy?.();
      } catch (err) {
        // Isolate-and-warn: one controller's failed teardown must not abort the
        // rest of the disposal chain (mirrors EventBus/Listeners fan-out).
        console.warn(`[uc] ${this.#order[i]!.name}.destroy() threw`, err);
      }
    }
    this.#instances.clear();
    this.#order = [];
    this.#boundValues.clear();
    this.#consumers.clear();
    this.#controllerWaiters.clear();
  }
}
