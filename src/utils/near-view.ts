/**
 * `IntersectionObserver` options that count an element as in view from one screen away, inside whatever scrolls it:
 * lazy work (a row's content, its thumbnail) is done by the time the element scrolls in. `scrollMargin` grows the
 * clip of nested scroll containers, which `rootMargin` cannot reach without naming one as the root. A browser without
 * it ignores the option and waits for the element itself.
 */
export const NEAR_VIEW: IntersectionObserverInit & { scrollMargin: string } = { scrollMargin: '100% 0px' };

/**
 * An `IntersectionObserver` for one element that reports where it is now. One callback can carry several entries for
 * the element, oldest first: one that moved into view within a frame reports off screen, then on. Only the latest
 * says where it is.
 */
export const latestIntersectionObserver = (
  onChange: (entry: IntersectionObserverEntry) => void,
  init?: IntersectionObserverInit,
): IntersectionObserver =>
  new window.IntersectionObserver((entries) => {
    const entry = entries.at(-1);
    if (entry) onChange(entry);
  }, init);
