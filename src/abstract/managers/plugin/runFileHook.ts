import type { Owned, PluginFileHookRegistration, PluginFileHookResult } from './PluginTypes';

/**
 * Runs one file hook, bounded by its `timeout`. The hook gets its own signal: it aborts when `parentSignal` does
 * (the file was removed, the ctx torn down) and when the hook times out, so a hook that is given up on can stop its
 * work. Either abort rejects at once; a timeout leaves `parentSignal` untouched, so callers tell the two apart by
 * checking it.
 */
export async function runFileHook(
  hook: Owned<PluginFileHookRegistration>,
  file: File | Blob,
  parentSignal: AbortSignal,
): Promise<PluginFileHookResult> {
  const controller = new AbortController();
  const abortWithParent = () => controller.abort(parentSignal.reason);
  if (parentSignal.aborted) {
    abortWithParent();
  } else {
    parentSignal.addEventListener('abort', abortWithParent, { once: true });
  }
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  // Settles on the first abort — a timeout or the parent's — so a hook that ignores its signal is not waited on.
  const stopped = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true });
    if (controller.signal.aborted) reject(controller.signal.reason);
    timeoutId = setTimeout(() => controller.abort(new Error(`${hook.type} hook timed out`)), hook.timeout);
  });
  try {
    return await Promise.race([hook.handler({ file, signal: controller.signal }), stopped]);
  } finally {
    clearTimeout(timeoutId);
    parentSignal.removeEventListener('abort', abortWithParent);
  }
}
