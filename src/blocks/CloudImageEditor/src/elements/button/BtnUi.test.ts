import { afterEach, expect, it } from 'vitest';
import { BtnUi } from './BtnUi';

BtnUi.reg('uc-btn-ui'); // same path as defineComponents(UC); idempotent

const mounted: HTMLElement[] = [];
afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
});

const mount = async (attrs: Record<string, string>): Promise<BtnUi> => {
  const el = document.createElement('uc-btn-ui') as BtnUi;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

it('adds the theme class next to the classes already on the host', async () => {
  const el = await mount({ class: 'my-button', theme: 'primary' });
  expect([...el.classList]).toEqual(['my-button', 'uc-primary']);
});

it('swaps the theme class when the theme changes', async () => {
  const el = await mount({ class: 'my-button', theme: 'primary' });

  el.theme = 'secondary';
  await el.updateComplete;
  expect([...el.classList]).toEqual(['my-button', 'uc-secondary']);

  el.theme = 'custom';
  await el.updateComplete;
  expect([...el.classList]).toEqual(['my-button']);
});
