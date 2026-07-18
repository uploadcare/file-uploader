import { registerUploadStack } from '../abstract/controllers/registerUploadStack';
import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import type { UploadHostDebug, UploadHostEmit } from '../abstract/controllers/UploadHostBridge';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { buildUploaderScopeDeps } from './buildUploaderScopeDeps';
import { ensurePluginManager } from './ensurePluginManager';

/**
 * Shared seam for attaching the uploader scope to a ctx's `ControllerContainer`
 * — lifted verbatim out of `UploadCtxProvider._attachUploaderScopeIfNeeded` (the
 * first host to need synchronous, idempotent attach) so the ported
 * `<uc-drop-area>` can call the exact same logic instead of re-deriving it.
 *
 * All resolution is idempotent (`container.get` caches; `registerUploadStack`'s
 * own gate), so this is a no-op once a solution or a sibling host has already
 * attached. `debug`/`emit` are host-specific (see `buildUploaderScopeDeps`'s
 * doc) and stay caller-supplied.
 *
 * Resolving the controllers here (in this order) fixes the container's
 * insertion — and therefore reverse-dispose — order: UploadCollection →
 * PublicApi → SecureUploads → Upload → Validation → UploadEvents.
 */
export function ensureUploaderScope(
  container: ControllerContainer,
  debug: UploadHostDebug | undefined,
  emit: UploadHostEmit,
): void {
  container.get(UploadCollectionController);

  // M-god step 8a: the public API is container-resolved (zero-arg ctor +
  // `@inject` fields), so it must be built through the container — a bare `new`
  // would leave `@inject` unable to find its container. `container.get`
  // constructs + tags it.
  container.get(UploaderPublicApi);

  // Register the upload stack on the per-ctx container (M-god step 5). This is
  // the ONE place the four upload-stack constructors (and thus
  // `@uploadcare/upload-client`) enter — the element/upload layer, never the
  // editor. `registerUploadStack` is idempotent + binds the host-value bridge.
  const { controllers, host } = buildUploaderScopeDeps(container, debug, emit);
  registerUploadStack(container, controllers, host);

  // Force the upload-stack instances into existence in dependency order so the
  // container's reverse-dispose order is SecureUploads → Upload → Validation →
  // UploadEvents.
  container.get(controllers.SecureUploadsController);
  container.get(controllers.UploadController);
  container.get(controllers.ValidationController);
  container.get(controllers.UploadEventsController);

  // Construct the ctx's `PluginController` if no sibling host already did
  // (first-write-wins via `ensurePluginManager`'s own guard). It lives here —
  // the uploader-present seam — because plugins are an uploader concern and the
  // public API (the lazy `getUploaderApi`) is registered above.
  ensurePluginManager(container);
}
