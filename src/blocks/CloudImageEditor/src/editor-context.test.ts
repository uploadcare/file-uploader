import { ContextProvider } from '@lit/context';
import { html, LitElement } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudImageEditorController } from '../../../abstract/controllers/CloudImageEditorController';
import { LightDomMixin } from '../../../lit/LightDomMixin';
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
