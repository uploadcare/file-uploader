// @ts-check

import { calcCameraModes } from '../blocks/CameraSource/calcCameraModes';
import { CameraSourceTypes, type ModeCameraType } from '../blocks/CameraSource/constants';
import type { SourceBtn } from '../blocks/SourceBtn/SourceBtn';
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import { ACTIVITY_TYPES } from '../lit/activity-constants';
import { findBlockInCtx } from '../lit/findBlockInCtx';
import { hasBlockInCtx } from '../lit/hasBlockInCtx';
import type { ActivityParamsMap, ActivityType, LitActivityBlock } from '../lit/LitActivityBlock';
import type { LitBlock } from '../lit/LitBlock';
import { createL10n } from '../lit/l10n';
import { PubSub } from '../lit/PubSubCompat';
import { SharedInstance } from '../lit/shared-instances';
import type { Uid } from '../lit/Uid';
import type {
  OutputCollectionState,
  OutputCollectionStatus,
  OutputFileEntry,
  OutputFileStatus,
  UploadcareFile,
} from '../types/index';
import { applyStyles } from '../utils/applyStyles';
import { browserFeatures } from '../utils/browser-info';
import { serializeCsv } from '../utils/comma-separated';
import {
  BASIC_IMAGE_WILDCARD,
  BASIC_VIDEO_WILDCARD,
  fileIsImage,
  IMAGE_ACCEPT_LIST,
  mergeFileTypes,
} from '../utils/fileTypes';
import { parseCdnUrl } from '../utils/parseCdnUrl';
import { stringToArray } from '../utils/stringToArray';
import { UploadSource } from '../utils/UploadSource';
import { buildOutputCollectionState } from './buildOutputCollectionState';
import type { UploadEntryData } from './uploadEntrySchema';
export type ApiAddFileCommonOptions = {
  silent?: boolean;
  fileName?: string;
  source?: string;
};

export class UploaderPublicApi extends SharedInstance {
  private _l10n = createL10n(() => this._ctx);

  public get _uploadCollection() {
    return this._sharedInstancesBag.uploadCollection;
  }

  public get cfg() {
    return this._cfg;
  }

  public get l10n() {
    return this._l10n;
  }

  /**
   * TODO: Probably we should not allow user to override `source` property
   */
  public addFileFromUrl = (
    url: string,
    { silent, fileName, source }: ApiAddFileCommonOptions = {},
  ): OutputFileEntry<'idle'> => {
    const internalId = this._uploadCollection.add({
      externalUrl: url,
      fileName: fileName ?? null,
      silent: silent ?? false,
      source: source ?? UploadSource.API,
    });
    return this.getOutputItem(internalId);
  };

  public addFileFromUuid = (
    uuid: string,
    { silent, fileName, source }: ApiAddFileCommonOptions = {},
  ): OutputFileEntry<'idle'> => {
    const internalId = this._uploadCollection.add({
      uuid,
      fileName: fileName ?? null,
      silent: silent ?? false,
      source: source ?? UploadSource.API,
    });
    return this.getOutputItem(internalId);
  };

  public addFileFromCdnUrl = (
    cdnUrl: string,
    { silent, fileName, source }: ApiAddFileCommonOptions = {},
  ): OutputFileEntry<'idle'> => {
    const parsedCdnUrl = parseCdnUrl({
      url: cdnUrl,
      cdnBase: this.cfg.cdnCname,
    });
    if (!parsedCdnUrl) {
      throw new Error('Invalid CDN URL');
    }
    const internalId = this._uploadCollection.add({
      uuid: parsedCdnUrl.uuid,
      cdnUrl,
      cdnUrlModifiers: parsedCdnUrl.cdnUrlModifiers,
      fileName: fileName ?? parsedCdnUrl.filename ?? null,
      silent: silent ?? false,
      source: source ?? UploadSource.API,
    });
    return this.getOutputItem(internalId);
  };

  public addFileFromObject = (
    file: File,
    {
      silent,
      fileName,
      source,
      fullPath,
    }: ApiAddFileCommonOptions & {
      fullPath?: string;
    } = {},
  ): OutputFileEntry<'idle'> => {
    const internalId = this._uploadCollection.add({
      file,
      isImage: fileIsImage(file),
      mimeType: file.type,
      fileName: fileName ?? file.name,
      fileSize: file.size,
      silent: silent ?? false,
      source: source ?? UploadSource.API,
      fullPath: fullPath ?? null,
    });
    return this.getOutputItem(internalId);
  };

  public removeFileByInternalId = (internalId: string): void => {
    if (!this._uploadCollection.read(internalId as Uid)) {
      throw new Error(`File with internalId ${internalId} not found`);
    }
    this._uploadCollection.remove(internalId as Uid);
  };

  public removeAllFiles(): void {
    this._uploadCollection.clearAll();
  }

  public uploadAll = (): void => {
    const itemsToUpload = this._uploadCollection.items().filter((id) => {
      const entry = this._uploadCollection.read(id);
      if (!entry) return false;
      return (
        !entry.getValue('isRemoved') &&
        !entry.getValue('isUploading') &&
        !entry.getValue('fileInfo') &&
        entry.getValue('errors').length === 0 &&
        !entry.getValue('isValidationPending') &&
        !entry.getValue('isQueuedForValidation')
      );
    });

    if (itemsToUpload.length === 0) {
      return;
    }

    this._ctx.pub('*uploadTrigger', new Set(itemsToUpload));
    this._sharedInstancesBag.eventEmitter.emit(
      EventType.COMMON_UPLOAD_START,
      this.getOutputCollectionState() as OutputCollectionState<'uploading'>,
    );
  };

  public openSystemDialog = (options: { captureCamera?: boolean; modeCamera?: ModeCameraType } = {}): void => {
    const accept = serializeCsv(
      mergeFileTypes([this.cfg.accept ?? '', ...(this.cfg.imgOnly ? IMAGE_ACCEPT_LIST : [])]),
    );
    const INPUT_ATTR_NAME = 'uploadcare-file-input';
    const fileInput = document.createElement('input');
    fileInput.setAttribute(INPUT_ATTR_NAME, '');
    applyStyles(fileInput, {
      opacity: 0,
      height: 0,
      width: 0,
      visibility: 'hidden',
      position: 'absolute',
      top: 0,
      left: 0,
    });
    fileInput.type = 'file';
    fileInput.multiple = this.cfg.multiple;
    if (options.captureCamera) {
      fileInput.capture = this.cfg.cameraCapture;
      const { isPhotoEnabled, isVideoRecordingEnabled } = calcCameraModes(this.cfg);

      if (options.modeCamera === CameraSourceTypes.PHOTO && isPhotoEnabled) {
        fileInput.accept = BASIC_IMAGE_WILDCARD;
      } else if (options.modeCamera === CameraSourceTypes.VIDEO && isVideoRecordingEnabled) {
        fileInput.accept = BASIC_VIDEO_WILDCARD;
      } else {
        fileInput.accept = [BASIC_IMAGE_WILDCARD, isVideoRecordingEnabled && BASIC_VIDEO_WILDCARD]
          .filter(Boolean)
          .join(',');
      }
    } else {
      fileInput.accept = accept;
    }
    fileInput.addEventListener(
      'change',
      () => {
        if (!fileInput.files) {
          return;
        }
        [...fileInput.files].forEach((file) => {
          this.addFileFromObject(file, {
            source: options.captureCamera ? UploadSource.CAMERA : UploadSource.LOCAL,
          });
        });
        // To call uploadTrigger UploadList should draw file items first:
        this._ctx.pub('*currentActivity', ACTIVITY_TYPES.UPLOAD_LIST);
        this._sharedInstancesBag.modalManager?.open(ACTIVITY_TYPES.UPLOAD_LIST);
        fileInput.remove();
      },
      {
        once: true,
      },
    );

    document.querySelectorAll(`[${INPUT_ATTR_NAME}]`).forEach((el) => {
      el.remove();
    });

    /**
     * Some browsers (e.g. Safari) require the file input to be in the DOM to work properly. Without it the file input
     * will open system dialog but won't trigger the change event sometimes.
     */
    document.body.appendChild(fileInput);
    fileInput.dispatchEvent(new MouseEvent('click'));
  };

  public getOutputItem<TStatus extends OutputFileStatus>(entryId: string): OutputFileEntry<TStatus> {
    const ctx = PubSub.getCtx<UploadEntryData>(entryId);
    if (!ctx) {
      throw new Error(`UploaderPublicApi#getOutputItem: Entry with ID "${entryId}" not found in the upload collection`);
    }
    const uploadEntryData = ctx.store;
    const fileInfo = uploadEntryData.fileInfo as UploadcareFile | null;

    const status: OutputFileEntry['status'] = uploadEntryData.isRemoved
      ? 'removed'
      : uploadEntryData.errors.length > 0
        ? 'failed'
        : uploadEntryData.fileInfo
          ? 'success'
          : uploadEntryData.isUploading
            ? 'uploading'
            : 'idle';

    const outputItem = {
      uuid: fileInfo?.uuid ?? uploadEntryData.uuid ?? null,
      internalId: entryId,
      name: fileInfo?.originalFilename ?? uploadEntryData.fileName,
      size: fileInfo?.size ?? uploadEntryData.fileSize,
      isImage: fileInfo?.isImage ?? uploadEntryData.isImage,
      mimeType: fileInfo?.mimeType ?? uploadEntryData.mimeType,
      file: uploadEntryData.file,
      externalUrl: uploadEntryData.externalUrl,
      cdnUrlModifiers: uploadEntryData.cdnUrlModifiers,
      cdnUrl: uploadEntryData.cdnUrl ?? fileInfo?.cdnUrl ?? null,
      fullPath: uploadEntryData.fullPath,
      uploadProgress: uploadEntryData.uploadProgress,
      fileInfo: fileInfo ?? null,
      metadata: uploadEntryData.metadata ?? fileInfo?.metadata ?? null,
      isSuccess: status === 'success',
      isUploading: status === 'uploading',
      isFailed: status === 'failed',
      isRemoved: status === 'removed',
      isValidationPending: uploadEntryData.isValidationPending,
      errors: uploadEntryData.errors as OutputFileEntry['errors'],
      status,
      source: uploadEntryData?.source,
    };

    return outputItem as OutputFileEntry<TStatus>;
  }

  public getOutputCollectionState<TStatus extends OutputCollectionStatus>() {
    return buildOutputCollectionState(this._sharedInstancesBag) as ReturnType<
      typeof buildOutputCollectionState<TStatus>
    >;
  }

  public initFlow = (force = false): void => {
    if (this._uploadCollection.size > 0 && !force) {
      this._ctx.pub('*currentActivity', ACTIVITY_TYPES.UPLOAD_LIST);
      this._sharedInstancesBag.modalManager?.open(ACTIVITY_TYPES.UPLOAD_LIST);
    } else {
      if (this._sourceList?.length === 1) {
        const srcKey = this._sourceList[0];

        // TODO: We should refactor those handlers
        if (srcKey === 'local') {
          this._ctx.pub('*currentActivity', ACTIVITY_TYPES.UPLOAD_LIST);
          this.openSystemDialog();
          return;
        }

        if (srcKey === 'camera' && browserFeatures.htmlMediaCapture) {
          const { isPhotoEnabled, isVideoRecordingEnabled } = calcCameraModes(this.cfg);

          if (isPhotoEnabled && isVideoRecordingEnabled) {
            this._ctx.pub('*currentActivity', ACTIVITY_TYPES.START_FROM);
            return;
          } else if (isPhotoEnabled || isVideoRecordingEnabled) {
            this.openSystemDialog({
              captureCamera: true,
              modeCamera: isPhotoEnabled ? CameraSourceTypes.PHOTO : CameraSourceTypes.VIDEO,
            });
            return;
          } else {
            this.openSystemDialog({
              captureCamera: true,
              modeCamera: CameraSourceTypes.PHOTO,
            });
          }
        }

        // After Lit Element migration, the source buttons are rendered async in the next tick after `sourceList` update.
        // So we can't find them here right after updating the source list, we need to wait for the next tick to ensure that they are rendered before trying to find and activate them.
        // Anyway this is a weird logic here that needs to be refactored.
        setTimeout(() => {
          if (srcKey !== this._sourceList[0]) {
            return;
          }
          const blocksRegistry = this._sharedInstancesBag.blocksRegistry;
          const isSourceBtn = (block: LitBlock): block is SourceBtn =>
            'type' in (block as any) && (block as any).type === srcKey;
          const sourceBtnBlock = findBlockInCtx(blocksRegistry, isSourceBtn) as SourceBtn | undefined;
          // TODO: This is weird that we have this logic inside UI component, we should consider to move it somewhere else
          sourceBtnBlock?.activate();
        }, 0);

        if (this._ctx.read('*currentActivity')) {
          this._sharedInstancesBag.modalManager?.open(this._ctx.read('*currentActivity'));
        }
      } else {
        // Multiple sources case:
        this._ctx.pub('*currentActivity', ACTIVITY_TYPES.START_FROM);
        this._sharedInstancesBag.modalManager?.open(ACTIVITY_TYPES.START_FROM);
      }
    }
  };

  public doneFlow = (): void => {
    const activityBlock = findBlockInCtx(this._sharedInstancesBag.blocksRegistry, (b) => 'doneActivity' in b) as
      | LitActivityBlock
      | undefined;

    if (!activityBlock) {
      return;
    }
    this._ctx.pub('*currentActivity', activityBlock.doneActivity);
    this._ctx.pub('*history', activityBlock.doneActivity ? [activityBlock.doneActivity] : []);
    if (!this._ctx.read('*currentActivity')) {
      this._sharedInstancesBag.modalManager?.closeAll();
    }
  };

  public setCurrentActivity = <T extends ActivityType>(
    activityType: T,
    ...params: T extends keyof ActivityParamsMap
      ? [ActivityParamsMap[T]] extends [never]
        ? []
        : [ActivityParamsMap[T]]
      : []
  ) => {
    // Since Lit renders DOM asynchronously, we need to wait for the next tick to ensure that the activity block is rendered and registered in the context before we try to set it as current.
    // TODO: Do not rely on DOM rendering and block registration order, we should have a better way to handle this.
    // Some kind of ActivityManager that will keep track of registered activities and their states
    setTimeout(() => {
      if (hasBlockInCtx(this._sharedInstancesBag.blocksRegistry, (b) => b.activityType === activityType)) {
        this._ctx.pub('*currentActivityParams', params[0] ?? {});
        this._ctx.pub('*currentActivity', activityType);
        return;
      }
      console.warn(`Activity type "${activityType}" not found in the context`);
    });
  };

  public getCurrentActivity = (): ActivityType => {
    return this._ctx.read('*currentActivity');
  };

  public setModalState = (opened: boolean): void => {
    // Next tick here because setCurrentActivity is also async and we want to make sure that the modal state is set
    setTimeout(() => {
      if (opened && !this._ctx.read('*currentActivity')) {
        console.warn(`Can't open modal without current activity. Please use "setCurrentActivity" method first.`);
        return;
      }

      if (opened) {
        this._sharedInstancesBag.modalManager?.open(this._ctx.read('*currentActivity'));
      } else {
        this._sharedInstancesBag.modalManager?.close(this._ctx.read('*currentActivity'));
        this._ctx.pub('*currentActivity', null);
      }
    });
  };

  private get _sourceList(): string[] {
    let list: string[] = [];
    if (this.cfg.sourceList) {
      list = stringToArray(this.cfg.sourceList);
    }
    return list;
  }
}
