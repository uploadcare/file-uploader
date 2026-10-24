import { expect, it } from 'vitest';
import { EditorIcon } from './EditorIcon';

it('renders the sprite use for its name with no ctx', async () => {
  EditorIcon.reg('uc-editor-icon'); // same path as defineComponents(UC); idempotent
  const el = document.createElement('uc-editor-icon');
  el.setAttribute('name', 'rotate');
  document.body.append(el);
  await (el as { updateComplete: Promise<unknown> }).updateComplete;
  const use = el.querySelector('svg use');
  expect(use?.getAttribute('href')).toBe('#uc-icon-rotate');
  el.remove();
});
