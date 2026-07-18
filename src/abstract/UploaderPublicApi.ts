// @ts-check

import { calcCameraModes } from '../blocks/CameraSource/calcCameraModes';
import { CameraSourceTypes, type ModeCameraType } from '../blocks/CameraSource/constants';
import { EventEmitter, type EventKey, type EventPayload, EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import type { ActivityParamsMap, ActivityType } from '../lit/activity-constants';
import { ACTIVITY_TYPES } from '../lit/activity-constants';
import { waitForActivityBlock } from '../lit/hasBlockInCtx';
import { createL10n } from '../lit/l10n';
import type { SharedInstancesBag } from '../lit/shared-instances';
import type { Uid } from '../lit/Uid';
import type {
  ConfigType,
  OutputCollectionState,
  OutputCollectionStatus,
  OutputFileEntry,
  OutputFileStatus,
  UploadcareFile,
} from '../types/index';
import { applyStyles } from '../utils/applyStyles';
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
import { CollectionStateController } from './controllers/CollectionStateController';
import { ConfigController } from './controllers/ConfigController';
import { LocaleController } from './controllers/LocaleController';
import { RouterController } from './controllers/RouterController';
import { UploadCollectionController } from './controllers/UploadCollectionController';
import { inject } from './di/inject';
import { TypedData } from './TypedData';
import type { UploadEntryData } from './uploadEntrySchema';

export type ApiAddFileCommonOptions = {
  silent?: boolean;
  fileName?: string;
  source?: string;
};

/**
 * The documented public JS API (`element.getAPI()`).
 *
 * M-god step 8a: rewritten off the `bag`/`SharedInstance` proxy onto container
 * `@inject`. It is now a thin facade over single-responsibility controllers
 * resolved from the per-ctx DI container — config/locale/collection/collection-
 * state/events/router are injected fields, so this class no longer extends
 * `SharedInstance`, holds no ctx, and reads no `*cfg/*`/`*l10n/*` facade keys.
 * It is created through the container (`ensureUploaderScope` → `container.get`)
 * so `@inject` resolves, and stays reachable as `bag.api` / `*publicApi` /
 * `UploaderController.api` (the same single instance) during the transition.
 *
 * Two dependencies are NOT container-resolvable yet and stay on a bag bridge
 * (`setBagBridge`, wired at registration in `ensureUploaderScope`):
 *  - the plugin manager (`*pluginManager` is still DOM-layer-constructed;
 *    step 8b will make it `@inject(() => PluginController)`);
 *  - `buildOutputCollectionState`, which still reads the derived collection keys
 *    off the `bag`/ctx (its own off-facade rewrite is out of step-8a scope).
 * Everything else is `@inject`.
 */
export class UploaderPublicApi {
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(LocaleController) private readonly _locale!: LocaleController;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;
  @inject(EventEmitter) private readonly _eventEmitter!: EventEmitter;
  @inject(RouterController) private readonly _router!: RouterController;

  // Bag bridge for the two still-not-injectable dependencies (see class doc).
  // Set once at registration; step 8b/later dissolves it entirely.
  private _getBag: (() => SharedInstancesBag) | null = null;

  // `createL10n` reads the injected `LocaleController` live on every lookup, so a
  // dictionary load / locale switch is reflected without recreating the fn.
  private _l10n = createL10n(() => this._locale);

  /**
   * Wire the bag bridge. Called once by `ensureUploaderScope` right after the
   * container resolves this instance — before any consumer can reach the api.
   */
  public setBagBridge(getBag: () => SharedInstancesBag): void {
    this._getBag = getBag;
  }

  private get _bag(): SharedInstancesBag {
    if (!this._getBag) {
      throw new Error('Unexpected error: UploaderPublicApi used before its bag bridge was wired');
    }
    return this._getBag();
  }

  public get _uploadCollection(): UploadCollectionController {
    return this._collection;
  }

  /**
   * Read-only view of the live config (part of the documented api surface —
   * consumed by the built-in validators). Backed by the injected
   * `ConfigController`'s live values object.
   */
  public get cfg(): Readonly<ConfigType> {
    return this._config.values;
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
      mimeType: file.type || null,
      fileName: fileName ?? file.name,
      fileSize: file.size,
      silent: silent ?? false,
      source: source ?? UploadSource.API,
      fullPath: fullPath ?? null,
    });
    return this.getOutputItem(internalId);
  };

  public addFileFromUploadcareFile = (
    file: UploadcareFile,
    { silent, fileName, source }: ApiAddFileCommonOptions = {},
  ): OutputFileEntry<'success'> => {
    const internalId = this._uploadCollection.add({
      fileInfo: file,
      uuid: file.uuid,
      cdnUrl: file.cdnUrl,
      fileName: fileName ?? file.originalFilename,
      fileSize: file.size,
      isImage: file.isImage ?? false,
      mimeType: file.contentInfo?.mime?.mime ?? file.mimeType,
      uploadProgress: 100,
      silent: silent ?? false,
      source: source ?? UploadSource.API,
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

    // Replace (not mutate) the `uploadTrigger` Set — the `Object.is` dedup on
    // `CollectionStateController.set` fires subscribers only on a new reference,
    // preserving the v1 `ctx.pub('*uploadTrigger', new Set(...))` semantics.
    this._collectionState.set('uploadTrigger', new Set(itemsToUpload));
    this._eventEmitter.emit(
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
        // To call uploadTrigger UploadList should draw file items first.
        this._router.traverse('onFileAdd');
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
    const entry = TypedData.getByUid<UploadEntryData>(entryId);
    if (!entry) {
      throw new Error(`UploaderPublicApi#getOutputItem: Entry with ID "${entryId}" not found in the upload collection`);
    }
    const uploadEntryData = entry.snapshot();
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
    return buildOutputCollectionState(this._bag) as ReturnType<typeof buildOutputCollectionState<TStatus>>;
  }

  public initFlow = (force = false): void => {
    const router = this._router;
    if (this._uploadCollection.size > 0 && !force) {
      router.navigate(ACTIVITY_TYPES.UPLOAD_LIST);
    } else {
      if (this._sourceList?.length === 1) {
        const srcKey = this._sourceList[0];

        void this._pluginsReady().then(() => {
          const sources = this._bag.pluginManager.snapshot().sources;
          const registeredSource = sources.find((s) => s.id === srcKey);

          if (registeredSource) {
            const expandedIds = registeredSource.expand?.() ?? [srcKey];

            if (expandedIds.length === 1) {
              const target = sources.find((s) => s.id === expandedIds[0]) ?? registeredSource;
              target.onSelect();
            } else {
              router.navigate(ACTIVITY_TYPES.START_FROM);
            }
            return;
          }

          const current = router.currentActivity;
          if (current) {
            router.openModal(current);
          }
        });
      } else {
        router.navigate(ACTIVITY_TYPES.START_FROM);
      }
    }
  };

  public doneFlow = (): void => {
    // Reset the router: clear everything (also wipes history), then land on the
    // preset's configured done activity (set via `router.configure`).
    const router = this._router;
    router.navigate(null);
    if (router.doneActivity) {
      router.navigate(router.doneActivity);
    }
  };

  private async _pluginsReady(): Promise<void> {
    // Plugin manager is still bag-bridged (see class doc); step 8b makes this
    // `@inject(() => PluginController)`.
    const pluginManager = await this._bag.wait('pluginManager');
    return pluginManager.pluginsReady();
  }

  /**
   * Navigate to an activity and show it in the slot appropriate for the current
   * preset (a modal in `regular`, inline in `inline`, a modal over the trigger
   * in `minimal`). Pass `null` to close everything.
   *
   * This is the v2 routing entry point — the single-call replacement for the
   * `setCurrentActivity` + `setModalState(true)` pair.
   */
  public navigate = <T extends ActivityType>(
    activityType: T,
    ...params: T extends keyof ActivityParamsMap
      ? [ActivityParamsMap[T]] extends [never]
        ? []
        : [ActivityParamsMap[T]]
      : []
  ) => {
    void this._pluginsReady().then(() => {
      this._router.navigate(activityType, params[0] ?? {});
      if (activityType !== null) {
        waitForActivityBlock(this._router, activityType, {
          onTimeout: () => console.warn(`Activity type "${activityType}" not found in the context`),
          timeout: 100,
        });
      }
    });
  };

  /**
   * @deprecated Use {@link navigate} instead — it sets the activity *and* shows
   * it in one call. `setCurrentActivity` only sets the activity (in the
   * background slot) without opening the modal, so it must be paired with
   * `setModalState(true)`.
   */
  public setCurrentActivity = <T extends ActivityType>(
    activityType: T,
    ...params: T extends keyof ActivityParamsMap
      ? [ActivityParamsMap[T]] extends [never]
        ? []
        : [ActivityParamsMap[T]]
      : []
  ) => {
    void this._pluginsReady().then(() => {
      // `setCurrentActivity(null)` means "no current activity" — close every
      // slot (background + modal). Otherwise set the background activity (no
      // modal); a paired `setModalState(true)` opens it in the modal slot.
      if (activityType === null) {
        this._router.navigate(null);
        return;
      }
      this._router.setActivity(activityType, params[0]);
      waitForActivityBlock(this._router, activityType, {
        onTimeout: () => console.warn(`Activity type "${activityType}" not found in the context`),
        timeout: 100,
      });
    });
  };

  public on = <T extends EventKey>(type: T, handler: (payload: EventPayload[T]) => void): (() => void) => {
    return this._eventEmitter.on(type, handler);
  };

  public getCurrentActivity = (): ActivityType => {
    return this._router.currentActivity;
  };

  public historyBack = (): void => {
    this._router.back();
  };

  /**
   * @deprecated Use {@link navigate} to open an activity, or `navigate(null)`
   * to close. `setModalState` only toggles the modal for the activity that was
   * already set via `setCurrentActivity`.
   */
  public setModalState = (opened: boolean): void => {
    void this._pluginsReady().then(() => {
      const router = this._router;
      if (!opened) {
        // Close everything (matches v1: close the modal + null the activity,
        // which also cleared history).
        router.navigate(null);
        return;
      }

      // Open the modal for the *intended* activity — the one `setCurrentActivity`
      // put in the background slot — not the effective current activity (which,
      // if a modal is already open, is that stale modal and would no-op).
      const activityType = router.activity ?? router.currentActivity;
      if (!activityType) {
        console.warn(`Can't open modal without current activity. Please use "setCurrentActivity" method first.`);
        return;
      }

      return waitForActivityBlock(router, activityType, {
        onTimeout: () => console.warn(`Activity block "${activityType}" not found in the context`),
      }).then((found) => {
        if (!found) {
          // Timeout — the activity's block never appeared; keep the modal
          // closed (same observable behavior as before the promise settled).
          return;
        }
        router.openModal(activityType);
      });
    });
  };

  private get _sourceList(): string[] {
    let list: string[] = [];
    if (this.cfg.sourceList) {
      list = stringToArray(this.cfg.sourceList);
    }
    return list;
  }

  public destroy(): void {
    // No subscriptions of its own to unwind (config/locale/router/… are
    // container-owned and disposed by the container). Present so the container
    // can treat every owned instance uniformly.
  }
}
