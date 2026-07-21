import { html } from 'lit';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { AppInfo } from '@/abstract/controllers/AppInfo';
import { ClipboardController } from '@/abstract/controllers/ClipboardController';
import { LazyPluginsController } from '@/abstract/controllers/LazyPluginsController';
import { A11y } from '@/abstract/managers/a11y';
import type { LazyPluginEntry } from '@/abstract/managers/plugin/LazyPluginLoader';
import { SolutionChildBlock } from '@/lit/SolutionChildBlock';
import { getCtxName } from '../utils/getCtxName';
import { containerOf } from '../utils/registry';
import '../../types/jsx';

const testLazyPlugins: LazyPluginEntry[] = [
  {
    configDeps: [],
    isEnabled: () => true,
    load: () => undefined,
  },
];

class TestSolutionChild extends SolutionChildBlock {
  public static override lazyPlugins = testLazyPlugins;
  public readyCount = 0;

  protected override controllerReady(...args: Parameters<SolutionChildBlock['controllerReady']>): void {
    super.controllerReady(...args);
    this.readyCount += 1;
  }

  public override render() {
    return html`${super.render()}<span class="marker">solution-child</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-test-solution-child': TestSolutionChild;
  }
}

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
  if (!customElements.get('uc-test-solution-child')) {
    customElements.define('uc-test-solution-child', TestSolutionChild);
  }
});

const appended: HTMLElement[] = [];
const append = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) => {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  appended.push(el);
  return el;
};

afterEach(() => {
  for (const el of appended) el.remove();
  appended.length = 0;
});

describe('SolutionChildBlock', () => {
  it('registers the a11y block + clipboard scope, sets the solution name, and publishes lazyPlugins on adoption', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);

    const container = containerOf(ctxName);
    const registerBlockSpy = vi.spyOn(container.get(A11y), 'registerBlock');
    const registerScopeSpy = vi.spyOn(container.get(ClipboardController), 'registerScope');

    const child = append('uc-test-solution-child', { 'ctx-name': ctxName });

    await expect.poll(() => child.readyCount).toBe(1);
    expect(container.get(AppInfo).solutionName).toBe('uc-test-solution-child');
    expect(registerBlockSpy).toHaveBeenCalledWith(child);
    expect(registerScopeSpy).toHaveBeenCalledWith(child);
    expect(container.get(LazyPluginsController).get()).toBe(testLazyPlugins);
    // The svg-sprite render path (mirrors LitSolutionBlock.render).
    expect(child.querySelector('.marker')?.textContent).toBe('solution-child');
  });

  it('releases the clipboard scope on disconnect and re-registers a fresh one on reconnect (re-adoption)', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const container = containerOf(ctxName);

    const unregister = vi.fn();
    const registerScopeSpy = vi.spyOn(container.get(ClipboardController), 'registerScope').mockReturnValue(unregister);

    const child = append('uc-test-solution-child', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);
    expect(registerScopeSpy).toHaveBeenCalledTimes(1);
    expect(unregister).not.toHaveBeenCalled();

    child.remove();
    expect(unregister).toHaveBeenCalledTimes(1);

    document.body.append(child);
    await expect.poll(() => child.readyCount).toBe(2);
    // Re-adoption re-registers a fresh scope rather than reusing/stacking.
    expect(registerScopeSpy).toHaveBeenCalledTimes(2);
    // Only the first scope's unregister fired so far (from the disconnect
    // above) — re-adoption must not double-release it.
    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('releases the a11y scope (unregisterBlock) on disconnect and re-registers on reconnect (re-adoption)', async () => {
    const ctxName = getCtxName();
    page.render(<uc-config ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>);
    const container = containerOf(ctxName);

    const registerBlockSpy = vi.spyOn(container.get(A11y), 'registerBlock');
    const unregisterBlockSpy = vi.spyOn(container.get(A11y), 'unregisterBlock');

    const child = append('uc-test-solution-child', { 'ctx-name': ctxName });
    await expect.poll(() => child.readyCount).toBe(1);
    expect(registerBlockSpy).toHaveBeenCalledWith(child);
    expect(unregisterBlockSpy).not.toHaveBeenCalled();

    // The load-bearing fix: on disconnect the a11y scope is released (previously
    // it leaked until ctx teardown — there was no unregisterBlock at all).
    child.remove();
    expect(unregisterBlockSpy).toHaveBeenCalledWith(child);
    expect(unregisterBlockSpy).toHaveBeenCalledTimes(1);

    document.body.append(child);
    await expect.poll(() => child.readyCount).toBe(2);
    // Re-adoption re-registers rather than stacking; no extra release.
    expect(registerBlockSpy).toHaveBeenCalledTimes(2);
    expect(unregisterBlockSpy).toHaveBeenCalledTimes(1);
  });
});
