import { SecureUploadsController } from '../abstract/controllers/SecureUploadsController';
import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import { UploadController } from '../abstract/controllers/UploadController';
import { UploadEventsController } from '../abstract/controllers/UploadEventsController';
import { ValidationController } from '../abstract/controllers/ValidationController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { ensurePluginManager } from './ensurePluginManager';

/**
 * Attach the uploader scope to a ctx's container. Idempotent. Resolution order fixes the container's insertion order
 * and so its reverse-order teardown: UploadEvents → Validation → Upload → SecureUploads → PublicApi →
 * UploadCollection, so the collection observers detach while the collection is still alive.
 */
export function ensureUploaderScope(container: ControllerContainer): void {
  if (!container.has(UploadEventsController)) {
    container.get(UploadCollectionController);
    container.get(UploaderPublicApi);
    container.get(SecureUploadsController);
    container.get(UploadController);
    container.get(ValidationController);
    container.get(UploadEventsController).observe();
  }
  ensurePluginManager(container);
}
