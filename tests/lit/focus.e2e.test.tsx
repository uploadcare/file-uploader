import { afterEach, describe, expect, it } from 'vitest';
import { firstFocusable } from '@/lit/focus';

const mount = (markup: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = markup;
  document.body.append(root);
  mounted.push(root);
  return root;
};

const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
});

describe('firstFocusable', () => {
  it('skips a disabled control, whatever makes it focusable', () => {
    const root = mount(`
      <button disabled tabindex="0">a</button>
      <select disabled></select>
      <textarea disabled></textarea>
      <fieldset disabled><input /></fieldset>
      <button id="ok">b</button>
    `);
    expect(firstFocusable(root)?.id).toBe('ok');
  });

  it('skips a control inside an inert subtree', () => {
    const root = mount(`<div inert><button>a</button></div><button id="ok">b</button>`);
    expect(firstFocusable(root)?.id).toBe('ok');
  });

  it('skips what the caller excludes', () => {
    const root = mount(`<button class="no">a</button><button id="ok">b</button>`);
    expect(firstFocusable(root, (el) => el.className === 'no')?.id).toBe('ok');
  });
});
