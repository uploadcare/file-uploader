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

export type Ctor<T> = new () => T;
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
      return inst;
    } finally {
      this.#resolving.delete(Ctrl);
    }
  }

  public has<T>(token: Token<T>): boolean {
    return this.#instances.has(resolveToken(token));
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
  }
}
