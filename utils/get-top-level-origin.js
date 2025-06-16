// @ts-check

export const getTopLevelOrigin = () => {
  const topLevelWindow = globalThis.top ?? globalThis.parent ?? globalThis.self;
  try {
    return topLevelWindow.location.origin;
  } catch (e) {
    console.warn('Unable to access top-level window location:', e);
    return globalThis.location.origin;
  }
};
