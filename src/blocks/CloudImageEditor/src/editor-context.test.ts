import { ContextProvider } from '@lit/context';
import { html, LitElement } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LightDomMixin } from '../../../lit/LightDomMixin';
import { debounced, throttled } from '../../../lit/rate-limited-method';
import { stubEditorServices } from './__tests__/editor-fixtures';
import { CloudImageEditorController, DEFAULT_EDITOR_CONFIG } from './CloudImageEditorController';
import { cloudImageEditorContext, EditorBlock } from './editor-context';

class LifetimeEditorRoot extends LightDomMixin(LitElement) {
  public readonly provider = new ContextProvider(this, {
    context: cloudImageEditorContext,
    initialValue: new CloudImageEditorController(),
  });

  public override render() {
    return html`${this.yield('')}`;
  }
}
customElements.define('uc-test-lifetime-editor-root', LifetimeEditorRoot);

class LifetimeEditorChild extends EditorBlock {
  public calls: string[] = [];
  @debounced(100)
  public onDebounced(tag: string): void {
    this.calls.push(`d:${tag}:${this.editorController ? 'attached' : 'none'}`);
  }
  @throttled(100)
  public onThrottled(tag: string): void {
    this.calls.push(`t:${tag}`);
  }
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
customElements.define('uc-test-lifetime-editor-child', LifetimeEditorChild);

const mounted: HTMLElement[] = [];

const mount = (): { root: LifetimeEditorRoot; child: LifetimeEditorChild } => {
  const root = document.createElement('uc-test-lifetime-editor-root') as LifetimeEditorRoot;
  document.body.append(root);
  mounted.push(root);
  const child = document.createElement('uc-test-lifetime-editor-child') as LifetimeEditorChild;
  root.append(child);
  return { root, child };
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  vi.restoreAllMocks();
});

describe('EditorBlock adoption lifetime', () => {
  it('aborts the adoption signal before attach and once the host disconnects', () => {
    const detached = document.createElement('uc-test-lifetime-editor-child') as LifetimeEditorChild;
    expect(detached.signal.aborted).toBe(true);

    const { child } = mount();
    const signal = child.signal;
    expect(signal.aborted).toBe(false);

    child.remove();
    expect(signal.aborted).toBe(true);
  });

  it('starts a fresh lifetime on reconnect', () => {
    const { root, child } = mount();
    const first = child.signal;

    child.remove();
    root.append(child);

    expect(first.aborted).toBe(true);
    expect(child.signal.aborted).toBe(false);
  });

  it('ends the lifetime when the provider swaps in another controller', () => {
    const { root, child } = mount();
    const first = child.signal;

    root.provider.setValue(new CloudImageEditorController());

    expect(first.aborted).toBe(true);
    expect(child.signal.aborted).toBe(false);
  });

  it('stops a task at an await that settles after detach and disposes the late value', async () => {
    const { child } = mount();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let resolve!: (value: string) => void;
    const work = new Promise<string>((res) => {
      resolve = res;
    });
    const dispose = vi.fn();
    const after = vi.fn();

    child.callRunTask(async () => {
      await child.callWhileAdopted(work, dispose);
      after();
    });
    child.remove();
    resolve('image');
    await new Promise((r) => setTimeout(r, 0));

    expect(dispose).toHaveBeenCalledWith('image');
    expect(after).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('logs a task failure that is not an abort', async () => {
    const { child } = mount();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('boom');

    child.callRunTask(async () => {
      throw failure;
    });

    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.stringMatching(/^\[uc]/), 'an async task failed', failure),
    );
  });
});

describe('@debounced / @throttled on an EditorBlock', () => {
  it('runs while attached', () => {
    vi.useFakeTimers();
    try {
      const { child } = mount();
      child.onDebounced('a');
      vi.advanceTimersByTime(100);
      expect(child.calls).toEqual(['d:a:attached']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a pending call on disconnect and no-ops calls while detached', () => {
    vi.useFakeTimers();
    try {
      const { root, child } = mount();
      child.onDebounced('a');
      child.onThrottled('x'); // leading edge runs now
      child.onThrottled('y'); // trailing pending
      child.remove();
      child.onDebounced('b'); // detached: would read a missing editorController
      vi.advanceTimersByTime(100);
      expect(child.calls).toEqual(['t:x']);

      // Reconnect reuses the limiter and runs again.
      const ref = child.onDebounced;
      root.append(child);
      expect(child.onDebounced).toBe(ref);
      child.onDebounced('c');
      vi.advanceTimersByTime(100);
      expect(child.calls).toEqual(['t:x', 'd:c:attached']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a pending call when the provider swaps in another controller', () => {
    vi.useFakeTimers();
    try {
      const { root, child } = mount();
      child.onDebounced('a');
      root.provider.setValue(new CloudImageEditorController());
      vi.advanceTimersByTime(100);
      expect(child.calls).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});

class AttachEditorChild extends EditorBlock {
  public attachCallback(callback: () => void): void {
    this.onEditorAttach(callback);
  }
  public get controller(): CloudImageEditorController {
    return this.editorController;
  }
  public get log() {
    return this._log;
  }
  public override render() {
    return html``;
  }
}
customElements.define('uc-test-attach-editor-child', AttachEditorChild);

const mountAttach = (controller = new CloudImageEditorController()) => {
  const root = document.createElement('uc-test-lifetime-editor-root') as LifetimeEditorRoot;
  root.provider.setValue(controller);
  document.body.append(root);
  mounted.push(root);
  const child = document.createElement('uc-test-attach-editor-child') as AttachEditorChild;
  root.append(child);
  return { root, child, controller };
};

describe('EditorBlock attach callbacks', () => {
  it('throws reading the controller before any provider resolved', () => {
    const detached = document.createElement('uc-test-attach-editor-child') as AttachEditorChild;
    expect(() => detached.controller).toThrow(/CloudImageEditorController is not available yet/);
  });

  it('runs a callback registered after attach right away, and again on the next attach', () => {
    const { root, child } = mountAttach();
    const callback = vi.fn();

    child.attachCallback(callback);
    expect(callback).toHaveBeenCalledTimes(1);

    root.provider.setValue(new CloudImageEditorController());
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('warns about a throwing attach callback and still runs the others', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Registered before attach: one registered after it runs right away, outside the isolation.
    const child = document.createElement('uc-test-attach-editor-child') as AttachEditorChild;
    const failure = new Error('boom');
    const after = vi.fn();
    child.attachCallback(() => {
      throw failure;
    });
    child.attachCallback(after);

    const root = document.createElement('uc-test-lifetime-editor-root') as LifetimeEditorRoot;
    document.body.append(root);
    mounted.push(root);
    expect(() => root.append(child)).not.toThrow();

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[uc]/), 'An editor attach callback threw', failure);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('prints the verbose log tier only when the debug config is on', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = { ...DEFAULT_EDITOR_CONFIG };
    const controller = new CloudImageEditorController(stubEditorServices({ getConfig: (key) => config[key] }));
    const { child } = mountAttach(controller);

    child.log.debug('quiet');
    expect(log).not.toHaveBeenCalled();

    config.debug = true;
    child.log.debug('loud');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.at(-1)).toBe('loud');
  });
});
