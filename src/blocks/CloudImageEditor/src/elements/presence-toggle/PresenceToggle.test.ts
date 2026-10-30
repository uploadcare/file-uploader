import { afterEach, expect, it } from 'vitest';
import { delay } from '../../../../../utils/delay';
import { PresenceToggle } from './PresenceToggle';

PresenceToggle.reg('uc-presence-toggle'); // same path as defineComponents(UC); idempotent

const mounted: HTMLElement[] = [];
afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
});

const create = (): { el: PresenceToggle; initialRenders: () => number } => {
  const el = document.createElement('uc-presence-toggle') as PresenceToggle;
  let count = 0;
  el.addEventListener('uc-internal:initial-render', () => count++);
  mounted.push(el);
  return { el, initialRenders: () => count };
};

it('leaves its initial state a task after connecting', async () => {
  const { el, initialRenders } = create();
  document.body.append(el);
  expect(el.classList.contains('uc-initial')).toBe(true);

  await delay(0);
  expect(el.classList.contains('uc-initial')).toBe(false);
  expect(initialRenders()).toBe(1);
});

it('does nothing more once removed before that task', async () => {
  const { el, initialRenders } = create();
  document.body.append(el);
  el.remove();

  await delay(0);
  expect(initialRenders()).toBe(0);
});

it('still leaves its initial state after a DOM move', async () => {
  const { el, initialRenders } = create();
  document.body.append(el);
  const other = document.createElement('div');
  document.body.append(other);
  mounted.push(other);
  other.append(el);

  await delay(0);
  expect(el.classList.contains('uc-initial')).toBe(false);
  expect(initialRenders()).toBe(1);
});
