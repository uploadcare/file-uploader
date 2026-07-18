import { registerUploadStack } from '../abstract/controllers/registerUploadStack';
import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import type { UploadHostDebug, UploadHostEmit } from '../abstract/controllers/UploadHostBridge';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { buildUploaderScopeDeps } from './buildUploaderScopeDeps';
import { ensurePluginManager } from './ensurePluginManager';
import type { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';

/**
 * Shared seam for attaching the uploader scope to a `ctx`/`container` pair —
 * lifted verbatim out of `UploadCtxProvider._attachUploaderScopeIfNeeded` (the
 * first host to need synchronous, idempotent attach) so the ported
 * `<uc-drop-area>` can call the exact same logic instead of re-deriving it.
 *
 * All writes are guarded/idempotent (first-write-wins + `registerUploadStack`'s
 * own gate), so this is a no-op once a solution or a sibling host has already
 * attached. `debug`/`emit` are host-specific (see `buildUploaderScopeDeps`'s
 * doc) and stay caller-supplied.
 *
 * M-god step 9b-1: callers pass this ctx's `PubSub` + `ControllerContainer`
 * directly instead of the `bag` — so the uploader blocks (`UploadCtxProvider` /
 * `<uc-drop-area>`) no longer reference `this.bag`. Controllers resolve off the
 * container; the ctx re-exposes them under their v1 `*`-keys.
 *
 * M-god step 9c-1: the residual internal shared-instances bag is gone —
 * `buildUploaderScopeDeps`, `ensurePluginManager`, and the public api all take
 * the container directly now, so `ensureUploaderScope` no longer touches the
 * shared-instances bag at all.
 */
export function ensureUploaderScope(
  ctx: PubSub<SharedState>,
  container: ControllerContainer,
  debug: UploadHostDebug | undefined,
  emit: UploadHostEmit,
): void {
  if (!ctx.has('*uploadCollection')) {
    ctx.add('*uploadCollection', container.get(UploadCollectionController), true);
  }

  if (!ctx.has('*publicApi')) {
    // M-god step 8a: the public API is now container-resolved (zero-arg ctor +
    // `@inject` fields), so it must be built through the container — a bare
    // `new` would leave `@inject` unable to find its container. `container.get`
    // constructs + tags it. It stays reachable as `bag.api`/`*publicApi` (the
    // same single instance). M-god step 9c-1: `getOutputCollectionState` /
    // `getOutputData` now resolve their controllers off the api's own container
    // (`this[CONTAINER]`), so there is no longer a `setBagBridge` hand-off here.
    ctx.add('*publicApi', container.get(UploaderPublicApi), true);
  }

  // Register the upload stack on the per-ctx container (M-god step 5). This is
  // the ONE place the four upload-stack constructors (and thus
  // `@uploadcare/upload-client`) enter — the element/upload layer, never the
  // editor. `registerUploadStack` is idempotent + binds the host-value bridge.
  const { controllers, host } = buildUploaderScopeDeps(container, debug, emit);
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
  ensurePluginManager(ctx, container);
}
