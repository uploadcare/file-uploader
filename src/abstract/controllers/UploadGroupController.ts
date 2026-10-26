import { uploadFileGroup } from '@uploadcare/upload-client';
import type { OutputCollectionState } from '../../types';
import { buildOutputCollectionState } from '../buildOutputCollectionState';
import { controllerLogger } from '../controllerLogger';
import { lifetimeOf, requireContainerOf } from '../di/ControllerContainer';
import { inject } from '../di/inject';
import { UploaderEventType } from '../EventBus';
import { EventEmitter } from '../EventEmitter';
import { CollectionStateController } from './CollectionStateController';
import { UploadController } from './UploadController';
import { ValidationController } from './ValidationController';

/**
 * Output-group creation — split out of {@link UploadEventsController}. Given a
 * fully-successful collection state it builds the CDN group, publishes
 * `groupInfo`, and emits `GROUP_CREATED` + a follow-up `CHANGE`. Async and
 * lifecycle-aware: `isActive` is re-checked after the network round-trip (and the
 * collection state must not have moved on) before committing the result.
 */
export class UploadGroupController {
  @inject(ValidationController) private readonly _validation!: ValidationController;
  @inject(EventEmitter) private readonly _eventEmitter!: EventEmitter;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(UploadController) private readonly _upload!: UploadController;
  private readonly _log = controllerLogger(this, 'upload-group');

  private _emit = (...args: Parameters<EventEmitter['emit']>): void => {
    this._eventEmitter.emit(...args);
  };

  public async create(collectionState: OutputCollectionState, isActive: () => boolean): Promise<void> {
    // The collection already has its group: `groupInfo` is cleared whenever the membership or a file's URL changes,
    // so it is never another collection's. A later flush that finds the collection successful again (a slow
    // post-upload validator) must not create a second one.
    if (this._collectionState.get('groupInfo')) return;
    // Callers invoke this fire-and-forget. Report a current request's failure
    // through collection validation instead of leaking an unhandled rejection.
    try {
      const uploadClientOptions = await this._upload.buildUploadOptions();
      // Building options awaits (secure signature etc.); bail before the network
      // call if the stack was torn down or the collection state moved on meanwhile,
      // so a dead scope never fires a stale group-create request.
      if (!isActive() || this._collectionState.get('collectionState') !== collectionState) {
        return;
      }
      const uuidList = collectionState.allEntries.map((entry) => {
        return entry.uuid + (entry.cdnUrlModifiers ? `/${entry.cdnUrlModifiers}` : '');
      });
      // Cancelled if the ctx is torn down mid-flight; the result would be discarded below anyway.
      const resp = await uploadFileGroup(uuidList, {
        ...uploadClientOptions,
        signal: lifetimeOf(this).signal,
      });
      // Bail if the stack was unobserved mid-flight or the collection state moved on.
      if (!isActive() || this._collectionState.get('collectionState') !== collectionState) {
        return;
      }
      this._collectionState.set('groupInfo', resp);
      this._collectionState.set('groupError', null);
      const collectionStateWithGroup = buildOutputCollectionState(requireContainerOf(this)) as OutputCollectionState<
        'success',
        'has-group'
      >;
      this._emit(UploaderEventType.GROUP_CREATED, collectionStateWithGroup);
      this._emit(UploaderEventType.CHANGE, () => buildOutputCollectionState(requireContainerOf(this)), {
        debounce: true,
      });
      this._collectionState.set('collectionState', collectionStateWithGroup);
    } catch (err) {
      if (!isActive() || this._collectionState.get('collectionState') !== collectionState) return;
      this._collectionState.set(
        'groupError',
        err instanceof Error ? err : new Error('Failed to create a group', { cause: err }),
      );
      this._validation.runCollectionValidators();
      this._log.error('Failed to create the output file group', err);
    }
  }
}
