import { describe, expect, it, vi } from 'vitest';
import type { Owned, PluginFileHookRegistration } from './PluginTypes';
import { runFileHook } from './runFileHook';

const hookWith = (handler: PluginFileHookRegistration['handler']) =>
  ({ type: 'beforeUpload', timeout: 1000, handler }) as Owned<PluginFileHookRegistration>;

describe('runFileHook', () => {
  it('does not run the hook when the parent signal is already aborted', async () => {
    const handler = vi.fn(() => ({ file: new Blob(['x']) }));
    const parent = new AbortController();
    const reason = new Error('file removed');
    parent.abort(reason);

    await expect(runFileHook(hookWith(handler), new Blob(['a']), parent.signal)).rejects.toBe(reason);
    expect(handler).not.toHaveBeenCalled();
  });
});
