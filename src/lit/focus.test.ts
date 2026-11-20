import { describe, expect, it, vi } from 'vitest';
import { isVisible } from './focus';

describe('isVisible', () => {
  it('asks the browser where it has checkVisibility', () => {
    const el = document.createElement('div');
    el.checkVisibility = () => true;
    vi.spyOn(el, 'getClientRects').mockReturnValue([] as unknown as DOMRectList);

    expect(isVisible(el)).toBe(true);
  });

  it('falls back to the element having a box where it does not (Safari before 17.4)', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'checkVisibility', { value: undefined });
    const rects = vi.spyOn(el, 'getClientRects');

    rects.mockReturnValue([{}] as unknown as DOMRectList);
    expect(isVisible(el)).toBe(true);
    rects.mockReturnValue([] as unknown as DOMRectList);
    expect(isVisible(el)).toBe(false);
  });
});
