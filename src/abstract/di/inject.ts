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
