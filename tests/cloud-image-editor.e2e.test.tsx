import { page, userEvent } from '@vitest/browser/context';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
      <uc-cloud-image-editor
        crop-preset="1:1, 16:9, 4:3, 3:4, 9:16"
        uuid="f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f"
        ctx-name={ctxName}
      ></uc-cloud-image-editor>
      <uc-config
        cdn-cname="https://ucarecdn.com/"
        qualityInsights={false}
        ctx-name={ctxName}
        pubkey="demopublickey"
        testMode
      ></uc-config>
    </>,
  );
});

describe('Cloud Image Editor', () => {
  it('should be rendered', async () => {
    await expect.element(page.getByTestId('uc-cloud-image-editor')).toBeVisible();
  });

  it('should select tunings tab', async () => {
    const flip = page.getByTestId('uc-editor-crop-button-control').nth(2);

    await userEvent.click(flip);
  });

  it('should select crop preset', async () => {
    const freeform = page.getByTestId('uc-editor-freeform-button-control');

    await userEvent.click(freeform);

    const preset16x9 = page.getByTestId('uc-editor-aspect-ratio-button-control').nth(1);

    await expect.element(preset16x9).toBeVisible();

    await userEvent.click(preset16x9);

    const apply = page.getByRole('button', { name: /apply/i });

    await userEvent.click(apply);

    await expect.element(freeform).toBeVisible();
  });

  it("should apply 'brightness' operation", async () => {
    const tuningTab = page.getByRole('tab', { name: /tuning/i });
    await userEvent.click(tuningTab);

    const brightness = page.getByRole('option', { name: /Brightness/i });
    await userEvent.click(brightness);

    const slider = page.getByTestId('uc-editor-slider');
    await expect.element(slider).toBeVisible();

    const applySlider = page.getByRole('button', { name: /apply/i });
    await userEvent.click(slider);
    await userEvent.keyboard('[ArrowRight]');
    await userEvent.click(applySlider);

    await expect.element(tuningTab).toBeVisible();
  });
});
