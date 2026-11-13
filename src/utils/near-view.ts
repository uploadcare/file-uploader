/**
 * `IntersectionObserver` options that count an element as in view from one screen away, inside whatever scrolls it:
 * lazy work (a row's content, its thumbnail) is done by the time the element scrolls in. `scrollMargin` grows the
 * clip of nested scroll containers, which `rootMargin` cannot reach without naming one as the root. A browser without
 * it ignores the option and waits for the element itself.
 */
export const NEAR_VIEW: IntersectionObserverInit & { scrollMargin: string } = { scrollMargin: '100% 0px' };
