import { afterEach, describe, expect, it, vi } from 'vitest';
import { latestIntersectionObserver } from './near-view';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('latestIntersectionObserver', () => {
  const stubObserver = () => {
    const created: { report: IntersectionObserverCallback; init?: IntersectionObserverInit }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        public constructor(report: IntersectionObserverCallback, init?: IntersectionObserverInit) {
          created.push({ report, init });
        }
      },
    );
    return created;
  };
  const entry = (isIntersecting: boolean) => ({ isIntersecting }) as IntersectionObserverEntry;

  it('reports the latest entry of a callback that carries several, oldest first', () => {
    const created = stubObserver();
    const onChange = vi.fn();
    const init = { threshold: 0.1 };
    latestIntersectionObserver(onChange, init);

    created[0]?.report([entry(false), entry(true)], {} as IntersectionObserver);

    expect(onChange.mock.calls).toEqual([[entry(true)]]);
    expect(created[0]?.init).toBe(init);
  });

  it('reports nothing for a callback with no entries', () => {
    const created = stubObserver();
    const onChange = vi.fn();
    latestIntersectionObserver(onChange);

    created[0]?.report([], {} as IntersectionObserver);

    expect(onChange).not.toHaveBeenCalled();
  });
});
