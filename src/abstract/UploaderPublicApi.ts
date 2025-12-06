// @ts-check

import { calcCameraModes } from '../blocks/CameraSource/calcCameraModes';
import { CameraSourceTypes, type ModeCameraType } from '../blocks/CameraSource/constants';
import type { SourceBtn } from '../blocks/SourceBtn/SourceBtn';
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import {
  type ActivityParamsMap,
  type ActivityType,
  LitActivityBlock,
  type RegisteredActivityType,
} from '../lit/LitActivityBlock';
import type { LitBlock } from '../lit/LitBlock';
import type { LitUploaderBlock } from '../lit/LitUploaderBlock';
import { PubSub } from '../lit/PubSubCompat';
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

export class UploaderPublicApi {
  private _ctx: LitUploaderBlock;

  public constructor(ctx: LitUploaderBlock) {
    this._ctx = ctx;
  }

  private get _uploadCollection() {
    return this._ctx.uploadCollection;
  }

  public get cfg() {
    return this._ctx.cfg;
  }

  public get l10n() {
    return this._ctx.l10n.bind(this._ctx);
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
    if (!this._uploadCollection.read(internalId)) {
      throw new Error(`File with internalId ${internalId} not found`);
    }
    this._uploadCollection.remove(internalId);
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

    this._ctx.$['*uploadTrigger'] = new Set(itemsToUpload);
    this._ctx.emit(
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
        this._ctx.modalManager?.open(LitActivityBlock.activities.UPLOAD_LIST);
        this._ctx.$['*currentActivity'] = LitActivityBlock.activities.UPLOAD_LIST;
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
    const uploadEntryData = PubSub.getCtx<UploadEntryData>(entryId)!.store;
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
    return buildOutputCollectionState(this._ctx) as ReturnType<typeof buildOutputCollectionState<TStatus>>;
  }

  public initFlow = (force = false): void => {
    if (this._uploadCollection.size > 0 && !force) {
      this._ctx.modalManager?.open(LitActivityBlock.activities.UPLOAD_LIST);
      this._ctx.set$({
        '*currentActivity': LitActivityBlock.activities.UPLOAD_LIST,
      });
    } else {
      if (this._sourceList?.length === 1) {
        const srcKey = this._sourceList[0];

        // TODO: We should refactor those handlers
        if (srcKey === 'local') {
          this._ctx.$['*currentActivity'] = LitActivityBlock.activities.UPLOAD_LIST;
          this.openSystemDialog();
          return;
        }

        if (srcKey === 'camera' && browserFeatures.htmlMediaCapture) {
          const { isPhotoEnabled, isVideoRecordingEnabled } = calcCameraModes(this.cfg);

          if (isPhotoEnabled && isVideoRecordingEnabled) {
            this._ctx.set$({
              '*currentActivity': LitActivityBlock.activities.START_FROM,
            });
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

        const blocksRegistry = this._ctx.$['*blocksRegistry'] as Set<LitBlock>;
        const isSourceBtn = (block: LitBlock): block is SourceBtn =>
          'type' in (block as any) && (block as any).type === srcKey;
        const sourceBtnBlock = [...blocksRegistry].find(isSourceBtn);
        // TODO: This is weird that we have this logic inside UI component, we should consider to move it somewhere else
        sourceBtnBlock?.activate();

        if (this._ctx.$['*currentActivity']) {
          this._ctx.modalManager?.open(this._ctx.$['*currentActivity']);
        }
      } else {
        // Multiple sources case:
        this._ctx.modalManager?.open(LitActivityBlock.activities.START_FROM);
        this._ctx.set$({
          '*currentActivity': LitActivityBlock.activities.START_FROM,
        });
      }
    }
  };

  public doneFlow = (): void => {
    this._ctx.set$({
      '*currentActivity': this._ctx.doneActivity,
      '*history': this._ctx.doneActivity ? [this._ctx.doneActivity] : [],
    });
    if (!this._ctx.$['*currentActivity']) {
      this._ctx.modalManager?.closeAll();
    }
  };

  public setCurrentActivity = <T extends ActivityType>(
    activityType: T,
    ...[params]: T extends keyof ActivityParamsMap
      ? [ActivityParamsMap[T]]
      : T extends RegisteredActivityType
        ? [undefined?]
        : [unknown?]
  ) => {
    if (this._ctx.hasBlockInCtx((b) => b.activityType === activityType)) {
      this._ctx.set$({
        '*currentActivityParams': params ?? {},
        '*currentActivity': activityType,
      });
      return;
    }
    console.warn(`Activity type "${activityType}" not found in the context`);
  };

  public getCurrentActivity = (): ActivityType => {
    return this._ctx.$['*currentActivity'];
  };

  public setModalState = (opened: boolean): void => {
    if (opened && !this._ctx.$['*currentActivity']) {
      console.warn(`Can't open modal without current activity. Please use "setCurrentActivity" method first.`);
      return;
    }

    if (opened) {
      this._ctx.modalManager?.open(this._ctx.$['*currentActivity']);
    } else {
      this._ctx.modalManager?.close(this._ctx.$['*currentActivity']);
      this._ctx.$['*currentActivity'] = null;
    }
  };

  private get _sourceList(): string[] {
    let list: string[] = [];
    if (this.cfg.sourceList) {
      list = stringToArray(this.cfg.sourceList);
    }
    return list;
  }
}
