import { html } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../abstract/controllers/ConfigController';
import type { Token } from '../abstract/di/ControllerContainer';
import { ChildBlock } from './ChildBlock';
import { PubSub } from './PubSubCompat';

// ─── Test-only controllers (zero-arg ctors, container-constructable) ──────────
class ProbeController {
  public static instances = 0;
  public constructor() {
    ProbeController.instances++;
  }
}

class ThrowingController {
  public constructor() {
    throw new Error('boom in ctor');
  }
}

// ─── Test-only ChildBlock subclasses ──────────────────────────────────────────
class UseBlock extends ChildBlock {
  public callUse<T>(token: Token<T>): T {
    return this.use(token);
  }
  public override render() {
    return html``;
  }
}
UseBlock.reg('uc-test-use-block');

class PrewarmBlock extends ChildBlock {
  public static override readonly uses = [ProbeController] as const;
  public override render() {
    return html``;
  }
}
PrewarmBlock.reg('uc-test-prewarm-block');

class ThrowingPrewarmBlock extends ChildBlock {
  public static override readonly uses = [ThrowingController] as const;
  public override render() {
    return html``;
  }
}
ThrowingPrewarmBlock.reg('uc-test-throwing-prewarm-block');

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
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

describe('ChildBlock.use()', () => {
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
    expect(config).toBe(PubSub.getContainer(ctxName)?.get(ConfigController));
  });
});

describe('ChildBlock consumer lifecycle (M-god step 6a)', () => {
  it('registers as a container consumer on adoption', async () => {
    const ctxName = freshCtxName();
    await mount<UseBlock>('uc-test-use-block', ctxName);

    const container = PubSub.getContainer(ctxName);
    expect(container).not.toBeNull();
    expect(container?.isUnreferenced()).toBe(false);
  });

  it('drops the container consumer on disconnect', async () => {
    const ctxName = freshCtxName();
    const el = await mount<UseBlock>('uc-test-use-block', ctxName);
    const container = PubSub.getContainer(ctxName);

    el.remove(); // synchronous _releaseController → removeConsumer

    // The captured container reports itself unreferenced (consumer dropped;
    // dispose, when it fires, also clears the set).
    expect(container?.isUnreferenced()).toBe(true);
  });

  it('tears the ctx down after the last consumer disconnects', async () => {
    const ctxName = freshCtxName();
    const el = await mount<UseBlock>('uc-test-use-block', ctxName);
    expect(PubSub.hasCtx(ctxName)).toBe(true);

    el.remove();
    await flushTeardown();

    expect(PubSub.hasCtx(ctxName)).toBe(false);
    expect(PubSub.getContainer(ctxName)).toBeNull();
  });

  it('keeps the ctx alive while another consumer stays connected', async () => {
    const ctxName = freshCtxName();
    const a = await mount<UseBlock>('uc-test-use-block', ctxName);
    const b = await mount<UseBlock>('uc-test-use-block', ctxName);
    const container = PubSub.getContainer(ctxName);

    a.remove();
    await flushTeardown();

    expect(PubSub.hasCtx(ctxName)).toBe(true);
    expect(container?.isUnreferenced()).toBe(false);

    b.remove();
    await flushTeardown();

    expect(PubSub.hasCtx(ctxName)).toBe(false);
  });
});

describe('ChildBlock static uses pre-warm', () => {
  it('resolves declared dependencies from the container on adoption', async () => {
    const ctxName = freshCtxName();
    const before = ProbeController.instances;

    await mount('uc-test-prewarm-block', ctxName);

    const container = PubSub.getContainer(ctxName);
    expect(container?.has(ProbeController)).toBe(true);
    expect(ProbeController.instances).toBe(before + 1);
  });

  it('isolates a throwing pre-warm: adoption still completes and the block renders', async () => {
    const ctxName = freshCtxName();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const el = await mount('uc-test-throwing-prewarm-block', ctxName);

    expect(el.isConnected).toBe(true);
    expect(warn.mock.calls.some((c) => String(c[0]).includes('pre-warming a declared dependency'))).toBe(true);

    warn.mockRestore();
  });
});
