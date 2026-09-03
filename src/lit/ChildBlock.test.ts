import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../abstract/controllers/ConfigController';
import type { Token } from '../abstract/di/ControllerContainer';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { ChildBlock } from './ChildBlock';

// ─── Test-only ChildBlock subclasses ──────────────────────────────────────────
class UseBlock extends ChildBlock {
  public callUse<T>(token: Token<T>): T {
    return this.container.get(token);
  }
  public callUseOrNull<T>(token: Token<T>): T | null {
    return this.useOrNull(token);
  }
  public override render() {
    return html``;
  }
}
UseBlock.reg('uc-test-use-block');

// ─── Harness ──────────────────────────────────────────────────────────────────
let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `childblock-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

const mount = async <T extends HTMLElement>(tag: string, ctxName: string): Promise<T> => {
  const el = document.createElement(tag) as T & { updateComplete: Promise<unknown> };
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return el;
};

// `setTimeout(0)` teardown deferral + a microtask margin.
const flushTeardown = () => new Promise((r) => setTimeout(r, 10));

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

describe('ChildBlock.container', () => {
  it('throws when the container is not adopted yet', () => {
    const el = document.createElement('uc-test-use-block') as UseBlock;
    mounted.push(el);
    expect(() => el.callUse(ConfigController)).toThrow(/container is not available/);
  });

  it('resolves a controller from the ctx container after adoption', async () => {
    const ctxName = freshCtxName();
    const el = await mount<UseBlock>('uc-test-use-block', ctxName);

    const config = el.callUse(ConfigController);
    expect(config).toBeInstanceOf(ConfigController);
    // Same singleton the container owns for this ctx.
    expect(config).toBe(UploaderRegistry.get(ctxName)?.get(ConfigController));
  });
});

describe('ChildBlock.useOrNull()', () => {
  it('returns null when the container is not adopted yet', () => {
    const el = document.createElement('uc-test-use-block') as UseBlock;
    mounted.push(el);
    expect(el.callUseOrNull(ConfigController)).toBeNull();
  });

  it('resolves the same singleton as container.get() after adoption', async () => {
    const ctxName = freshCtxName();
    const el = await mount<UseBlock>('uc-test-use-block', ctxName);

    const viaOrNull = el.callUseOrNull(ConfigController);
    expect(viaOrNull).toBeInstanceOf(ConfigController);
    expect(viaOrNull).toBe(el.callUse(ConfigController));
  });

  it('returns null again after the block is released (teardown-race guard)', async () => {
    const ctxName = freshCtxName();
    const el = await mount<UseBlock>('uc-test-use-block', ctxName);
    expect(el.callUseOrNull(ConfigController)).not.toBeNull();

    el.remove(); // synchronous _releaseController nulls the container

    expect(el.callUseOrNull(ConfigController)).toBeNull();
  });
});

describe('ChildBlock consumer lifecycle (M-god step 6a)', () => {
  it('registers as a container consumer on adoption', async () => {
    const ctxName = freshCtxName();
    await mount<UseBlock>('uc-test-use-block', ctxName);

    const container = UploaderRegistry.get(ctxName);
    expect(container).not.toBeNull();
    expect(container?.isUnreferenced()).toBe(false);
  });

  it('drops the container consumer on disconnect', async () => {
    const ctxName = freshCtxName();
    const el = await mount<UseBlock>('uc-test-use-block', ctxName);
    const container = UploaderRegistry.get(ctxName);

    el.remove(); // synchronous _releaseController → removeConsumer

    // The captured container reports itself unreferenced (consumer dropped;
    // dispose, when it fires, also clears the set).
    expect(container?.isUnreferenced()).toBe(true);
  });

  it('tears the ctx down after the last consumer disconnects', async () => {
    const ctxName = freshCtxName();
    const el = await mount<UseBlock>('uc-test-use-block', ctxName);
    expect(UploaderRegistry.get(ctxName)).toBeDefined();

    el.remove();
    await flushTeardown();

    expect(UploaderRegistry.get(ctxName)).toBeUndefined();
    expect(UploaderRegistry.get(ctxName)).toBeUndefined();
  });

  it('keeps the ctx alive while another consumer stays connected', async () => {
    const ctxName = freshCtxName();
    const a = await mount<UseBlock>('uc-test-use-block', ctxName);
    const b = await mount<UseBlock>('uc-test-use-block', ctxName);
    const container = UploaderRegistry.get(ctxName);

    a.remove();
    await flushTeardown();

    expect(UploaderRegistry.get(ctxName)).toBeDefined();
    expect(container?.isUnreferenced()).toBe(false);

    b.remove();
    await flushTeardown();

    expect(UploaderRegistry.get(ctxName)).toBeUndefined();
  });
});

// `ChildBlock.subRouter()` was removed (signals migration) — blocks read router
// state reactively via `SignalWatcher`; its former contract is covered by the
// router's own tests.
