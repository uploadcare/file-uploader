import { describe, expect, it } from 'vitest';
import { createMockBflProvider } from './mockBfl';

const FAST_LATENCY = { latency: 5 };

describe('createMockBflProvider', () => {
  it('returns a result with the expected shape', async () => {
    const provider = createMockBflProvider(FAST_LATENCY);
    const result = await provider.generate({ prompt: 'a hat', capability: 'generate' });
    expect(result).toMatchObject({
      prompt: 'a hat',
      capability: 'generate',
      url: expect.stringMatching(/^https:\/\/picsum\.photos\/seed\/\d+\/\d+\/\d+$/),
    });
  });

  it('is deterministic: same prompt + capability produces the same URL', async () => {
    const provider = createMockBflProvider(FAST_LATENCY);
    const a = await provider.generate({ prompt: 'a hat', capability: 'generate' });
    const b = await provider.generate({ prompt: 'a hat', capability: 'generate' });
    expect(a.url).toBe(b.url);
  });

  it('returns different URLs for different prompts', async () => {
    const provider = createMockBflProvider(FAST_LATENCY);
    const a = await provider.generate({ prompt: 'a hat', capability: 'generate' });
    const b = await provider.generate({ prompt: 'a tree', capability: 'generate' });
    expect(a.url).not.toBe(b.url);
  });

  it('respects the width and height options in the returned URL', async () => {
    const provider = createMockBflProvider({ ...FAST_LATENCY, width: 320, height: 240 });
    const result = await provider.generate({ prompt: 'x', capability: 'generate' });
    expect(result.url).toMatch(/\/320\/240$/);
  });

  it('rejects with AbortError when the signal is already aborted', async () => {
    const provider = createMockBflProvider(FAST_LATENCY);
    const controller = new AbortController();
    controller.abort();
    await expect(provider.generate({ prompt: 'x', capability: 'generate', signal: controller.signal })).rejects.toThrow(
      /Aborted/,
    );
  });

  it('rejects with AbortError when the signal aborts mid-flight', async () => {
    const provider = createMockBflProvider({ latency: 100 });
    const controller = new AbortController();
    const promise = provider.generate({ prompt: 'x', capability: 'generate', signal: controller.signal });
    queueMicrotask(() => controller.abort());
    await expect(promise).rejects.toThrow(/Aborted/);
  });

  it('throws when errorRate is 1', async () => {
    const provider = createMockBflProvider({ ...FAST_LATENCY, errorRate: 1 });
    await expect(provider.generate({ prompt: 'x', capability: 'generate' })).rejects.toThrow(/simulated/);
  });

  it('falls back to default seed pool for unknown capabilities', async () => {
    const provider = createMockBflProvider(FAST_LATENCY);
    const result = await provider.generate({ prompt: 'x', capability: 'unknown-cap' as never });
    expect(result.url).toMatch(/picsum\.photos\/seed\/\d+/);
  });

  it('uses different seed pools per capability for the same prompt', async () => {
    const provider = createMockBflProvider(FAST_LATENCY);
    const a = await provider.generate({ prompt: 'x', capability: 'generate' });
    const b = await provider.generate({ prompt: 'x', capability: 'outpaint' });
    // Different pools should produce different URLs for the same prompt hash.
    expect(a.url).not.toBe(b.url);
  });
});
