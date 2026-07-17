import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Config } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const renderCopyright = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-copyright ctx-name={ctxName}></uc-copyright>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const config = page.getByTestId('uc-config').query()! as Config;
  return { ctxName, config };
};

describe('uc-copyright', () => {
  it('renders the "Powered by Uploadcare" link', async () => {
    renderCopyright();
    const link = page.getByText('Powered by Uploadcare', { exact: true });
    await expect.element(link).toBeVisible();
    expect((link.query() as HTMLAnchorElement).href).toContain('uploadcare.com');
    expect(link.query()?.classList.contains('uc-credits')).toBe(true);
  });

  it('hides when removeCopyright is set, shows again when unset', async () => {
    // M-god step 6a: Copyright now reads `removeCopyright` through the tracked
    // config signal inside `render()`, so a `SignalWatcher` re-render toggles
    // `?hidden` on the `<a>` (was an imperative `toggleAttribute('hidden')` on
    // the host). This asserts the reactive path end-to-end in a real browser:
    // an external `<uc-config>` change re-renders the overridden `render()`.
    const { config } = renderCopyright();
    const link = () => document.querySelector<HTMLAnchorElement>('uc-copyright .uc-credits')!;
    await expect.element(page.getByText('Powered by Uploadcare', { exact: true })).toBeVisible();
    expect(link().hasAttribute('hidden')).toBe(false);

    config.removeCopyright = true;
    await expect.poll(() => link().hasAttribute('hidden')).toBe(true);

    config.removeCopyright = false;
    await expect.poll(() => link().hasAttribute('hidden')).toBe(false);
  });

  it('reflects data-testid under testMode', async () => {
    renderCopyright();
    await expect.element(page.getByTestId('uc-copyright')).toBeInTheDocument();
  });

  it('bootstraps its own ctx and renders with NO v1 block present anywhere in the composition (M9o)', async () => {
    const ctxName = getCtxName();
    const { PubSub } = await import('@/lit/PubSubCompat.js');
    expect(PubSub.hasCtx(ctxName)).toBe(false);

    // Deliberately no <uc-config> (or any v1 block) — a pure ChildBlock
    // composition. Before M9o Task 2, nothing would ever create this ctx and
    // the block would gate forever.
    page.render(<uc-copyright ctx-name={ctxName}></uc-copyright>);

    await expect.element(page.getByText('Powered by Uploadcare', { exact: true })).toBeVisible();
    expect(PubSub.hasCtx(ctxName)).toBe(true);
  });
});
