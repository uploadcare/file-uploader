import { describe, expect, it, vi } from 'vitest';

describe('unsplashPlugin module', () => {
  it('can be evaluated twice (two bundles, HMR) without redefining its element', async () => {
    await import('./unsplashPlugin');
    vi.resetModules();

    await expect(import('./unsplashPlugin')).resolves.toBeDefined();
    expect(customElements.get('uc-unsplash-activity')).toBeDefined();
  });
});
