import { describe, expect, it } from 'vitest';
import { defineLocale } from '@/index';
import ar from '@/locales/file-uploader/ar';
import { renderSolution } from '~/tests/utils/render-solution';

defineLocale('ar', ar);

describe('locale direction', () => {
  it('lays the uploader out right-to-left for an RTL locale and back for an LTR one', async () => {
    const { config, root } = await renderSolution('regular');
    expect(getComputedStyle(root).direction).toBe('ltr');

    config.localeName = 'ar';
    await expect.poll(() => getComputedStyle(root).direction).toBe('rtl');

    config.localeName = 'en';
    await expect.poll(() => getComputedStyle(root).direction).toBe('ltr');
  });
});
