import type { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';

export const createDebugPrinter = (getCtx: () => PubSub<SharedState>) => {
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
    console.log(`[${ctx.id}]`, ...consoleArgs);
  };
};
