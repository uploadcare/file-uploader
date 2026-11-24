import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, DropDown } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const renderDropDown = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-drop-down ctx-name={ctxName}></uc-drop-down>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const config = page.getByTestId('uc-config').query()! as Config;
  const dropDown = document.querySelector('uc-drop-down')! as DropDown;
  return { ctxName, config, dropDown };
};

// `content-for` light-DOM projection (LightDomMixin) is adopted from the
// element's own childNodes read fresh on its first `update()` pass — plain DOM
// appends performed synchronously right after `page.render` (before Lit's
// microtask-scheduled first update) land in time, without depending on the
// generated JSX attribute typing for the `content-for` attribute (which isn't
// a typed HTML/React attribute).
const appendContentFor = (host: Element, slot: string, tagName: string, text: string): Element => {
  const el = document.createElement(tagName);
  el.setAttribute('content-for', slot);
  el.textContent = text;
  host.appendChild(el);
  return el;
};

describe('uc-drop-down', () => {
  it('renders a popover-target button and a matching popover content div', async () => {
    const { dropDown } = renderDropDown();
    await dropDown.updateComplete;

    const button = dropDown.querySelector('button.uc-dropdown-btn') as HTMLButtonElement | null;
    const content = dropDown.querySelector('[popover]') as HTMLElement | null;

    expect(button).toBeTruthy();
    expect(content).toBeTruthy();
    expect(button!.hasAttribute('popovertarget')).toBe(true);
    expect(content!.getAttribute('popover')).toBe('auto');
    expect(content!.id).toBeTruthy();
    expect(button!.getAttribute('popovertarget')).toBe(content!.id);
  });

  it('projects content-for="dd-header-button" into the header button and content-for="dd-content" into the popover content', async () => {
    const { dropDown } = renderDropDown();
    const header = appendContentFor(dropDown, 'dd-header-button', 'span', 'Open menu');
    const content = appendContentFor(dropDown, 'dd-content', 'div', 'Menu body');

    await expect.poll(() => dropDown.querySelector('button.uc-dropdown-btn span')?.textContent).toBe('Open menu');
    const contentHost = dropDown.querySelector('[popover]');
    await expect.poll(() => contentHost?.querySelector('div')?.textContent).toBe('Menu body');

    // real light-DOM child adoption: same node instances, moved into place
    expect(dropDown.querySelector('button.uc-dropdown-btn')?.contains(header)).toBe(true);
    expect(contentHost?.contains(content)).toBe(true);
  });

  it('sets the uc-drop-down style attribute on the host', async () => {
    const { dropDown } = renderDropDown();
    await expect.poll(() => dropDown.hasAttribute('uc-drop-down')).toBe(true);
  });

  it('reflects data-testid under testMode', async () => {
    renderDropDown();
    await expect.element(page.getByTestId('uc-drop-down')).toBeInTheDocument();
  });
});
