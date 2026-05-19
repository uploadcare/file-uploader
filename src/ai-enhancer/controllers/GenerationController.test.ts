import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiProvider, AiProviderResult } from '../providers/types';
import { GenerationController } from './GenerationController';

class FakeHost implements ReactiveControllerHost {
  public requestUpdate = vi.fn();
  public updateComplete = Promise.resolve(true);
  public addController = vi.fn<(controller: ReactiveController) => void>();
  public removeController = vi.fn();
}

/** Provider whose generate() resolves with the next value supplied via setNext(). */
function createDeferredProvider(): {
  provider: AiProvider;
  setNext: (result: AiProviderResult) => void;
  setNextError: (err: Error) => void;
  observeSignal: () => AbortSignal | undefined;
} {
  let resolve: ((r: AiProviderResult) => void) | null = null;
  let reject: ((err: Error) => void) | null = null;
  let lastSignal: AbortSignal | undefined;

  const provider: AiProvider = {
    id: 'fake',
    generate: ({ signal }) => {
      lastSignal = signal;
      return new Promise<AiProviderResult>((res, rej) => {
        resolve = res;
        reject = rej;
        signal?.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    },
  };

  return {
    provider,
    setNext: (r) => resolve?.(r),
    setNextError: (e) => reject?.(e),
    observeSignal: () => lastSignal,
  };
}

describe('GenerationController', () => {
  let host: FakeHost;

  beforeEach(() => {
    host = new FakeHost();
  });

  it('registers itself with the host on construction', () => {
    const ctrl = new GenerationController(host);
    expect(host.addController).toHaveBeenCalledWith(ctrl);
  });

  it('starts with busy=false, no result, no error, empty history', () => {
    const ctrl = new GenerationController(host);
    expect(ctrl.busy).toBe(false);
    expect(ctrl.resultUrl).toBeNull();
    expect(ctrl.error).toBeNull();
    expect(ctrl.history).toEqual([]);
  });

  it('flips busy to true while running and back to false on success', async () => {
    const ctrl = new GenerationController(host);
    const { provider, setNext } = createDeferredProvider();
    const run = ctrl.run({ provider, prompt: 'x', capability: 'generate' });
    expect(ctrl.busy).toBe(true);
    setNext({ url: 'https://example.com/a.jpg', prompt: 'x', capability: 'generate' });
    await run;
    expect(ctrl.busy).toBe(false);
  });

  it('stores result and pushes a history entry on success', async () => {
    const ctrl = new GenerationController(host);
    const { provider, setNext } = createDeferredProvider();
    const run = ctrl.run({ provider, prompt: 'mountain', capability: 'generate' });
    setNext({ url: 'https://example.com/mountain.jpg', prompt: 'mountain', capability: 'generate' });
    const result = await run;
    expect(result).toEqual({ url: 'https://example.com/mountain.jpg', prompt: 'mountain', capability: 'generate' });
    expect(ctrl.resultUrl).toBe('https://example.com/mountain.jpg');
    expect(ctrl.history).toHaveLength(1);
    expect(ctrl.history[0]).toMatchObject({
      prompt: 'mountain',
      capability: 'generate',
      url: 'https://example.com/mountain.jpg',
    });
    expect(ctrl.history[0]?.id).toBeTypeOf('string');
  });

  it('returns null and does not start a new run while busy', async () => {
    const ctrl = new GenerationController(host);
    const { provider, setNext } = createDeferredProvider();
    const first = ctrl.run({ provider, prompt: 'a', capability: 'generate' });
    const second = await ctrl.run({ provider, prompt: 'b', capability: 'generate' });
    expect(second).toBeNull();
    setNext({ url: 'https://example.com/a.jpg', prompt: 'a', capability: 'generate' });
    await first;
  });

  it('truncates history to 20 entries', async () => {
    const ctrl = new GenerationController(host);
    const provider: AiProvider = {
      id: 'fake',
      generate: async ({ prompt, capability }) => ({ url: `https://example.com/${prompt}.jpg`, prompt, capability }),
    };
    for (let i = 0; i < 25; i++) {
      await ctrl.run({ provider, prompt: `prompt-${i}`, capability: 'generate' });
    }
    expect(ctrl.history).toHaveLength(20);
    // Newest first.
    expect(ctrl.history[0]?.prompt).toBe('prompt-24');
  });

  it('records the error message and re-throws on non-abort errors', async () => {
    const ctrl = new GenerationController(host);
    const { provider, setNextError } = createDeferredProvider();
    const run = ctrl.run({ provider, prompt: 'x', capability: 'generate' });
    setNextError(new Error('boom'));
    await expect(run).rejects.toThrow('boom');
    expect(ctrl.error).toBe('boom');
    expect(ctrl.busy).toBe(false);
  });

  it('returns null and does not record an error on abort', async () => {
    const ctrl = new GenerationController(host);
    const { provider } = createDeferredProvider();
    const run = ctrl.run({ provider, prompt: 'x', capability: 'generate' });
    ctrl.abort();
    const result = await run;
    expect(result).toBeNull();
    expect(ctrl.error).toBeNull();
    expect(ctrl.busy).toBe(false);
  });

  it('abort() cancels the in-flight signal', () => {
    const ctrl = new GenerationController(host);
    const { provider, observeSignal } = createDeferredProvider();
    void ctrl.run({ provider, prompt: 'x', capability: 'generate' });
    ctrl.abort();
    expect(observeSignal()?.aborted).toBe(true);
  });

  it('reset() clears state and aborts any in-flight request', async () => {
    const ctrl = new GenerationController(host);
    const provider: AiProvider = {
      id: 'fake',
      generate: async ({ prompt, capability }) => ({ url: 'https://example.com/x.jpg', prompt, capability }),
    };
    await ctrl.run({ provider, prompt: 'x', capability: 'generate' });
    expect(ctrl.resultUrl).not.toBeNull();
    ctrl.reset();
    expect(ctrl.resultUrl).toBeNull();
    expect(ctrl.error).toBeNull();
    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it('setResult() updates resultUrl and requests an update', () => {
    const ctrl = new GenerationController(host);
    host.requestUpdate.mockClear();
    ctrl.setResult('https://example.com/from-history.jpg');
    expect(ctrl.resultUrl).toBe('https://example.com/from-history.jpg');
    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it('hostDisconnected aborts the in-flight request', () => {
    const ctrl = new GenerationController(host);
    const { provider, observeSignal } = createDeferredProvider();
    void ctrl.run({ provider, prompt: 'x', capability: 'generate' });
    ctrl.hostDisconnected();
    expect(observeSignal()?.aborted).toBe(true);
  });

  it('requests an update on each significant transition', async () => {
    const ctrl = new GenerationController(host);
    const provider: AiProvider = {
      id: 'fake',
      generate: async ({ prompt, capability }) => ({ url: 'https://example.com/x.jpg', prompt, capability }),
    };
    host.requestUpdate.mockClear();
    await ctrl.run({ provider, prompt: 'x', capability: 'generate' });
    // One on enter-busy + one on finally.
    expect(host.requestUpdate).toHaveBeenCalledTimes(2);
  });
});
