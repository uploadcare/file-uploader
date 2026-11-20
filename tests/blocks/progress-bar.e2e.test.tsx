import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { ProgressBar, ProgressBarCommon } from '@/index';
import { withResolvers } from '@/utils/withResolvers';
import { IMAGE } from '~/tests/fixtures/files';
import { emulatorSession, isLive } from '~/tests/utils/emulator.browser';
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
    // higher figure (`ProgressBar.updated`).
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
    const { ctxName, api } = await renderSolution('regular');
    const common = createInCtx<ProgressBarCommon>('uc-progress-bar-common', ctxName);
    page.render(common);
    await expect.poll(() => common.getAttribute('data-testid')).toBe('uc-progress-bar-common');
    await common.updateComplete;

    return { common, api };
  };

  it('renders a progress bar', async () => {
    const { common } = await renderCommon();

    expect(within(common).getByTestId('uc-progress-bar').query()).not.toBe(null);
  });

  // The stylesheet hides the bar unless the host carries `active`, so the attribute is what makes it visible at all.
  it('carries the active attribute only while an upload runs', async () => {
    const { common, api } = await renderCommon();
    expect(common.hasAttribute('active')).toBe(false);
    // The emulator answers within a task, before a poll would see the upload running, so it holds the upload until
    // the bar has been seen active. Live, the real API is slow enough on its own.
    const released = withResolvers();
    if (!isLive) {
      emulatorSession().on('POST /base/', async ({ next }) => {
        await released.promise;
        return next();
      });
    }

    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await expect.poll(() => common.hasAttribute('active')).toBe(true);
    released.resolve();
    await expect.poll(() => api.getOutputCollectionState().successCount).toBe(1);
    await expect.poll(() => common.hasAttribute('active')).toBe(false);
  });
});
