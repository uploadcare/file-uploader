import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigController } from '../abstract/controllers/ConfigController';
import { RouterController } from '../abstract/controllers/RouterController';
import type { Token } from '../abstract/di/ControllerContainer';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { ACTIVITY_TYPES } from './activity-constants';
import { ChildBlock } from './ChildBlock';

// ─── Test-only ChildBlock subclasses ──────────────────────────────────────────
class UseBlock extends ChildBlock {
  public callUse<T>(token: Token<T>): T {
    return this.use(token);
  }
  public callUseOrNull<T>(token: Token<T>): T | null {
    return this.useOrNull(token);
  }
  public override render() {
    return html``;
  }
}
UseBlock.reg('uc-test-use-block');

// Exposes `subRouter` (protected) so a spec can assert its immediate-fire /
// fire-on-router-change / tear-down-on-release contract after M-god step 9b-1
// moved it off `bag.router` onto `use(RouterController)`.
class SubRouterBlock extends ChildBlock {
  public fires = 0;
  public callSubRouter(): () => void {
    return this.subRouter(() => {
      this.fires++;
    });
  }
  public override render() {
    return html``;
  }
}
SubRouterBlock.reg('uc-test-subrouter-block');

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
    expect(config).toBe(UploaderRegistry.get(ctxName)?.get(ConfigController));
  });
});

describe('ChildBlock.useOrNull()', () => {
  it('returns null when the container is not adopted yet', () => {
    const el = document.createElement('uc-test-use-block') as UseBlock;
    mounted.push(el);
    expect(el.callUseOrNull(ConfigController)).toBeNull();
  });

  it('resolves the same singleton as use() after adoption', async () => {
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

describe('ChildBlock.subRouter() (off bag.router → use(RouterController), M-god step 9b-1)', () => {
  it('subscribes to the same RouterController the container owns', async () => {
    const ctxName = freshCtxName();
    const el = await mount<SubRouterBlock>('uc-test-subrouter-block', ctxName);
    const router = UploaderRegistry.get(ctxName)?.get(RouterController);
    expect(router).toBeInstanceOf(RouterController);

    // Immediate fire on subscribe, then again on a router notification.
    const before = el.fires;
    el.callSubRouter();
    expect(el.fires).toBe(before + 1);

    const release = router!.activityBlockMounted(ACTIVITY_TYPES.UPLOAD_LIST);
    expect(el.fires).toBe(before + 2);
    release();
    expect(el.fires).toBe(before + 3);
  });

  it('stops firing after the block is released (tracked unsub)', async () => {
    const ctxName = freshCtxName();
    const el = await mount<SubRouterBlock>('uc-test-subrouter-block', ctxName);
    const router = UploaderRegistry.get(ctxName)!.get(RouterController);
    el.callSubRouter();
    const afterSubscribe = el.fires;

    el.remove(); // synchronous _releaseController tears down tracked subs

    router.activityBlockMounted(ACTIVITY_TYPES.UPLOAD_LIST);
    expect(el.fires).toBe(afterSubscribe);
  });
});
