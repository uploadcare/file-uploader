import { afterEach, describe, expect, it } from 'vitest';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { ProgressBar } from './ProgressBar';

// Idempotent (same path as defineComponents(UC)).
ProgressBar.reg('uc-progress-bar');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `progress-bar-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (ctxName: string): Promise<ProgressBar> => {
  ensureUploaderCtx(ctxName);
  const el = document.createElement('uc-progress-bar') as ProgressBar;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

describe('ProgressBar', () => {
  it('renders with default value of 0', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    expect(el.value).toBe(0);
    expect(el.style.getPropertyValue('--l-progress-value')).toBe('0');
  });

  it('displays value as width percentage using CSS custom property', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 50;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('50');

    el.value = 75;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('75');
  });

  it('reacts to value prop changes and updates progress style', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 25;
    await el.updateComplete;
    expect(el.style.getPropertyValue('--l-progress-value')).toBe('25');

    el.value = 60;
    await el.updateComplete;
    expect(el.style.getPropertyValue('--l-progress-value')).toBe('60');

    el.value = 100;
    await el.updateComplete;
    expect(el.style.getPropertyValue('--l-progress-value')).toBe('100');
  });

  it('handles edge case: value of 0%', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 0;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('0');
  });

  it('handles edge case: value of 100%', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 100;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('100');
  });

  it('handles edge case: negative values are clamped to 0', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = -10;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('0');

    el.value = -100;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('0');
  });

  it('handles edge case: values > 100 are clamped to 100', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 150;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('100');

    el.value = 500;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('100');
  });

  it('handles edge case: NaN is normalized to 0', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = Number.NaN;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('0');
  });

  it('handles edge case: Infinity is normalized to 100', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = Number.POSITIVE_INFINITY;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('100');

    el.visible = false;
    await el.updateComplete;
    el.value = Number.NEGATIVE_INFINITY;
    await el.updateComplete;
    el.visible = true;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('0');
  });

  it('sets ARIA role=progressbar on fake-progress element', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    const fakeProgress = el.querySelector('.uc-fake-progress');
    expect(fakeProgress?.getAttribute('role')).toBe('progressbar');
  });

  it('sets aria-valuenow attribute matching current progress value', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 33;
    await el.updateComplete;

    const fakeProgress = el.querySelector('.uc-fake-progress');
    expect(fakeProgress?.getAttribute('aria-valuenow')).toBe('33');

    el.value = 67;
    await el.updateComplete;

    expect(fakeProgress?.getAttribute('aria-valuenow')).toBe('67');
  });

  it('sets aria-valuemin to 0 and aria-valuemax to 100', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    const fakeProgress = el.querySelector('.uc-fake-progress');
    expect(fakeProgress?.getAttribute('aria-valuemin')).toBe('0');
    expect(fakeProgress?.getAttribute('aria-valuemax')).toBe('100');
  });

  it('updates aria-valuenow when value changes', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    const fakeProgress = el.querySelector('.uc-fake-progress');

    el.value = 10;
    await el.updateComplete;
    expect(fakeProgress?.getAttribute('aria-valuenow')).toBe('10');

    el.value = 50;
    await el.updateComplete;
    expect(fakeProgress?.getAttribute('aria-valuenow')).toBe('50');

    el.value = 99;
    await el.updateComplete;
    expect(fakeProgress?.getAttribute('aria-valuenow')).toBe('99');
  });

  it('applies uc-progress-bar--hidden class when visible is false', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    expect(el.classList.contains('uc-progress-bar--hidden')).toBe(false);

    el.visible = false;
    await el.updateComplete;

    expect(el.classList.contains('uc-progress-bar--hidden')).toBe(true);
  });

  it('removes uc-progress-bar--hidden class when visible is true', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.visible = false;
    await el.updateComplete;
    expect(el.classList.contains('uc-progress-bar--hidden')).toBe(true);

    el.visible = true;
    await el.updateComplete;

    expect(el.classList.contains('uc-progress-bar--hidden')).toBe(false);
  });

  it('maintains progress value when visibility toggles', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 45;
    await el.updateComplete;

    el.visible = false;
    await el.updateComplete;

    el.visible = true;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('45');
  });

  it('only increases progress value when visible (never decreases)', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 50;
    await el.updateComplete;
    expect(el.style.getPropertyValue('--l-progress-value')).toBe('50');

    // Attempt to set lower value while visible should not decrease
    el.value = 30;
    await el.updateComplete;
    expect(el.style.getPropertyValue('--l-progress-value')).toBe('50');

    // Setting higher value should increase
    el.value = 70;
    await el.updateComplete;
    expect(el.style.getPropertyValue('--l-progress-value')).toBe('70');
  });

  it('allows decreasing value when not visible', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 80;
    el.visible = false;
    await el.updateComplete;

    // When not visible, value can decrease
    el.value = 30;
    await el.updateComplete;

    // When made visible again, it uses the set value
    el.visible = true;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('30');
  });

  it('renders fake-progress and progress divs', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    const fakeProgress = el.querySelector('.uc-fake-progress');
    const progress = el.querySelector('.uc-progress');

    expect(fakeProgress).toBeTruthy();
    expect(progress).toBeTruthy();
  });

  it('updates property via attribute mutation', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.setAttribute('value', '42');
    await el.updateComplete;

    expect(el.value).toBe(42);
    expect(el.style.getPropertyValue('--l-progress-value')).toBe('42');
  });

  it('handles rapid consecutive value updates', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 10;
    el.value = 20;
    el.value = 30;
    el.value = 40;
    el.value = 50;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('50');
  });

  it('has visible property that defaults to true', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    expect(el.visible).toBe(true);
  });

  it('reflects visible property to attribute', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.visible = false;
    await el.updateComplete;

    expect(el.hasAttribute('visible')).toBe(false);

    el.visible = true;
    await el.updateComplete;

    expect(el.hasAttribute('visible')).toBe(true);
  });

  it('normalizes edge values in aria-valuenow', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    const fakeProgress = el.querySelector('.uc-fake-progress');

    // NaN should be normalized to 0
    el.value = Number.NaN;
    await el.updateComplete;
    expect(fakeProgress?.getAttribute('aria-valuenow')).toBe('0');

    // Over 100 should be clamped to 100
    el.value = 250;
    await el.updateComplete;
    expect(fakeProgress?.getAttribute('aria-valuenow')).toBe('100');

    // Negative should be clamped to 0
    el.visible = false;
    el.value = -50;
    await el.updateComplete;
    expect(fakeProgress?.getAttribute('aria-valuenow')).toBe('0');
  });

  it('handles float values correctly', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 33.33;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('33.33');

    el.value = 66.6;
    await el.updateComplete;

    expect(el.style.getPropertyValue('--l-progress-value')).toBe('66.6');
  });

  it('renders once with all required properties and attributes', async () => {
    const ctxName = freshCtxName();
    const el = await mount(ctxName);

    el.value = 45;
    await el.updateComplete;

    // Check element exists and has correct properties
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.tagName).toBe('UC-PROGRESS-BAR');

    // Check CSS custom property is set
    const cssValue = el.style.getPropertyValue('--l-progress-value');
    expect(cssValue).toBe('45');

    // Check ARIA attributes
    const fakeProgress = el.querySelector('.uc-fake-progress');
    expect(fakeProgress?.getAttribute('role')).toBe('progressbar');
    expect(fakeProgress?.getAttribute('aria-valuenow')).toBe('45');
    expect(fakeProgress?.getAttribute('aria-valuemin')).toBe('0');
    expect(fakeProgress?.getAttribute('aria-valuemax')).toBe('100');

    // Check visibility
    expect(el.visible).toBe(true);
    expect(el.classList.contains('uc-progress-bar--hidden')).toBe(false);
  });
});
