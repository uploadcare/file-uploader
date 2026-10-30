import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const renderSpinner = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-spinner ctx-name={ctxName}></uc-spinner>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  return { ctxName };
};

describe('uc-spinner', () => {
  it('renders the spinner div', async () => {
    renderSpinner();
    await expect.poll(() => document.querySelector('uc-spinner div.uc-spinner')).toBeTruthy();
  });

  it('reflects data-testid under testMode', async () => {
    renderSpinner();
    await expect.element(page.getByTestId('uc-spinner')).toBeInTheDocument();
  });
});
