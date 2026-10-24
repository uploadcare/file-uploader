// Value imports on purpose: this builder hands the four upload-stack
// constructors to `registerUploadStack` — the abstract layer only type-imports
// them, keeping editor-only bundles (which import neither this builder nor
// `ensureUploaderScope`) free of `@uploadcare/upload-client` and friends.

import type { UploadStackControllers } from '../abstract/controllers/registerUploadStack';
import { SecureUploadsController } from '../abstract/controllers/SecureUploadsController';
import { UploadController } from '../abstract/controllers/UploadController';
import { UploadEventsController } from '../abstract/controllers/UploadEventsController';
import { ValidationController } from '../abstract/controllers/ValidationController';

/**
 * The value-import boundary for the upload stack: the four upload-stack
 * constructors that `registerUploadStack` binds on a per-ctx container. They are
 * gathered here (the element/upload layer) rather than in the abstract-layer
 * `registerUploadStack` so their transitive `@uploadcare/upload-client` +
 * public-API dependencies stay out of any bundle that only needs the editor
 * (which imports neither this builder nor `ensureUploaderScope`).
 *
 * There is no longer a host-value bridge: each upload-stack controller `@inject`s
 * the real collaborators it needs (`UploaderPublicApi`, `TelemetryManager`,
 * `EventEmitter`, and the conditionally-bound `PluginController` via the
 * container) straight off the per-ctx `ControllerContainer`.
 */
export function buildUploaderScopeDeps(): UploadStackControllers {
  return { SecureUploadsController, UploadController, ValidationController, UploadEventsController };
}
