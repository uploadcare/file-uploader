import { afterEach, describe, expect, it } from 'vitest';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { Spinner } from './Spinner';

// Idempotent registration (same path as defineComponents(UC)).
Spinner.reg('uc-spinner');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `spinner-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) {
    el.remove();
  }
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (): Promise<Spinner> => {
  const ctxName = freshCtxName();
  ensureUploaderCtx(ctxName);
  const el = document.createElement('uc-spinner') as Spinner;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

describe('Spinner', () => {
  it('renders and is visible in the DOM', async () => {
    const el = await mount();
    expect(el).toBeTruthy();
    const spinnerDiv = el.querySelector('.uc-spinner');
    expect(spinnerDiv).toBeTruthy();
  });

  it('applies CSS animation class to the spinner div', async () => {
    const el = await mount();
    const spinnerDiv = el.querySelector('.uc-spinner');
    expect(spinnerDiv).toBeTruthy();
    expect(spinnerDiv!.className).toBe('uc-spinner');
  });

  it('renders a div element with correct structure', async () => {
    const el = await mount();
    const spinnerDiv = el.querySelector('.uc-spinner');
    expect(spinnerDiv?.tagName).toBe('DIV');
  });

  it('works when nested inside other elements', async () => {
    const container = document.createElement('div');
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const el = document.createElement('uc-spinner') as Spinner;
    el.setAttribute('ctx-name', ctxName);
    container.append(el);
    document.body.append(container);
    mounted.push(container);
    await el.updateComplete;

    const spinnerDiv = el.querySelector('.uc-spinner');
    expect(spinnerDiv).toBeTruthy();
    expect(container.contains(el)).toBe(true);
  });

  it('multiple spinners can coexist independently', async () => {
    const el1 = await mount();
    const el2 = await mount();
    const spinner1 = el1.querySelector('.uc-spinner');
    const spinner2 = el2.querySelector('.uc-spinner');

    expect(spinner1).toBeTruthy();
    expect(spinner2).toBeTruthy();
    expect(spinner1).not.toBe(spinner2);
  });

  it('renders as light DOM (not shadow DOM)', async () => {
    const el = await mount();
    const spinnerDiv = el.querySelector('.uc-spinner');
    expect(spinnerDiv?.parentElement).toBe(el);
    expect(el.shadowRoot).toBeNull();
  });

  it('can have custom styling applied', async () => {
    const el = await mount();
    el.style.color = 'rgb(255, 0, 0)';
    el.style.fontSize = '24px';
    await el.updateComplete;

    const spinnerDiv = el.querySelector('.uc-spinner');
    expect(spinnerDiv).toBeTruthy();
    expect(el.style.color).toBe('rgb(255, 0, 0)');
    expect(el.style.fontSize).toBe('24px');
  });

  it('survives removal and re-addition to DOM', async () => {
    const el = await mount();
    const spinnerDiv = el.querySelector('.uc-spinner');
    expect(spinnerDiv).toBeTruthy();

    el.remove();
    expect(el.parentElement).toBeNull();

    document.body.append(el);
    await el.updateComplete;

    const spinnerDivAfter = el.querySelector('.uc-spinner');
    expect(spinnerDivAfter).toBeTruthy();
  });
});
