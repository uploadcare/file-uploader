import { uploadFileGroup } from '@uploadcare/upload-client';
import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { OutputCollectionState } from '../../types';
import { inject, injectOrNull } from '../di/inject';
import { UploaderEventType } from '../EventBus';
import { UploaderPublicApi } from '../UploaderPublicApi';
import { CollectionStateController } from './CollectionStateController';
import { UploadController } from './UploadController';

/**
 * Output-group creation — split out of {@link UploadEventsController}. Given a
 * fully-successful collection state it builds the CDN group, publishes
 * `groupInfo`, and emits `GROUP_CREATED` + a follow-up `CHANGE`. Async and
 * lifecycle-aware: `isActive` is re-checked after the network round-trip (and the
 * collection state must not have moved on) before committing the result.
 */
export class UploadGroupController {
  @injectOrNull(EventEmitter) private readonly _eventEmitter!: EventEmitter | null;
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(UploadController) private readonly _upload!: UploadController;

  private _emit = (...args: Parameters<EventEmitter['emit']>): void => {
    this._eventEmitter?.emit(...args);
  };

  public async create(collectionState: OutputCollectionState, isActive: () => boolean): Promise<void> {
    const getOutputCollectionState = this._api.getOutputCollectionState.bind(this._api);
    const uploadClientOptions = await this._upload.buildUploadOptions();
    const uuidList = collectionState.allEntries.map((entry) => {
      return entry.uuid + (entry.cdnUrlModifiers ? `/${entry.cdnUrlModifiers}` : '');
    });
    const abortController = new AbortController();
    const resp = await uploadFileGroup(uuidList, {
      ...uploadClientOptions,
      signal: abortController.signal,
    });
    // Bail if the stack was unobserved mid-flight or the collection state moved on.
    if (!isActive() || this._collectionState.get('collectionState') !== collectionState) {
      abortController.abort();
      return;
    }
    this._collectionState.set('groupInfo', resp);
    const collectionStateWithGroup = getOutputCollectionState() as OutputCollectionState<'success', 'has-group'>;
    this._emit(UploaderEventType.GROUP_CREATED, collectionStateWithGroup);
    this._emit(UploaderEventType.CHANGE, () => getOutputCollectionState(), { debounce: true });
    this._collectionState.set('collectionState', collectionStateWithGroup);
  }
}
