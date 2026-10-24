import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { ProgressBar } from '@/index.ts';
import { getCtxName } from '../utils/getCtxName';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

const renderBar = () => {
  const ctxName = getCtxName();
  page.render(
    <>
      <uc-progress-bar ctx-name={ctxName}></uc-progress-bar>
      <uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
    </>,
  );
  const bar = document.querySelector('uc-progress-bar')! as ProgressBar;
  return { bar };
};

const progressVar = (bar: ProgressBar) => bar.style.getPropertyValue('--l-progress-value');

describe('uc-progress-bar', () => {
  it('renders the progress structure', async () => {
    renderBar();
    await expect.poll(() => document.querySelector('uc-progress-bar .uc-progress')).toBeTruthy();
    expect(document.querySelector('uc-progress-bar .uc-fake-progress')).toBeTruthy();
  });

  it('reflects value into --l-progress-value and never moves backward while visible', async () => {
    const { bar } = renderBar();
    bar.value = 30;
    await expect.poll(() => progressVar(bar)).toBe('30');
    bar.value = 10;
    // monotonic: stays at 30 while visible
    await expect.poll(() => progressVar(bar)).toBe('30');
    bar.value = 55;
    await expect.poll(() => progressVar(bar)).toBe('55');
  });

  it('clamps non-finite and out-of-range values', async () => {
    const { bar } = renderBar();
    bar.value = 150;
    await expect.poll(() => progressVar(bar)).toBe('100');

    // reset via hide (progress resets to the normalized current value).
    // Each property set must flush its own Lit update cycle (synchronous
    // writes in the same tick would batch into a single `updated()` pass
    // that only sees the final `visible`/`value`, masking the reset).
    bar.visible = false;
    await bar.updateComplete;
    bar.value = Number.NaN;
    await bar.updateComplete;
    bar.visible = true;
    await expect.poll(() => progressVar(bar)).toBe('0');

    bar.visible = false;
    await bar.updateComplete;
    bar.value = -5;
    await bar.updateComplete;
    bar.visible = true;
    await expect.poll(() => progressVar(bar)).toBe('0');
  });

  it('toggles the hidden class and resets progress when hidden', async () => {
    const { bar } = renderBar();
    bar.value = 40;
    await expect.poll(() => progressVar(bar)).toBe('40');

    bar.visible = false;
    await expect.poll(() => bar.classList.contains('uc-progress-bar--hidden')).toBe(true);

    // Setting `value` while still hidden, then flushing before flipping
    // `visible` back — flipping both in the same tick would let the
    // `value` branch see the already-true `visible` and skip the reset.
    bar.value = 20;
    await bar.updateComplete;
    bar.visible = true;
    await expect.poll(() => bar.classList.contains('uc-progress-bar--hidden')).toBe(false);
    // reset happened while hidden: 20 replaces the old 40
    await expect.poll(() => progressVar(bar)).toBe('20');
  });

  it('hides the fake-progress line once a real value arrives (on animation iteration)', async () => {
    const { bar } = renderBar();
    const fakeLine = () => document.querySelector('uc-progress-bar .uc-fake-progress')!;
    await expect.poll(() => fakeLine()).toBeTruthy();
    expect(fakeLine().classList.contains('uc-fake-progress--hidden')).toBe(false);

    bar.value = 10;
    await expect.poll(() => progressVar(bar)).toBe('10');
    fakeLine().dispatchEvent(new Event('animationiteration'));
    await expect.poll(() => fakeLine().classList.contains('uc-fake-progress--hidden')).toBe(true);
  });

  it('hides the fake-progress line when not visible (on animation iteration)', async () => {
    const { bar } = renderBar();
    const fakeLine = () => document.querySelector('uc-progress-bar .uc-fake-progress')!;
    bar.visible = false;
    await expect.poll(() => bar.classList.contains('uc-progress-bar--hidden')).toBe(true);
    fakeLine().dispatchEvent(new Event('animationiteration'));
    await expect.poll(() => fakeLine().classList.contains('uc-fake-progress--hidden')).toBe(true);
  });

  it('applies visibility while gated before a ctx-name is assigned', async () => {
    const ctxName = getCtxName();
    // Mount the bar with NO ctx-name at all — `ChildBlock` only self-bootstraps
    // (and adopts a controller) once a ctx-name resolves, so this is the
    // still-reachable gated window post self-bootstrap. Set properties while
    // gated — the scheduled update flushes gated, so Lit clears changedProperties.
    const bar = document.createElement('uc-progress-bar');
    document.body.append(bar);
    await bar.updateComplete;
    bar.visible = false;
    bar.value = 30;
    await bar.updateComplete;
    // Still gated: none of the pre-adoption writes reached a real render —
    // the hidden class from `visible = false` above never got applied
    // because `updated()` never ran while the gate stayed closed (no
    // ctx-name means `_watchRegistry` never self-bootstraps a controller).
    expect(bar.classList.contains('uc-progress-bar--hidden')).toBe(false);

    // Now assign the ctx-name; this triggers `_watchRegistry` -> self-bootstrap
    // -> the ctx is created and the bar adopts. It must reflect the hidden
    // state it was given pre-adoption, not the stale defaults.
    bar.setAttribute('ctx-name', ctxName);
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    await expect.poll(() => bar.classList.contains('uc-progress-bar--hidden')).toBe(true);
    await expect.poll(() => progressVar(bar)).toBe('');
    bar.remove();
  });
});
