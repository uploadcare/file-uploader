import { registerUploadStack } from '../abstract/controllers/registerUploadStack';
import type { UploaderController } from '../abstract/controllers/UploaderController';
import type { UploadHostDebug, UploadHostEmit } from '../abstract/controllers/UploadHostBridge';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { buildUploaderScopeDeps } from './buildUploaderScopeDeps';
import { ensurePluginManager } from './ensurePluginManager';
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
  debug: UploadHostDebug | undefined,
  emit: UploadHostEmit,
): void {
  const ctx = bag.ctx;
  const container = ctrl.container;

  if (!ctx.has('*uploadCollection')) {
    ctx.add('*uploadCollection', ctrl.collection, true);
  }

  if (!ctx.has('*publicApi')) {
    // M-god step 8a: the public API is now container-resolved (zero-arg ctor +
    // `@inject` fields), so it must be built through the container — a bare
    // `new` would leave `@inject` unable to find its container. `container.get`
    // constructs + tags it; `setBagBridge` then wires the two dependencies not
    // yet container-resolvable (the plugin manager + `buildOutputCollectionState`)
    // before any consumer can reach the api. It stays reachable as
    // `bag.api`/`*publicApi`/`ctrl.api` (the same single instance).
    const api = container.get(UploaderPublicApi);
    api.setBagBridge(() => bag);
    ctrl.setApi(api);
    ctx.add('*publicApi', api, true);
  }

  // Register the upload stack on the per-ctx container (M-god step 5). This is
  // the ONE place the four upload-stack constructors (and thus
  // `@uploadcare/upload-client`) enter — the element/upload layer, never the
  // editor. `registerUploadStack` is idempotent + binds the host-value bridge.
  const { controllers, host } = buildUploaderScopeDeps(bag, debug, emit);
  registerUploadStack(container, controllers, host);

  // Re-expose the container-owned upload-stack instances under their v1 shared-
  // instance keys (readers like `FileItem.bag.uploadController` expect them
  // there). Resolving them here (using the concrete ctors this layer imports)
  // also fixes the container's insertion — and therefore reverse-dispose —
  // order: SecureUploads → Upload → Validation → UploadEvents.
  if (!ctx.has('*secureUploadsManager')) {
    ctx.add('*secureUploadsManager', container.get(controllers.SecureUploadsController), true);
  }
  if (!ctx.has('*uploadController')) {
    ctx.add('*uploadController', container.get(controllers.UploadController), true);
  }
  if (!ctx.has('*validationManager')) {
    ctx.add('*validationManager', container.get(controllers.ValidationController), true);
  }
  if (!ctx.has('*uploadEvents')) {
    ctx.add('*uploadEvents', container.get(controllers.UploadEventsController), true);
  }

  // Construct the ctx's `*pluginManager` if no v1 `LitBlock` in this
  // composition already did (first-write-wins). Historically the plugin
  // manager was built by `LitBlock.initCallback`; once every block in an
  // uploader composition is a `ChildBlock` (the DropArea port removes the last
  // `LitBlock`), nothing else would construct it, and lazy plugins / plugin
  // sources would never load. It lives here — the uploader-present seam —
  // because plugins are an uploader concern and `*publicApi` (the lazy
  // `getUploaderApi`) is now registered above.
  ensurePluginManager(bag);
}
