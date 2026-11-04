import { afterEach, describe, expect, it } from 'vitest';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { DropDown } from './DropDown';

DropDown.reg('uc-drop-down');

const ctxName = 'drop-down-spec';
const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  UploaderRegistry.dispose(ctxName);
});

const mount = async (label?: string): Promise<DropDown> => {
  const el = document.createElement('uc-drop-down');
  el.setAttribute('ctx-name', ctxName);
  if (label) el.setAttribute('label', label);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

const trigger = (el: DropDown) => el.querySelector<HTMLButtonElement>('.uc-dropdown-btn');

describe('DropDown trigger', () => {
  it('has an accessible name by default, since its content is an icon only', async () => {
    const el = await mount();
    expect(trigger(el)?.getAttribute('aria-label')).toBe('Other');
  });

  it('takes its accessible name from the label attribute', async () => {
    const el = await mount('More sources');
    expect(trigger(el)?.getAttribute('aria-label')).toBe('More sources');
  });
});
