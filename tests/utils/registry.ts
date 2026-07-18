import type { ControllerContainer } from '@/abstract/di/ControllerContainer';
import { UploaderRegistry } from '@/abstract/UploaderRegistry';

/**
 * Test helpers for reaching a ctx's DI container through the global
 * `UploaderRegistry` — the sole per-ctx instance mechanism after M-god step
 * 9c-2 (the v1 compat ctx/store layer was removed).
 */

/** Whether a `ControllerContainer` is currently registered under `ctxName`. */
export const hasCtx = (ctxName: string): boolean => UploaderRegistry.get(ctxName) !== undefined;

/** The `ControllerContainer` registered under `ctxName`. Throws if none. */
export const containerOf = (ctxName: string): ControllerContainer => {
  const container = UploaderRegistry.get(ctxName);
  if (!container) {
    throw new Error(`No container registered for ctx-name="${ctxName}"`);
  }
  return container;
};
