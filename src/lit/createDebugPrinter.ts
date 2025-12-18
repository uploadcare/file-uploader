import type { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';

export const createDebugPrinter = (getCtx: () => PubSub<SharedState>, scope?: string) => {
  return (...args: unknown[]) => {
    const ctx = getCtx();
    if (!ctx.read('*cfg/debug')) {
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
