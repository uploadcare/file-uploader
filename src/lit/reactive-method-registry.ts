/**
 * Shared machinery for the auto-managed method decorators (`@effect`,
 * `@subscription`): both collect decorated methods per class and, at host
 * adoption, register them with automatic teardown. Only the *collection* lives
 * here (the subtle part — per-prototype metadata + a chain walk that dedupes
 * overrides); how a collected method is run/torn down is the decorator's own
 * concern.
 */

export interface DecoratedMethod<TOptions> {
  key: string;
  options?: TOptions;
}

/**
 * Build a legacy method decorator that records `{ key, options }` on the class
 * prototype under `brand`. Stored own-per-prototype so a subclass's methods
 * don't leak onto the base (deduped at collection time).
 */
export function makeMethodDecorator<TOptions>(brand: symbol) {
  return (options?: TOptions) =>
    (proto: object, key: string): void => {
      const target = proto as Record<symbol, DecoratedMethod<TOptions>[] | undefined>;
      if (!Object.hasOwn(target, brand)) {
        target[brand] = [];
      }
      target[brand]?.push({ key, options });
    };
}

/**
 * Collect every `brand`-decorated method reachable on `host`. Base-class methods
 * come first (so a base sets up before its subclass), in source order within a
 * class. A method name appears once even if a subclass overrides a base method
 * of the same name — the most-derived declaration wins (its options + body),
 * keeping the base's position in the order.
 */
export function collectDecoratedMethods<TOptions>(host: object, brand: symbol): Array<DecoratedMethod<TOptions>> {
  // Gather prototypes base-first.
  const protos: object[] = [];
  let proto: object | null = Object.getPrototypeOf(host);
  while (proto && proto !== Object.prototype) {
    protos.unshift(proto);
    proto = Object.getPrototypeOf(proto);
  }
  // A `Map` keyed by method name preserves first-seen (base) position while a
  // later `set` (subclass override) replaces the metadata in place.
  const byKey = new Map<string, DecoratedMethod<TOptions>>();
  for (const p of protos) {
    const list = Object.hasOwn(p, brand) ? (p as Record<symbol, DecoratedMethod<TOptions>[]>)[brand] : undefined;
    if (list) {
      for (const meta of list) {
        byKey.set(meta.key, meta);
      }
    }
  }
  return [...byKey.values()];
}

/** Resolve a collected method to a bound callable, or `undefined` if it isn't a function. */
export function boundMethod(host: object, key: string): (() => unknown) | undefined {
  const method = (host as Record<string, unknown>)[key];
  return typeof method === 'function' ? (method as () => unknown).bind(host) : undefined;
}
