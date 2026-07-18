import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';

/**
 * The flat output-entry list feeding `getOutputCollectionState().allEntries` and
 * the upload-events host bridge.
 *
 * M-god step 9c-1: resolved off the per-ctx `ControllerContainer` (was the
 * shared-instances `bag`) — the collection's `items()` mapped through the public
 * api's `getOutputItem`, the exact same two instances `bag.uploadCollection` /
 * `bag.api` re-exposed, so the output shape is byte-identical.
 */
export const getOutputData = (container: ControllerContainer) => {
  const entriesIds = container.get(UploadCollectionController).items();
  const api = container.get(UploaderPublicApi);
  const data = entriesIds.map((itemId) => api.getOutputItem(itemId));
  return data;
};
