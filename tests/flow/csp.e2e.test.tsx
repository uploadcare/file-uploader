import { beforeAll, describe, expect, it } from 'vitest';
import { renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * The Content-Security-Policy that security.mdx recommends: no `'unsafe-inline'`, so the browser drops every inline
 * `style` attribute while styles set through CSSOM (`el.style.x = …`) still apply. A meta CSP inserted at runtime is
 * enforced from that point on, and the page's stylesheets were all inserted before it, during setup.
 */
beforeAll(() => {
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = "style-src 'self' blob:";
  document.head.append(meta);
});

describe('under the documented CSP', () => {
  it('sizes the upload list spacers, so every file can be scrolled to', async () => {
    // The modal bounds the list's height, so `.uc-files` scrolls and the list virtualizes.
    const { api, root } = await renderSolution('regular', { confirmUpload: true, multipleMax: 1000 });
    for (let i = 0; i < 300; i++) {
      api.addFileFromObject(new File(['x'], `f${i}.txt`, { type: 'text/plain' }));
    }
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    await expect.element(within(root).getByTestId('uc-upload-list')).toBeVisible();

    await expect.poll(() => root.querySelector('.uc-list-spacer')).not.toBeNull();
    const spacer = root.querySelector<HTMLElement>('.uc-list-spacer')!;
    expect(spacer.style.height).not.toBe('');
    // Spacer heights come from measured rows and can be fractional, which layout rounds to 1/64 px.
    expect(spacer.getBoundingClientRect().height).toBeCloseTo(Number.parseFloat(spacer.style.height), 0);

    const files = root.querySelector<HTMLElement>('.uc-files')!;
    files.scrollTop = files.scrollHeight;
    await expect.poll(() => root.querySelector('uc-file-item:last-of-type')?.textContent).toContain('f299.txt');
  });
});
