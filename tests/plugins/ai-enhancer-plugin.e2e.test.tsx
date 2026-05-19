import { beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { TEST_IMAGE_URL } from '../utils/constants';
import { addSource, getApi, openModal, renderUploader } from './utils';

beforeAll(async () => {
  // Registers <uc-ai-editor> and all its sub-elements.
  await import('@/ai-enhancer/index');
});

describe('AiEnhancerPlugin', () => {
  it('registers "Generate image" as an upload source', async () => {
    const { AiEnhancerPlugin } = await import('@/ai-enhancer/index');
    const { config } = await renderUploader([AiEnhancerPlugin]);
    addSource(config, 'ai-generate');
    await openModal();
    await expect.element(page.getByText('Generate image')).toBeVisible();
  });

  it('opens the AI editor activity when the Generate image source is selected', async () => {
    const { AiEnhancerPlugin } = await import('@/ai-enhancer/index');
    const { config } = await renderUploader([AiEnhancerPlugin]);
    addSource(config, 'ai-generate');
    await openModal();
    await page.getByText('Generate image').click();
    await vi.waitFor(() => {
      const editor = document.querySelector('uc-ai-editor') as (Element & { mode?: string }) | null;
      expect(editor).toBeTruthy();
      expect(editor?.mode).toBe('generate');
    });
  });

  it('opens the editor in edit mode with the file URL when the AI Edit file action is clicked', async () => {
    const { AiEnhancerPlugin } = await import('@/ai-enhancer/index');
    await renderUploader([AiEnhancerPlugin]);
    const api = getApi();
    api.addFileFromUrl(TEST_IMAGE_URL);
    api.initFlow();

    await expect.element(page.getByRole('button', { name: 'AI Edit' })).toBeVisible();
    await page.getByRole('button', { name: 'AI Edit' }).click();

    await vi.waitFor(() => {
      const editor = document.querySelector('uc-ai-editor') as (Element & { mode?: string; src?: string }) | null;
      expect(editor?.mode).toBe('edit');
      expect(editor?.src).toBeTruthy();
    });
  });
});
