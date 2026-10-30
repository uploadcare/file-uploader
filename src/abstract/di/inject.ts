import { CONTAINER, type ControllerContainer, type Token } from './ControllerContainer';

/**
 * Experimental property decorator that defines a lazy, prototype-level getter
 * resolving `token` from the owning container on access (never at construction).
 *
 * Because resolution is deferred, mutual/circular controller references have
 * zero construction cycle. Forward/circular references must pass a token thunk
 * `@inject(() => Other)` — a direct class reference to a later-declared class
 * would hit the temporal dead zone at decoration time.
 */
export function inject<T>(token: Token<T>) {
  return (target: object, key: string): void => {
    Object.defineProperty(target, key, {
      get(this: { [CONTAINER]?: ControllerContainer }): T {
        const c = this[CONTAINER];
        if (!c) {
          throw new Error(`@inject on '${key}': instance not created by a container`);
        }
        return c.get(token);
      },
      enumerable: false,
      configurable: true,
    });
  };
}

/**
 * Null-tolerant sibling of {@link inject}: the getter returns `null` instead of
 * throwing when the host has no container adopted — the field form of the old
 * `useOrNull(token)`. Read it with `?.`.
 *
 * Use it for a dependency that can legitimately be absent where it's read:
 * a token whose value is only bound once the uploader scope attaches (so it may
 * be unresolved at adoption), or a read from a context that can outlive adoption
 * (a trailing throttle/debounce tick, a router-guard predicate invoked during a
 * teardown-time navigation). For a read that is genuinely guaranteed-adopted,
 * prefer {@link inject} so an early/late access surfaces as a bug.
 */
export function injectOrNull<T>(token: Token<T>) {
  return (target: object, key: string): void => {
    Object.defineProperty(target, key, {
      get(this: { [CONTAINER]?: ControllerContainer }): T | null {
        return this[CONTAINER]?.get(token) ?? null;
      },
      enumerable: false,
      configurable: true,
    });
  };
}
