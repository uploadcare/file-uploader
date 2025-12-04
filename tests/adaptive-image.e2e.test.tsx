import { commands, page, userEvent } from '@vitest/browser/context';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import '../types/jsx';
// biome-ignore lint/correctness/noUnusedImports: Used in JSX
import { renderer } from './utils/test-renderer';

beforeAll(async () => {
  await import('@/solutions/adaptive-image/index.js');
});

beforeEach(() => {
  page.render(
    <div>
      <uc-img uuid="7124ae98-344c-42b2-ae2a-bd9aa79d76d8" width="500px"></uc-img>
    </div>,
  );
});

describe('Adaptive Image', () => {
  it('should be rendered', async () => {
    // await expect.element(page.getByTestId('uc-img')).toBeVisible();
  });
});
