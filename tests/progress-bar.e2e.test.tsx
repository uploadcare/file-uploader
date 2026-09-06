import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { ProgressBar } from '@/index';
import { delay } from '@/utils/delay';
import { getCtxName } from './utils/test-renderer';
import '../types/jsx';

/**
 * `<uc-progress-bar>` and `<uc-progress-bar-common>` are both exported from the package index but neither appears in
 * a solution template, so nothing rendered them and both sat under 9% coverage.
 */

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const renderBar = async (): Promise<ProgressBar> => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
      <div data-testid="bar-host" ctx-name={ctxName}></div>
    </>,
  );
  // Scoped by ctx-name, not testid: `page.render` appends, so a test that renders two bars would have two hosts.
  const host = document.querySelector(`[data-testid="bar-host"][ctx-name="${ctxName}"]`) as HTMLElement;
  host.innerHTML = `<uc-progress-bar ctx-name="${ctxName}"></uc-progress-bar>`;
  await delay(50);

  return host.querySelector('uc-progress-bar') as ProgressBar;
};

const progressValue = (bar: ProgressBar) => bar.style.getPropertyValue('--l-progress-value');

describe('uc-progress-bar', () => {
  it('publishes the value as a CSS custom property', async () => {
    const bar = await renderBar();

    bar.value = 40;
    await delay(50);

    expect(progressValue(bar)).toBe('40');
  });

  it('clamps out-of-range values', async () => {
    const bar = await renderBar();

    bar.value = 150;
    await delay(50);
    expect(progressValue(bar)).toBe('100');

    // Going down is refused while visible, so the floor is checked on a fresh bar below.
    const other = await renderBar();
    other.value = -20;
    await delay(50);
    expect(progressValue(other)).toBe('0');
  });

  it('treats a non-finite value as zero', async () => {
    const bar = await renderBar();

    bar.value = Number.NaN;
    await delay(50);

    expect(progressValue(bar)).toBe('0');
  });

  it('never moves backwards while visible', async () => {
    const bar = await renderBar();

    bar.value = 60;
    await delay(50);
    bar.value = 20;
    await delay(50);

    // Progress only grows: a lower report is ignored rather than rewinding the bar.
    expect(progressValue(bar)).toBe('60');
  });

  it('accepts a lower value again once hidden', async () => {
    const bar = await renderBar();

    bar.value = 60;
    await delay(50);
    bar.visible = false;
    await delay(50);

    // The lower value has to land while the bar is still hidden. Setting `value` and `visible` in the same tick
    // batches both into one update, and the `value` branch then sees the bar as already visible and keeps the
    // higher figure (ProgressBar.ts:50).
    bar.value = 20;
    await delay(50);
    bar.visible = true;
    await delay(50);

    expect(progressValue(bar)).toBe('20');
  });

  it('marks itself hidden through a class and the attribute', async () => {
    const bar = await renderBar();

    bar.visible = false;
    await delay(50);
    expect(bar.classList.contains('uc-progress-bar--hidden')).toBe(true);
    expect(bar.hasAttribute('visible')).toBe(false);

    bar.visible = true;
    await delay(50);
    expect(bar.classList.contains('uc-progress-bar--hidden')).toBe(false);
    expect(bar.hasAttribute('visible')).toBe(true);
  });
});

describe('uc-progress-bar-common', () => {
  const renderCommon = async () => {
    const ctxName = getCtxName();
    page.render(
      <>
        <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
        <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
        <div data-testid="common-host" ctx-name={ctxName}></div>
      </>,
    );
    const host = document.querySelector(`[data-testid="common-host"][ctx-name="${ctxName}"]`) as HTMLElement;
    host.innerHTML = `<uc-progress-bar-common ctx-name="${ctxName}"></uc-progress-bar-common>`;
    await delay(100);

    return host.querySelector('uc-progress-bar-common') as HTMLElement;
  };

  it('renders a progress bar', async () => {
    const common = await renderCommon();

    expect(common.querySelector('uc-progress-bar')).not.toBe(null);
  });

  // QUIRK(progress): `updated()` gates the `active` attribute on `changedProperties.has('visible')`, but the field is
  // the private `@state() _visible` (ProgressBarCommon.ts:49) — Lit records `_visible`, so the branch never runs and
  // `active` is never set or removed. The `'visible' as keyof ProgressBarCommon` cast in that line is what let the
  // wrong key typecheck. Pinned as current behaviour, not endorsed.
  it('never gets the active attribute, whatever the state', async () => {
    const common = await renderCommon();

    expect(common.hasAttribute('active')).toBe(false);
  });
});
