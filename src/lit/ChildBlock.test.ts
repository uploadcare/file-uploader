import { html } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

class TaskBlock extends ChildBlock {
  public get signal(): AbortSignal {
    return this.adoptionSignal;
  }
  public callWhileAdopted<T>(work: PromiseLike<T>, dispose?: (value: T) => void): Promise<T> {
    return this.whileAdopted(work, dispose);
  }
  public callRunTask(task: (signal: AbortSignal) => unknown): void {
    this.runTask(task);
  }
  public override render() {
    return html``;
  }
}
TaskBlock.reg('uc-test-task-block');

class TestIdBlock extends ChildBlock {
  public override render() {
    return html`<span class="inner" data-testid="inner"></span>`;
  }
}
TestIdBlock.reg('uc-test-testid-block');

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

describe('ChildBlock consumer lifecycle', () => {
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

describe('ChildBlock adoption lifetime', () => {
  it('aborts the adoption signal before adoption and once released', async () => {
    const el = document.createElement('uc-test-task-block') as TaskBlock;
    expect(el.signal.aborted).toBe(true);

    const adopted = await mount<TaskBlock>('uc-test-task-block', freshCtxName());
    const signal = adopted.signal;
    expect(signal.aborted).toBe(false);

    adopted.remove();
    expect(signal.aborted).toBe(true);
  });

  it('stops a task at an await that settles after release and disposes the late value', async () => {
    const el = await mount<TaskBlock>('uc-test-task-block', freshCtxName());
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let resolve!: (value: string) => void;
    const work = new Promise<string>((res) => {
      resolve = res;
    });
    const dispose = vi.fn();
    const after = vi.fn();

    el.callRunTask(async () => {
      await el.callWhileAdopted(work, dispose);
      after();
    });
    el.remove();
    resolve('stream');
    await flushTeardown();

    expect(dispose).toHaveBeenCalledWith('stream');
    expect(after).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('logs a task failure that is not an abort', async () => {
    const el = await mount<TaskBlock>('uc-test-task-block', freshCtxName());
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('boom');

    el.callRunTask(async () => {
      throw failure;
    });

    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.stringMatching(/^\[uc]/), 'an async task failed', failure),
    );
    error.mockRestore();
  });
});

describe('ChildBlock test mode', () => {
  it('does not scan its subtree for [data-testid] on update while testMode is off', async () => {
    const ctxName = freshCtxName();
    const el = await mount<TestIdBlock>('uc-test-testid-block', ctxName);
    const scan = vi.spyOn(el, 'querySelectorAll');

    for (let i = 0; i < 3; i++) {
      el.requestUpdate();
      await el.updateComplete;
    }

    expect(scan).not.toHaveBeenCalledWith('[data-testid]');
  });

  it('still prefixes inner test ids when testMode is turned on later', async () => {
    const ctxName = freshCtxName();
    const el = await mount<TestIdBlock>('uc-test-testid-block', ctxName);
    el.requestUpdate();
    await el.updateComplete;

    UploaderRegistry.get(ctxName)?.get(ConfigController).set('testMode', true);
    await el.updateComplete;
    await Promise.resolve();

    expect(el.getAttribute('data-testid')).toBe('uc-test-testid-block');
    expect(el.querySelector('.inner')?.getAttribute('data-testid')).toBe('uc-test-testid-block--inner');
  });
});

describe('static template', () => {
  it('logs the deprecation error v1 logged when a block class is given a template', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    class TemplatedBlock extends UseBlock {}

    (TemplatedBlock as unknown as { template: string }).template = '<div></div>';

    expect(error.mock.calls.map((call) => call.join(' ')).join('\n')).toContain(
      "Caution: static 'template' property is deprecated and has no effect.",
    );
  });
});
