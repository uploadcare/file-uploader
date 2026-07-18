import { ConfigController } from '../abstract/controllers/ConfigController';
import type { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';

/**
 * Debug logger scoped to a ctx. Reads the `debug` flag directly from the ctx's
 * `ConfigController` (M-god step 7: off the `*cfg/*` PubSub facade) while still
 * using the ctx for its `id` prefix — so callers keep passing `() => ctx`
 * unchanged.
 */
export const createDebugPrinter = (getCtx: () => PubSub<SharedState>, scope?: string) => {
  return (...args: unknown[]) => {
    const ctx = getCtx();
    if (!ctx.container().get(ConfigController).get('debug')) {
      return;
    }
    let consoleArgs = args;
    if (typeof args?.[0] === 'function') {
      const resolver = args[0] as () => unknown[];
      consoleArgs = resolver();
    }
    const prefixes = [ctx.id, scope].filter(Boolean);
    console.log(`[${prefixes.join('][')}]`, ...consoleArgs);
  };
};
