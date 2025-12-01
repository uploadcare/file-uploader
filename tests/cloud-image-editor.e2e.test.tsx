import { commands, page, userEvent } from '@vitest/browser/context';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import '../types/jsx';

// biome-ignore lint/correctness/noUnusedImports: Used in JSX
import { renderer } from './utils/test-renderer';

beforeAll(async () => {
  // biome-ignore lint/suspicious/noTsIgnore: Ignoring TypeScript error for CSS import
  // @ts-ignore
  await import('@/solutions/cloud-image-editor/index.css');
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

beforeEach(() => {
  const ctxName = `test-${Math.random().toString(36).slice(2)}`;
  page.render(
    <>
      <uc-cloud-image-editor uuid="f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f" ctx-name={ctxName}></uc-cloud-image-editor>
      <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
});

describe('Cloud Image Editor', () => {
  it('should be rendered', async () => {
    await expect.element(page.getByTestId('uc-cloud-image-editor')).toBeVisible();
  });
});
