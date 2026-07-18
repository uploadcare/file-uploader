import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';

/**
 * The flat output-entry list feeding `getOutputCollectionState().allEntries` and
 * the upload-events host bridge.
 *
 * Resolved off the per-ctx `ControllerContainer`: the collection's `items()`
 * mapped through the public api's `getOutputItem`.
 */
export const getOutputData = (container: ControllerContainer) => {
  const entriesIds = container.get(UploadCollectionController).items();
  const api = container.get(UploaderPublicApi);
  const data = entriesIds.map((itemId) => api.getOutputItem(itemId));
  return data;
};
