import { EDITOR_IMAGE_UUID } from '@uploadcare/api-emulator';
import { beforeAll, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { page } from 'vitest/browser';
import { unsplashPlugin } from '@/plugins/unsplashPlugin';
import { emulatorSession, isLive } from '~/tests/utils/emulator.browser';
import { expectActivity, inCtx, renderSolution, type Solution, within } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

/**
 * Under the policy security.mdx documents (`style-src 'self'`, no `'unsafe-inline'`), a static `style="…"` in a
 * template still applies, because Lit clones it, but the browser reports a violation for it on every render: a console
 * error and a report-uri hit per uploader. Every static style lives in a stylesheet instead, so nothing is reported.
 * Styles set through CSSOM (`cssomStyleMap`, `el.style.x = …`) are not subject to the policy.
 */
const violations: SecurityPolicyViolationEvent[] = [];

beforeAll(() => {
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = "style-src 'self'";
  document.head.append(meta);
  document.addEventListener('securitypolicyviolation', (event) => violations.push(event));
});

beforeEach(() => {
  violations.length = 0;
});

/**
 * The violations reported for what was rendered so far. Reports arrive as queued tasks, so a style attribute set now
 * is the sentinel: once its report is in, every earlier one is too.
 */
const styleViolations = async () => {
  const sentinel = document.createElement('div');
  sentinel.setAttribute('style', 'color: red');
  document.body.append(sentinel);
  onTestFinished(() => sentinel.remove());
  await expect.poll(() => violations.some((event) => event.target === sentinel)).toBe(true);
  return violations
    .filter((event) => event.target !== sentinel && event.effectiveDirective.startsWith('style-src'))
    .map((event) => `${event.effectiveDirective} at ${event.sourceFile}:${event.lineNumber}`);
};

describe('under the documented CSP, no static inline style is reported', () => {
  it.each<Solution>(['regular', 'minimal', 'inline'])('%s solution with a file in the list', async (solution) => {
    const { api, root } = await renderSolution(solution, { confirmUpload: true });
    api.addFileFromObject(new File(['x'], 'a.txt', { type: 'text/plain' }));
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    await expect.poll(() => root.querySelector('uc-file-action-button .uc-preloader')).not.toBeNull();

    // The icon sprite stays out of the layout, and the progress ring keeps its dash and transition.
    const sprite = root.querySelector('svg:has(symbol#uc-icon-preloader)')!;
    expect(getComputedStyle(sprite).position).toBe('absolute');
    const ring = sprite.querySelector('#uc-icon-preloader circle')!;
    expect(getComputedStyle(ring).strokeDasharray).toBe('100px, 100px');
    expect(getComputedStyle(ring).transitionProperty).toBe('stroke-dashoffset');

    expect(await styleViolations()).toEqual([]);
  });

  it('the progress ring draws only its progress', async () => {
    // A document rule reaches the ring through `<use>`'s shadow copy only while it is not scoped under
    // `[uc-wgt-common]`: that copy has no such ancestor. The sprite's own `<symbol>` does, so reading its computed
    // style would pass with a scoped rule; the pixels on screen are what tell.
    const { root } = await renderSolution('regular');
    const darkestPixel = async (offset: number) => {
      const box = document.createElement('div');
      Object.assign(box.style, { display: 'inline-block', padding: '4px', background: '#fff', color: '#000' });
      const icon = document.createElement('uc-icon');
      icon.setAttribute('name', 'preloader');
      Object.assign(icon.style, { display: 'block', width: '96px', height: '96px' });
      icon.style.setProperty('--l-progress-offset', String(offset));
      box.append(icon);
      root.append(box);
      onTestFinished(() => box.remove());
      await expect.poll(() => icon.querySelector('svg use')).not.toBeNull();
      const base64 = await page.screenshot({ element: box, save: false });
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, image.width, image.height);
      let darkest = 255;
      for (let i = 0; i < data.length; i += 4) darkest = Math.min(darkest, data[i]!);
      return darkest;
    };

    // No progress leaves only the faint track (opacity 0.2); full progress draws the opaque ring.
    expect(await darkestPixel(100)).toBeGreaterThan(180);
    expect(await darkestPixel(0)).toBeLessThan(150);
  });

  it('the image editor', async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-cloud-image-editor uuid={EDITOR_IMAGE_UUID} ctx-name={ctxName}></uc-cloud-image-editor>
        <uc-config cdn-cname="https://ucarecdn.com/" ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      </>,
    );
    const editorEl = inCtx<HTMLElement>('uc-cloud-image-editor', ctxName);
    await expect.element(within(editorEl).getByRole('tab', { name: /filters/i })).toBeVisible();

    // Cancel sits before the tab toggles.
    const cancel = editorEl.querySelector('.uc-controls-row uc-btn-ui[icon="closeMax"]')!;
    expect(getComputedStyle(cancel).order).toBe('-1');
    expect(getComputedStyle(editorEl.querySelector('svg:has(symbol#uc-icon-crop)')!).position).toBe('absolute');

    expect(await styleViolations()).toEqual([]);
  });

  it.skipIf(isLive)('a plugin activity, with the unsplash spinner', async () => {
    // The photos never answer, so the activity stays on its loading spinner.
    emulatorSession().on({ host: 'api.unsplash.com', path: '/photos/random' }, () => new Promise<Response>(() => {}));
    const { api, root } = await renderSolution('regular', { plugins: [unsplashPlugin], unsplashAccessKey: 'key' });
    api.setCurrentActivity('unsplash-gallery');
    api.setModalState(true);
    await expectActivity(root, 'unsplash-gallery');

    const activity = root.querySelector('uc-unsplash-activity')!;
    await expect.poll(() => activity.querySelector('button.uc-ui-primary-btn svg')).not.toBeNull();
    const spinner = activity.querySelector('button.uc-ui-primary-btn svg')!;
    expect(getComputedStyle(spinner).animationName).toBe('uc-unsplash-spin');
    expect(getComputedStyle(activity.parentElement!).display).toBe('contents');

    expect(await styleViolations()).toEqual([]);
  });
});
