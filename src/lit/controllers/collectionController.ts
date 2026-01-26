import { uploadFileGroup } from '@uploadcare/upload-client';
import type { TypedCollectionObserverHandler } from '../../abstract/TypedCollection';
import type { UploadEntryData } from '../../abstract/uploadEntrySchema';
import { EventType } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { OutputCollectionState } from '../../types';
import { debounce } from '../../utils/debounce';
import type { LitBlock } from '../LitBlock';
import type { LitUploaderBlock } from '../LitUploaderBlock';
import { PubSub } from '../PubSubCompat';
import type { Uid } from '../Uid';
import type { CloudImageEditorController } from './cloudImageEditorController';

type CollectionControllerHost = LitUploaderBlock & LitBlock;

export class CollectionController {
  private readonly host: CollectionControllerHost;

  public constructor(
    host: CollectionControllerHost,
    private cloudImageEditorController: CloudImageEditorController,
  ) {
    this.host = host;
  }

  public handleCollectionPropertiesUpdate(changeMap: Record<keyof UploadEntryData, Set<Uid>>) {
    if (!this.host.isConnected) return;
    this.flushOutputItems();

    const uploadCollection = this.host.uploadCollection;
    const entriesToRunValidation = [
      ...new Set(
        Object.entries(changeMap)
          .filter(([key]) => ['uploadError', 'fileInfo', 'cdnUrl', 'cdnUrlModifiers'].includes(key))
          .flatMap(([, ids]) => [...ids]),
      ),
    ];

    entriesToRunValidation.length > 0 &&
      setTimeout(() => {
        if (!this.host.isConnected) return;
        // We can't modify entry properties in the same tick, so we need to wait a bit
        const entriesToRunOnUpload = entriesToRunValidation.filter(
          (entryId) => changeMap.fileInfo?.has(entryId) && !!PubSub.getCtx<UploadEntryData>(entryId)?.store.fileInfo,
        );
        if (entriesToRunOnUpload.length > 0) {
          this.host.validationManager.runFileValidators('upload', entriesToRunOnUpload);
        }
        this.host.validationManager.runFileValidators('change', entriesToRunValidation);
      });

    if (changeMap.uploadProgress) {
      for (const entryId of changeMap.uploadProgress) {
        const ctx = PubSub.getCtx<UploadEntryData>(entryId);
        if (!ctx) continue;
        const { isUploading, silent } = ctx.store;
        if (isUploading && !silent) {
          this.host.emit(EventType.FILE_UPLOAD_PROGRESS, this.host.api.getOutputItem(entryId));
        }
      }

      this.flushCommonUploadProgress();
    }
    if (changeMap.isUploading) {
      for (const entryId of changeMap.isUploading) {
        const ctx = PubSub.getCtx<UploadEntryData>(entryId);
        if (!ctx) continue;
        const { isUploading, silent } = ctx.store;
        if (isUploading && !silent) {
          this.host.emit(EventType.FILE_UPLOAD_START, this.host.api.getOutputItem(entryId));
        }
      }
    }
    if (changeMap.fileInfo) {
      for (const entryId of changeMap.fileInfo) {
        const ctx = PubSub.getCtx<UploadEntryData>(entryId);
        if (!ctx) continue;
        const { fileInfo, silent } = ctx.store;
        if (fileInfo && !silent) {
          this.host.emit(EventType.FILE_UPLOAD_SUCCESS, this.host.api.getOutputItem(entryId));
        }
      }
      if (this.host.cfg.cropPreset) {
        this.cloudImageEditorController.setInitialCrop();
      }

      if (this.host.cfg.cloudImageEditorAutoOpen) {
        this.cloudImageEditorController.openCloudImageEditor();
      }
    }
    if (changeMap.errors) {
      this.host.validationManager.runCollectionValidators();

      for (const entryId of changeMap.errors) {
        const ctx = PubSub.getCtx<UploadEntryData>(entryId);
        if (!ctx) continue;
        const { errors } = ctx.store;
        if (errors.length > 0) {
          this.host.emit(EventType.FILE_UPLOAD_FAILED, this.host.api.getOutputItem(entryId));
          this.host.emit(
            EventType.COMMON_UPLOAD_FAILED,
            () => this.host.api.getOutputCollectionState() as OutputCollectionState<'failed'>,
            { debounce: true },
          );
        }
      }
      const loadedItems = uploadCollection.findItems((entry) => {
        return !!entry.getValue('fileInfo');
      });
      const errorItems = uploadCollection.findItems((entry) => {
        return entry.getValue('errors').length > 0;
      });
      if (
        uploadCollection.size > 0 &&
        errorItems.length === 0 &&
        uploadCollection.size === loadedItems.length &&
        this.host.sharedCtx.read(`*collectionErrors`).length === 0
      ) {
        this.host.emit(
          EventType.COMMON_UPLOAD_SUCCESS,
          this.host.api.getOutputCollectionState() as OutputCollectionState<'success'>,
        );
      }
    }
    if (changeMap.cdnUrl) {
      const uids = [...changeMap.cdnUrl].filter((uid) => {
        return !!this.host.uploadCollection.read(uid)?.getValue('cdnUrl');
      });
      uids.forEach((uid) => {
        this.host.emit(EventType.FILE_URL_CHANGED, this.host.api.getOutputItem(uid));
      });

      this.host.sharedCtx.pub('*groupInfo', null);
    }
  }

  public handleCollectionUpdate: TypedCollectionObserverHandler<UploadEntryData> = (entries, added, removed) => {
    if (!this.host.isConnected) return;
    if (added.size || removed.size) {
      this.host.sharedCtx.pub('*groupInfo', null);
    }

    this.host.validationManager.runFileValidators(
      'add',
      [...added].map((e) => e.uid),
    );

    for (const entry of added) {
      if (!entry.getValue('silent')) {
        this.host.emit(EventType.FILE_ADDED, this.host.api.getOutputItem(entry.uid));
      }
    }

    this.host.validationManager.runCollectionValidators();

    for (const entry of removed) {
      this.host.sharedCtx.read(`*uploadTrigger`).delete(entry.uid);

      this.host.validationManager.cleanupValidationForEntry(entry);

      entry.getValue('abortController')?.abort();
      entry.setMultipleValues({
        isRemoved: true,
        abortController: null,
        isUploading: false,
        uploadProgress: 0,
      });

      const thumbUrl = entry?.getValue('thumbUrl');
      thumbUrl && URL.revokeObjectURL(thumbUrl);
      this.host.emit(EventType.FILE_REMOVED, this.host.api.getOutputItem(entry.uid));
    }

    this.host.sharedCtx.pub(
      '*uploadList',
      entries.map((uid) => {
        return { uid };
      }),
    );
  };

  public flushCommonUploadProgress = (): void => {
    let commonProgress = 0;
    const uploadTrigger = this.host.sharedCtx.read(`*uploadTrigger`);
    const items = [...uploadTrigger].filter((id) => !!this.host.uploadCollection.read(id));
    items.forEach((id) => {
      const uploadProgress = this.host.uploadCollection.readProp(id, 'uploadProgress');
      if (typeof uploadProgress === 'number') {
        commonProgress += uploadProgress;
      }
    });
    const progress = items.length ? Math.round(commonProgress / items.length) : 0;

    if (this.host.sharedCtx.read(`*commonProgress`) === progress) {
      return;
    }

    this.host.sharedCtx.pub(`*commonProgress`, progress);
    this.host.emit(
      EventType.COMMON_UPLOAD_PROGRESS,
      this.host.api.getOutputCollectionState() as OutputCollectionState<'uploading'>,
    );
  };

  public flushOutputItems = debounce(async () => {
    const data = this.host.getOutputData();
    if (data.length !== this.host.uploadCollection.size) {
      return;
    }
    const collectionState = this.host.api.getOutputCollectionState();
    this.host.sharedCtx.pub('*collectionState', collectionState);
    this.host.emit(EventType.CHANGE, () => this.host.api.getOutputCollectionState(), {
      debounce: true,
    });

    if (this.host.cfg.groupOutput && collectionState.totalCount > 0 && collectionState.status === 'success') {
      this._createGroup(collectionState);
    }
  }, 300);

  private async _createGroup(collectionState: OutputCollectionState): Promise<void> {
    // @ts-expect-error
    const uploadClientOptions = await this.host.getUploadClientOptions();

    const uuidList = collectionState.allEntries.map((entry) => {
      return entry.uuid + (entry.cdnUrlModifiers ? `/${entry.cdnUrlModifiers}` : '');
    });

    const abortController = new AbortController();

    const response = await uploadFileGroup(uuidList, {
      ...uploadClientOptions,
      signal: abortController.signal,
    });
    if (this.host.sharedCtx.read(`*collectionState`) !== collectionState) {
      abortController.abort();
      return;
    }

    this.host.sharedCtx.pub('*groupInfo', response);
    const collectionStateWithGroup = this.host.api.getOutputCollectionState() as OutputCollectionState<
      'success',
      'has-group'
    >;
    this.host.emit(EventType.GROUP_CREATED, collectionStateWithGroup);
    this.host.emit(EventType.CHANGE, () => this.host.api.getOutputCollectionState(), {
      debounce: true,
    });
    this.host.sharedCtx.pub('*collectionState', collectionStateWithGroup);
  }
}
