import { afterEach, expect, it, vi } from 'vitest';
import { delay } from '../../utils/delay';
import { Img } from './Img';

Img.reg('uc-img');

/** A real UUID: the library validates the grammar, so placeholders are rejected. */
const UUID = 'c2499162-eb07-4b93-b31e-94a89a47e858';

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

it('defers loading when `intersection` is written after `uuid`', async () => {
  const observe = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      public observe = observe;
      public unobserve(): void {}
      public disconnect(): void {}
    },
  );
  const el = document.createElement('uc-img');
  document.body.append(el);
  el.setAttribute('uuid', UUID);
  el.setAttribute('intersection', '1');
  await delay(0);

  expect(observe).toHaveBeenCalled();
  expect(el.querySelector('img[src]')).toBeNull();
});
