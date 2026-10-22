import { afterEach, describe, expect, it, vi } from 'vitest';
import { SliderUi } from './SliderUi';

SliderUi.reg('uc-slider-ui');

const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  vi.unstubAllGlobals();
});

const mount = async (): Promise<SliderUi> => {
  const slider = new SliderUi();
  document.body.append(slider);
  mounted.push(slider);
  await slider.updateComplete;
  return slider;
};

/** Moves the slider to another parent: a disconnect followed by a connect. */
const move = (slider: SliderUi): void => {
  const other = document.createElement('div');
  document.body.append(other);
  mounted.push(other);
  other.append(slider);
};

describe('uc-slider-ui after a DOM move', () => {
  it('still applies the focus colour', async () => {
    const slider = await mount();
    move(slider);

    slider.querySelector('input')?.dispatchEvent(new FocusEvent('focus'));

    expect(slider.style.getPropertyValue('--color-effect')).toBe('var(--hover-color-rgb)');
  });

  it('still observes its size', async () => {
    const observed = new Set<Element>();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        public observe(target: Element): void {
          observed.add(target);
        }
        public disconnect(): void {
          observed.clear();
        }
        public unobserve(): void {}
      },
    );
    const slider = await mount();
    move(slider);

    expect(observed.has(slider)).toBe(true);
  });
});
