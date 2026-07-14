import type { UploaderController, UploaderScopeDeps } from '../abstract/controllers/UploaderController';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { buildUploaderScopeDeps } from './buildUploaderScopeDeps';
import type { SharedInstancesBag } from './shared-instances';

/**
 * Shared seam for attaching the uploader scope to a `bag`/`ctrl` pair — lifted
 * verbatim out of `UploadCtxProvider._attachUploaderScopeIfNeeded` (the first
 * host to need synchronous, idempotent attach) so the ported `<uc-drop-area>`
 * can call the exact same logic instead of re-deriving it.
 *
 * All writes are guarded/idempotent (first-write-wins + `attachUploaderScope`'s
 * own gate), so this is a no-op once a solution or a sibling host has already
 * attached. `debug`/`emit` are host-specific (see `buildUploaderScopeDeps`'s
 * doc) and stay caller-supplied.
 */
export function ensureUploaderScope(
  bag: SharedInstancesBag,
  ctrl: UploaderController,
  debug: UploaderScopeDeps['debug'],
  emit: UploaderScopeDeps['emit'],
): void {
  const ctx = bag.ctx;

  if (!ctx.has('*uploadCollection')) {
    ctx.add('*uploadCollection', ctrl.collection, true);
  }

  if (!ctx.has('*publicApi')) {
    const api = new UploaderPublicApi(bag);
    ctrl.setApi(api);
    ctx.add('*publicApi', api, true);
  }

  ctrl.attachUploaderScope(buildUploaderScopeDeps(bag, debug, emit));

  // Re-expose the controller-owned instances under their v1 shared-instance
  // keys (readers like `FileItem.bag.uploadController` expect them there).
  if (!ctx.has('*secureUploadsManager')) {
    ctx.add('*secureUploadsManager', ctrl.secureUploadsManager, true);
  }
  if (!ctx.has('*uploadController')) {
    ctx.add('*uploadController', ctrl.uploadController, true);
  }
  if (!ctx.has('*validationManager')) {
    ctx.add('*validationManager', ctrl.validationManager, true);
  }
  if (!ctx.has('*uploadEvents')) {
    ctx.add('*uploadEvents', ctrl.uploadEvents, true);
  }
}
