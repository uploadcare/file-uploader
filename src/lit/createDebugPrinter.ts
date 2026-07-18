import { ConfigController } from '../abstract/controllers/ConfigController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';

/**
 * Debug logger scoped to a ctx's `ControllerContainer`. Reads the `debug` flag
 * directly from the container's `ConfigController`.
 *
 * M-god step 9b-1: takes a container accessor instead of a ctx (`() => ctx`), so
 * this plumbing no longer depends on the `bag`/PubSub facade — callers pass
 * `() => this.containerOrNull` (or the container they already hold). The accessor
 * is null-safe: before a block adopts its container it returns `null` and logging
 * is a no-op, matching the disabled-debug path (the printer is only ever *called*
 * after adoption, but a pre-adoption call now degrades gracefully rather than
 * throwing on a missing ctx). The `ctx.id` half of the prefix is dropped with the
 * ctx — the `name` (a controller / hosting-block name) remains the sole prefix.
 */
export const createDebugPrinter = (getContainer: () => ControllerContainer | null, name?: string) => {
  return (...args: unknown[]) => {
    const container = getContainer();
    if (!container?.get(ConfigController).get('debug')) {
      return;
    }
    let consoleArgs = args;
    if (typeof args?.[0] === 'function') {
      const resolver = args[0] as () => unknown[];
      consoleArgs = resolver();
    }
    const prefixes = [name].filter(Boolean);
    console.log(`[${prefixes.join('][')}]`, ...consoleArgs);
  };
};
