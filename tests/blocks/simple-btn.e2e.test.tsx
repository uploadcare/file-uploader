import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Config } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const renderSimpleBtn = (children?: React.ReactNode) => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-simple-btn ctx-name={ctxName}>{children}</uc-simple-btn>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const config = page.getByTestId('uc-config').query()! as Config;
  return { ctxName, config };
};

describe('uc-simple-btn', () => {
  it('renders the localized multi-file button text and the drop-area visual text', async () => {
    renderSimpleBtn();
    await expect.element(page.getByText('Upload files', { exact: true })).toBeVisible();
    await expect.element(page.getByText('Drop files here', { exact: true })).toBeVisible();
  });

  it('renders the single-file button text when config.multiple is false', async () => {
    const { config } = renderSimpleBtn();
    await expect.element(page.getByText('Upload files', { exact: true })).toBeVisible();

    config.multiple = false;
    await expect.poll(() => document.querySelector('uc-simple-btn button span')?.textContent).toBe('Upload file');
  });

  it('wraps content in a uc-drop-area, enabled by default', async () => {
    renderSimpleBtn();
    const dropArea = () => document.querySelector('uc-simple-btn uc-drop-area');
    await expect.poll(() => dropArea()).toBeTruthy();
  });

  it('reflects data-testid under testMode', async () => {
    renderSimpleBtn();
    await expect.element(page.getByTestId('uc-simple-btn')).toBeInTheDocument();
  });

  it('yields extra light-DOM children into the button', async () => {
    renderSimpleBtn(<span class="extra">X</span>);
    await expect.poll(() => document.querySelector('uc-simple-btn span.extra')?.textContent).toBe('X');
  });
});
