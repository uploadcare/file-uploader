import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
// `SourceButtonConfig` is not re-exported from `@/index.ts` (only the `SourceBtn`
// class is), so it's imported directly from its source module.
import type { SourceButtonConfig } from '@/blocks/SourceBtn/SourceBtn.ts';
import type { Config, SourceBtn } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const renderSourceBtn = (props?: { textOnly?: boolean; iconOnly?: boolean }) => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-source-btn ctx-name={ctxName}></uc-source-btn>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const config = page.getByTestId('uc-config').query()! as Config;
  const btn = document.querySelector('uc-source-btn')! as SourceBtn;
  // `textOnly`/`iconOnly` are set as JS properties (same pattern as `.source`
  // and `uc-icon`'s `.name` in icon.e2e.test.tsx) to avoid depending on the
  // generated JSX attribute typing for these boolean properties.
  if (props?.textOnly) btn.textOnly = true;
  if (props?.iconOnly) btn.iconOnly = true;
  return { ctxName, config, btn };
};

const iconName = () => document.querySelector('uc-source-btn uc-icon')?.getAttribute('name');
const txtContent = () => document.querySelector('uc-source-btn .uc-txt')?.textContent;

describe('uc-source-btn', () => {
  it('renders the l10n of the label as aria-label and text; unknown key falls back to the key itself', async () => {
    const { btn } = renderSourceBtn();
    const source: SourceButtonConfig = { id: 'my-src', label: 'my-label-key', onClick: () => {} };
    btn.source = source;

    await expect
      .poll(() => document.querySelector('uc-source-btn button')?.getAttribute('aria-label'))
      .toBe('my-label-key');
    await expect.poll(txtContent).toBe('my-label-key');
    await expect.poll(iconName).toBe('my-src');
  });

  it('uses source.icon when set, instead of falling back to id', async () => {
    const { btn } = renderSourceBtn();
    btn.source = { id: 'my-src', label: 'my-label-key', icon: 'custom-icon', onClick: () => {} };

    await expect.poll(iconName).toBe('custom-icon');
  });

  it('textOnly suppresses the icon', async () => {
    const { btn } = renderSourceBtn({ textOnly: true });
    btn.source = { id: 'my-src', label: 'my-label-key', onClick: () => {} };
    await expect.poll(txtContent).toBe('my-label-key');
    expect(document.querySelector('uc-source-btn uc-icon')).toBeNull();
  });

  it('iconOnly suppresses the text', async () => {
    const { btn } = renderSourceBtn({ iconOnly: true });
    btn.source = { id: 'my-src', label: 'my-label-key', onClick: () => {} };
    await expect.poll(iconName).toBe('my-src');
    expect(document.querySelector('uc-source-btn .uc-txt')).toBeNull();
  });

  it('clicking the button invokes source.onClick', async () => {
    const { btn } = renderSourceBtn();
    const onClick = vi.fn();
    btn.source = { id: 'my-src', label: 'my-label-key', onClick };
    await expect.poll(iconName).toBe('my-src');

    (document.querySelector('uc-source-btn button') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(onClick).toHaveBeenCalledOnce());
  });

  it('with no source set, falls back to the "default" icon without crashing', async () => {
    renderSourceBtn();
    await expect.poll(iconName).toBe('default');
  });

  it('reflects data-testid under testMode', async () => {
    renderSourceBtn();
    await expect.element(page.getByTestId('uc-source-btn')).toBeInTheDocument();
  });

  it('applies a source set while the render gate was still closed', async () => {
    const ctxName = getCtxName();
    // Mount the button BEFORE any ctx exists, then set the property — the
    // scheduled update flushes gated, so Lit clears changedProperties.
    const btn = document.createElement('uc-source-btn');
    btn.setAttribute('ctx-name', ctxName);
    document.body.append(btn);
    await btn.updateComplete;
    btn.source = { id: 'late-src', label: 'late-label-key', onClick: () => {} };
    await btn.updateComplete;

    // Now create the ctx; the button adopts and must render the label it was
    // given pre-adoption, not the stale defaults.
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    await expect.poll(() => btn.querySelector('.uc-txt')?.textContent).toBe('late-label-key');
    await expect.poll(() => btn.querySelector('uc-icon')?.getAttribute('name')).toBe('late-src');
    btn.remove();
  });
});
