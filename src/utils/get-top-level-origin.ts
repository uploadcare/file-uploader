export const getTopLevelOrigin = (): string => {
  // The last entry of ancestorOrigins is the top-level origin, readable even from cross-origin iframes.
  // The list is empty when not framed and unsupported in older Firefox; "null" means an opaque origin
  // (e.g. a sandboxed ancestor) — useless as an origin value, so fall through in all those cases.
  const ancestorOrigins = globalThis.location.ancestorOrigins;
  const topAncestorOrigin = ancestorOrigins?.[ancestorOrigins.length - 1];
  if (topAncestorOrigin && topAncestorOrigin !== 'null') {
    return topAncestorOrigin;
  }

  const topLevelWindow = globalThis.top ?? globalThis.parent ?? globalThis.self;
  try {
    return topLevelWindow.location.origin;
  } catch (e) {
    console.warn('Unable to access top-level window location:', e);
    return globalThis.location.origin;
  }
};
