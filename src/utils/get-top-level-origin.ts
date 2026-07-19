import { logger } from '../abstract/logger';

const log = logger.scope('top-level-origin');

export const getTopLevelOrigin = (): string => {
  const topLevelWindow = globalThis.top ?? globalThis.parent ?? globalThis.self;
  try {
    return topLevelWindow.location.origin;
  } catch (e) {
    log.warn('Unable to access top-level window location:', e);
    return globalThis.location.origin;
  }
};
