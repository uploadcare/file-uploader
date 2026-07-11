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
    const { config } = renderCopyright();
    const el = () => document.querySelector('uc-copyright')!;
    await expect.element(page.getByText('Powered by Uploadcare', { exact: true })).toBeVisible();

    config.removeCopyright = true;
    await expect.poll(() => el().hasAttribute('hidden')).toBe(true);

    config.removeCopyright = false;
    await expect.poll(() => el().hasAttribute('hidden')).toBe(false);
  });

  it('reflects data-testid under testMode', async () => {
    renderCopyright();
    await expect.element(page.getByTestId('uc-copyright')).toBeInTheDocument();
  });
});
