import type { ControllerContainer } from '../di/ControllerContainer';
// The four upload-stack classes are TYPE-ONLY imports (they erase at runtime):
// they drag `@uploadcare/upload-client` and friends, and must never enter a
// bundle that only needs the editor (which never calls `registerUploadStack`).
// The element layer (`ensureUploaderScope`) passes the concrete constructors as
// `UploadStackControllers`, so they enter only upload-capable bundles.
import type { SecureUploadsController } from './SecureUploadsController';
// `UploadCollectionController` is DOM-free (no upload-client) and already
// container-owned; a value import here is safe and lets us lock its insertion
// order (see below).
import { UploadCollectionController } from './UploadCollectionController';
import type { UploadController } from './UploadController';
import type { UploadEventsController } from './UploadEventsController';
import { UploadHostBridge } from './UploadHostBridge';
import type { ValidationController } from './ValidationController';

/**
 * The four upload-stack constructors, injected by the element layer so
 * editor-only bundles never carry the upload stack. Typed via `typeof X` type
 * queries on the type-only imports, so the instance types still flow into the
 * container's `get`.
 */
export type UploadStackControllers = {
  SecureUploadsController: typeof SecureUploadsController;
  UploadController: typeof UploadController;
  ValidationController: typeof ValidationController;
  UploadEventsController: typeof UploadEventsController;
};

/**
 * Register the upload stack on a per-ctx container — the DOM-free successor to
 * `UploaderController.attachUploaderScope` (M-god step 5).
 *
 * The four controllers use `@inject` for their controller peers (config,
 * collection, secure-uploads, validation, upload, collection-state), so all this
 * needs to do is `bind` the host-value token (`UploadHostBridge`) the element
 * layer built, then resolve the stack and start it observing.
 *
 * Resolution order is load-bearing: it fixes the container's insertion order and
 * therefore its reverse-insertion `dispose()` order — `UploadEventsController`
 * (resolved last) tears down first (`unobserve()`), then validation, upload, and
 * secure-uploads, matching v1's `UploaderController.destroy()` teardown. The
 * `UploadCollectionController` is resolved earlier (by `ensureUploaderScope`,
 * before this call), so it disposes AFTER the whole upload stack — the
 * `observeCollection`/`observeProperties` handlers are detached before the
 * collection is gone.
 *
 * Idempotent: a second call (a sibling host / a re-adoption) is a no-op once the
 * events controller is resolved — mirroring `attachUploaderScope`'s own gate and
 * keeping `bind()` (which rejects a re-bind after resolution) from throwing.
 */
export function registerUploadStack(
  container: ControllerContainer,
  controllers: UploadStackControllers,
  host: UploadHostBridge,
): void {
  if (container.has(controllers.UploadEventsController)) {
    return;
  }

  container.bind(UploadHostBridge, () => host);

  // Resolve the collection FIRST so it is inserted before the upload stack and
  // therefore disposed AFTER it (reverse-insertion order) — guaranteeing
  // `UploadEventsController.unobserve()` detaches its collection observers while
  // the collection is still alive. In production `ensureUploaderScope` already
  // resolved it (this is idempotent); doing it here keeps the ordering correct
  // even for a direct caller.
  container.get(UploadCollectionController);

  container.get(controllers.SecureUploadsController);
  container.get(controllers.UploadController);
  container.get(controllers.ValidationController);
  container.get(controllers.UploadEventsController).observe();
}
