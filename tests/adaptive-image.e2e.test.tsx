import { beforeAll, beforeEach, describe, it } from 'vitest';
import { page } from 'vitest/browser';
import '../types/jsx';

beforeAll(async () => {
  await import('@/solutions/adaptive-image/index.js');
});

beforeEach(() => {
  page.render(<uc-img uuid="7124ae98-344c-42b2-ae2a-bd9aa79d76d8" width="500px"></uc-img>);
});

describe('Adaptive Image', () => {
  it('should be rendered', async () => {
    // await expect.element(page.getByTestId('uc-img')).toBeVisible();
  });
});
