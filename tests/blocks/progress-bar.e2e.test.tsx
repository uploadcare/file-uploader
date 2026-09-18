import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { ProgressBar, ProgressBarCommon } from '@/index';
import { createInCtx, renderSolution, within } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

/**
 * `<uc-progress-bar>` and `<uc-progress-bar-common>` are both exported from the package index but neither appears in
 * a solution template, so nothing rendered them and both sat under 9% coverage. Both are rendered by hand here.
 */

/** Renders one bar with its own config and waits until the block has initialised, which is when it gets its test id. */
const renderBar = async (): Promise<ProgressBar> => {
  const ctxName = getCtxName();
  page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
  const bar = createInCtx<ProgressBar>('uc-progress-bar', ctxName);
  page.render(bar);
  await expect.poll(() => bar.getAttribute('data-testid')).toBe('uc-progress-bar');
  await bar.updateComplete;

  return bar;
};

const progressValue = (bar: ProgressBar) => bar.style.getPropertyValue('--l-progress-value');

/** Lit batches property changes into one update; `updateComplete` resolves once `updated()` has run for it. */
const set = async (bar: ProgressBar, props: Partial<Pick<ProgressBar, 'value' | 'visible'>>) => {
  Object.assign(bar, props);
  await bar.updateComplete;
};

describe('uc-progress-bar', () => {
  it('publishes the value as a CSS custom property', async () => {
    const bar = await renderBar();

    await set(bar, { value: 40 });

    expect(progressValue(bar)).toBe('40');
  });

  it('clamps out-of-range values', async () => {
    const bar = await renderBar();

    await set(bar, { value: 150 });
    expect(progressValue(bar)).toBe('100');

    // Going down is refused while visible, so the floor is checked on a fresh bar below.
    const other = await renderBar();
    await set(other, { value: -20 });
    expect(progressValue(other)).toBe('0');
  });

  it('treats a non-finite value as zero', async () => {
    const bar = await renderBar();

    await set(bar, { value: Number.NaN });

    expect(progressValue(bar)).toBe('0');
  });

  it('never moves backwards while visible', async () => {
    const bar = await renderBar();

    await set(bar, { value: 60 });
    await set(bar, { value: 20 });

    // Progress only grows: a lower report is ignored rather than rewinding the bar.
    expect(progressValue(bar)).toBe('60');
  });

  it('accepts a lower value again once hidden', async () => {
    const bar = await renderBar();

    await set(bar, { value: 60 });
    await set(bar, { visible: false });

    // The lower value has to land while the bar is still hidden. Setting `value` and `visible` in the same tick
    // batches both into one update, and the `value` branch then sees the bar as already visible and keeps the
    // higher figure (ProgressBar.ts:50).
    await set(bar, { value: 20 });
    await set(bar, { visible: true });

    expect(progressValue(bar)).toBe('20');
  });

  it('marks itself hidden through a class and the attribute', async () => {
    const bar = await renderBar();

    await set(bar, { visible: false });
    expect(bar.classList.contains('uc-progress-bar--hidden')).toBe(true);
    expect(bar.hasAttribute('visible')).toBe(false);

    await set(bar, { visible: true });
    expect(bar.classList.contains('uc-progress-bar--hidden')).toBe(false);
    expect(bar.hasAttribute('visible')).toBe(true);
  });
});

describe('uc-progress-bar-common', () => {
  /** The common bar reads the ctx's upload state, so it sits next to a real uploader. */
  const renderCommon = async () => {
    const { ctxName } = await renderSolution('regular');
    const common = createInCtx<ProgressBarCommon>('uc-progress-bar-common', ctxName);
    page.render(common);
    await expect.poll(() => common.getAttribute('data-testid')).toBe('uc-progress-bar-common');
    await common.updateComplete;

    return common;
  };

  it('renders a progress bar', async () => {
    const common = await renderCommon();

    expect(within(common).getByTestId('uc-progress-bar').query()).not.toBe(null);
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
