import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, Select } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const renderSelect = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-select ctx-name={ctxName}></uc-select>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const config = page.getByTestId('uc-config').query()! as Config;
  const select = document.querySelector('uc-select')! as Select;
  return { ctxName, config, select };
};

const innerSelect = () => document.querySelector('uc-select select') as HTMLSelectElement | null;

describe('uc-select', () => {
  it('renders one native <option> per options entry, with matching text and value', async () => {
    const { select } = renderSelect();
    select.options = [
      { text: 'One', value: 'v1' },
      { text: 'Two', value: 'v2' },
      { text: 'Three', value: 'v3' },
    ];

    await expect.poll(() => innerSelect()?.querySelectorAll('option').length).toBe(3);
    const options = Array.from(innerSelect()!.querySelectorAll('option'));
    expect(options.map((o) => o.textContent)).toEqual(['One', 'Two', 'Three']);
    expect(options.map((o) => o.value)).toEqual(['v1', 'v2', 'v3']);
  });

  it('reflects .value into the native select', async () => {
    const { select } = renderSelect();
    select.options = [
      { text: 'One', value: 'v1' },
      { text: 'Two', value: 'v2' },
    ];
    // The native `<select>`'s `.value` binding and its `<option>` children are
    // committed as part of the same Lit template; a browser can only select a
    // value once the matching `<option>` exists in the DOM. Flushing the
    // `options` update first (one `updateComplete`) before setting `.value`
    // mirrors how a real consumer must sequence these two writes.
    await select.updateComplete;
    select.value = 'v2';

    await expect.poll(() => innerSelect()?.value).toBe('v2');
  });

  it('user-selecting an option updates .value and dispatches a change event on the host', async () => {
    const { select } = renderSelect();
    select.options = [
      { text: 'One', value: 'v1' },
      { text: 'Two', value: 'v2' },
    ];
    // See the ordering note above: flush the options render before setting
    // `.value` so the assertion actually exercises the reflection rather than
    // accidentally matching the browser's own "first option" default.
    await select.updateComplete;
    select.value = 'v1';
    await expect.poll(() => innerSelect()?.value).toBe('v1');

    const onChange = vi.fn();
    select.addEventListener('change', onChange);

    const nativeSelect = innerSelect()!;
    nativeSelect.value = 'v2';
    nativeSelect.dispatchEvent(new Event('change'));

    await expect.poll(() => select.value).toBe('v2');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('disabled reflects onto the inner select and the host attribute', async () => {
    const { select } = renderSelect();
    select.disabled = true;

    await expect.poll(() => innerSelect()?.disabled).toBe(true);
    expect(select.hasAttribute('disabled')).toBe(true);

    select.disabled = false;
    await expect.poll(() => innerSelect()?.disabled).toBe(false);
    expect(select.hasAttribute('disabled')).toBe(false);
  });

  it('disabled suppresses the host change dispatch', async () => {
    const { select } = renderSelect();
    select.options = [
      { text: 'One', value: 'v1' },
      { text: 'Two', value: 'v2' },
    ];
    await select.updateComplete;
    select.value = 'v1';
    select.disabled = true;
    await expect.poll(() => innerSelect()?.disabled).toBe(true);

    const onChange = vi.fn();
    select.addEventListener('change', onChange);

    const nativeSelect = innerSelect()!;
    nativeSelect.value = 'v2';
    nativeSelect.dispatchEvent(new Event('change'));
    await select.updateComplete;

    expect(onChange).not.toHaveBeenCalled();
    expect(select.value).toBe('v1');
  });

  it('reflects data-testid under testMode', async () => {
    renderSelect();
    await expect.element(page.getByTestId('uc-select')).toBeInTheDocument();
  });
});
