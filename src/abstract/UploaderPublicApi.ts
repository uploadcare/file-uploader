import { parseFileUrl } from '@uploadcare/cdn-url';
import type {
  AuthToken,
  ConfigType,
  OutputCollectionState,
  OutputCollectionStatus,
  OutputFileEntry,
  OutputFileStatus,
  UploadcareFile,
} from '../types/index';
import { applyStyles } from '../utils/applyStyles';
import { DEFAULT_CDN_ORIGIN } from '../utils/cdn/origin';
import { deserializeCsv, serializeCsv } from '../utils/comma-separated';
import {
  BASIC_IMAGE_WILDCARD,
  BASIC_VIDEO_WILDCARD,
  fileDerivedFields,
  IMAGE_ACCEPT_LIST,
  mergeFileTypes,
} from '../utils/fileTypes';
import { parseCdnUrlForEntry } from '../utils/parseCdnUrlForEntry';
import { UploadSource } from '../utils/UploadSource';
import type { ActivityParamsMap, ActivityType } from './activity-constants';
import { ACTIVITY_TYPES } from './activity-constants';
import { buildOutputCollectionState } from './buildOutputCollectionState';
import { CameraSourceTypes, calcCameraModes, type ModeCameraType } from './cameraModes';
import { controllerLogger } from './controllerLogger';
import { AppInfo } from './controllers/AppInfo';
import { CollectionStateController } from './controllers/CollectionStateController';
import { ConfigController } from './controllers/ConfigController';
import { LocaleController } from './controllers/LocaleController';
import { RouterController } from './controllers/RouterController';
import { UploadCollectionController } from './controllers/UploadCollectionController';
import { UploadController } from './controllers/UploadController';
import { CONTAINER, type ControllerContainer } from './di/ControllerContainer';
import { inject } from './di/inject';
import { EventEmitter, type EventKey, type EventPayload, EventType } from './EventEmitter';
import { createL10n } from './l10n';
import { AuthTokenManager } from './managers/AuthTokenManager';
import { PluginController } from './managers/plugin';
import { toOutputFileEntry } from './outputFileEntry';
import type { Uid } from './Uid';
import { type UploadEntryData, uploadcareFileToEntryData } from './uploadEntrySchema';
import { waitForActivityBlock } from './waitForActivityBlock';

export type ApiAddFileCommonOptions = {
  silent?: boolean;
  fileName?: string;
  source?: string;
};

/** Options for adding a local file, which can also carry its path inside a dropped folder. */
type ApiAddFileObjectOptions = ApiAddFileCommonOptions & { fullPath?: string };

/** `silent` and `source` for a new entry: loud and from the JS API, unless the caller says otherwise. */
const addOptions = ({ silent, source }: ApiAddFileCommonOptions) => ({
  silent: silent ?? false,
  source: source ?? UploadSource.API,
});

/** Whether `value` is exactly a file uuid — checked by the same parser that backs `addFileFromCdnUrl`'s validation. */
const isFileUuid = (value: string): boolean => {
  try {
    return parseFileUrl(`${DEFAULT_CDN_ORIGIN}/${value}/`).uuid === value;
  } catch {
    return false;
  }
};

/** The documented `OutputFileEntry` shape of one upload entry. */
/**
 * The documented public JS API (`element.getAPI()`): one instance per ctx, acting on that ctx's uploader. It holds no
 * state of its own; every method reads or drives the ctx's controllers. Once the uploader is destroyed, calling a
 * method throws instead of acting on a stale ctx: get a fresh api from the current `<uc-upload-ctx-provider>`.
 */
export class UploaderPublicApi {
  @inject(AppInfo) private readonly _appInfo!: AppInfo;
  @inject(AuthTokenManager) private readonly _authToken!: AuthTokenManager;
  @inject(CollectionStateController) private readonly _collectionState!: CollectionStateController;

  // Per-ctx logger: `warn`/`error` always print, prefixed with THIS ctx's name
  // (resolved lazily at log time via the container that built this instance).
  private readonly _log = controllerLogger(this, 'public-api');
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(LocaleController) private readonly _locale!: LocaleController;
  @inject(UploadCollectionController) private readonly _collection!: UploadCollectionController;
  // Token thunk: `UploadController` reaches this class back through
  // `ValidationController` (validators receive the api), so a direct token
  // reference would form a value-import cycle that leaves one side `undefined` at
  // decoration time. The thunk defers the lookup to resolution time.
  @inject(() => UploadController) private readonly _uploadController!: UploadController;
  @inject(EventEmitter) private readonly _eventEmitter!: EventEmitter;
  @inject(RouterController) private readonly _router!: RouterController;
  // Lazy thunk: resolved at plugin-read time (`_pluginsReady`/`initFlow`), so
  // there is no construction cycle. `ensurePluginManager` binds the same
  // per-ctx `PluginController` instance on the container this thunk reads.
  @inject(() => PluginController) private readonly _pluginManager!: PluginController;

  // `createL10n` reads the injected `LocaleController` live on every lookup, so a
  // dictionary load / locale switch is reflected without recreating the fn.
  private _l10n = createL10n(() => this._locale);

  /**
   * The per-ctx `ControllerContainer` that built this instance, reached through
   * the `CONTAINER` tag every container-built instance carries (the same tag
   * `@inject` resolves through). Used by `getOutputCollectionState` to hand the
   * container to `buildOutputCollectionState`.
   */
  private get _container(): ControllerContainer {
    const container = (this as { [CONTAINER]?: ControllerContainer })[CONTAINER];
    if (!container) {
      throw new Error('Unexpected error: UploaderPublicApi was not created by a container');
    }
    return container;
  }

  /** @internal Mangled in the build, so it is kept out of the published types. */
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

  /** Adds a file to the upload list from a URL. `silent` suppresses its file events. */
  // TODO: Probably we should not allow user to override `source` property
  public addFileFromUrl = (
    url: string,
    { silent, fileName, source }: ApiAddFileCommonOptions = {},
  ): OutputFileEntry<'idle'> => {
    const internalId = this._uploadCollection.add({
      externalUrl: url,
      fileName: fileName ?? null,
      ...addOptions({ silent, source }),
    });
    return this.getOutputItem(internalId);
  };

  public addFileFromUuid = (
    uuid: string,
    { silent, fileName, source }: ApiAddFileCommonOptions = {},
  ): OutputFileEntry<'idle'> => {
    if (!isFileUuid(uuid)) {
      throw new Error('Invalid UUID');
    }
    const internalId = this._uploadCollection.add({
      uuid,
      fileName: fileName ?? null,
      ...addOptions({ silent, source }),
    });
    return this.getOutputItem(internalId);
  };

  public addFileFromCdnUrl = (
    cdnUrl: string,
    { silent, fileName, source }: ApiAddFileCommonOptions = {},
  ): OutputFileEntry<'idle'> => {
    const parsedCdnUrl = parseCdnUrlForEntry({
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
      ...addOptions({ silent, source }),
    });
    return this.getOutputItem(internalId);
  };

  // Shared entry-init builder for a local File — used by the single-add
  // `addFileFromObject` and the batch `addFilesFromObjects`.
  private _objectFileInit(
    file: File,
    { silent, fileName, source, fullPath }: ApiAddFileObjectOptions = {},
  ): Partial<UploadEntryData> {
    return {
      file,
      ...fileDerivedFields(file),
      fileName: fileName ?? file.name,
      ...addOptions({ silent, source }),
      fullPath: fullPath ?? null,
    };
  }

  public addFileFromObject = (file: File, options: ApiAddFileObjectOptions = {}): OutputFileEntry<'idle'> => {
    const internalId = this._uploadCollection.add(this._objectFileInit(file, options));
    return this.getOutputItem(internalId);
  };

  /**
   * Batch-add local `File`s in one shot. Cheaper than looping `addFileFromObject`
   * at large counts: the collection arms its membership/property flushes ONCE for
   * the whole batch, and it skips the per-file `getOutputItem` `OutputFileEntry`
   * build that the single-add returns (and callers here discard).
   */
  public addFilesFromObjects = (entries: ReadonlyArray<{ file: File } & ApiAddFileObjectOptions>): void => {
    if (entries.length === 0) {
      return;
    }
    // Pass the whole entry as options — `_objectFileInit` picks only named fields
    // (its extra `file` key is ignored), so we skip a rest-object alloc per entry.
    this._uploadCollection.addMany(entries.map((entry) => this._objectFileInit(entry.file, entry)));
  };

  public addFileFromUploadcareFile = (
    file: UploadcareFile,
    { silent, fileName, source }: ApiAddFileCommonOptions = {},
  ): OutputFileEntry<'success'> => {
    const internalId = this._uploadCollection.add({
      ...uploadcareFileToEntryData(file),
      // A caller-supplied name takes precedence over the file's own.
      fileName: fileName ?? file.originalFilename ?? null,
      ...addOptions({ silent, source }),
    });
    return this.getOutputItem(internalId);
  };

  /**
   * Replace an existing entry with an already-uploaded Uploadcare file, keeping
   * its position in the list. The original entry is removed and a fresh one is
   * added in its place, so the replacement goes through the full add pipeline
   * (validators, events) like any newly added file.
   *
   * The original entry's `source`, `metadata`, `fullPath` and `silent` are
   * preserved by default; `silent`, `fileName` and `source` can be overridden
   * via `options`.
   *
   * Returns the new entry. Note: it has a NEW `internalId` — use the returned
   * entry to reference the replacement going forward.
   */
  public replaceFile = (
    internalId: string,
    file: UploadcareFile,
    { silent, fileName, source }: ApiAddFileCommonOptions = {},
  ): OutputFileEntry<'success'> => {
    const oldId = internalId as Uid;
    const collection = this._uploadCollection;
    const index = collection.items().indexOf(oldId);
    const oldEntry = collection.read(oldId);
    if (index === -1 || !oldEntry) {
      throw new Error(`File with internalId ${internalId} not found`);
    }
    // Carry over the original entry's context so the replacement keeps its
    // identity within the session; everything file-specific comes from `file`.
    const preserved = {
      source: oldEntry.get('source'),
      metadata: oldEntry.get('metadata'),
      fullPath: oldEntry.get('fullPath'),
      silent: oldEntry.get('silent'),
    };
    collection.remove(oldId);
    const newId = collection.add(
      {
        ...uploadcareFileToEntryData(file),
        fileName: fileName ?? file.originalFilename ?? null,
        silent: silent ?? preserved.silent,
        source: source ?? preserved.source ?? UploadSource.API,
        metadata: preserved.metadata,
        fullPath: preserved.fullPath,
      },
      { index },
    );
    return this.getOutputItem<'success'>(newId);
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
        !entry.get('isRemoved') &&
        !entry.get('isUploading') &&
        !entry.get('fileInfo') &&
        // A failed upload is final; its error joins `errors` only on the next validation run.
        !entry.get('uploadError') &&
        entry.get('errors').length === 0 &&
        !entry.get('isValidationPending') &&
        !entry.get('isQueuedForValidation')
      );
    });

    if (itemsToUpload.length === 0) {
      return;
    }

    // Uploads through the controller (its `uploadEntry` is precondition-guarded +
    // idempotent), so uploading doesn't depend on an item being rendered.
    this._uploadController.uploadEntries(itemsToUpload);
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
        const source = options.captureCamera ? UploadSource.CAMERA : UploadSource.LOCAL;
        this.addFilesFromObjects([...fileInput.files].map((file) => ({ file, source })));
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
    // This ctx's collection, not the global entry registry: another uploader's ids must not resolve here.
    const entry = this._collection.read(entryId as Uid);
    if (!entry) {
      throw new Error(`UploaderPublicApi#getOutputItem: Entry with ID "${entryId}" not found in the upload collection`);
    }
    return toOutputFileEntry<TStatus>(entry);
  }

  public getOutputCollectionState<TStatus extends OutputCollectionStatus>() {
    return buildOutputCollectionState(this._container) as ReturnType<typeof buildOutputCollectionState<TStatus>>;
  }

  public initFlow = (force = false): void => {
    const router = this._router;
    if (this._uploadCollection.size > 0 && !force) {
      router.navigate(ACTIVITY_TYPES.UPLOAD_LIST);
    } else {
      if (this._sourceList?.length === 1) {
        const srcKey = this._sourceList[0];

        this._whenPluginsReady(() => {
          const sources = this._pluginManager.snapshot().sources;
          const registeredSource = sources.find((s) => s.id === srcKey);

          if (registeredSource) {
            const expandedIds = registeredSource.expand?.() ?? [srcKey];

            if (expandedIds.length === 1) {
              const target = sources.find((s) => s.id === expandedIds[0]) ?? registeredSource;
              // Returned so the deferred navigation's task awaits the plugin hook and logs its failure.
              return target.onSelect();
            }
            router.navigate(ACTIVITY_TYPES.START_FROM);
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

  private _pluginsReady(): Promise<void> {
    // The plugin manager is container-resolved (`@inject`) and always bound by
    // the time a plugin read fires (see class doc), so this resolves
    // synchronously and returns its readiness promise directly.
    return this._pluginManager.pluginsReady();
  }

  /**
   * Run `then` once plugins are ready, unless the ctx is torn down first — it reads the router and plugin manager,
   * which are gone by then. A failure is logged rather than left as an unhandled rejection.
   */
  private _whenPluginsReady(then: () => unknown): void {
    const ready = this._pluginsReady();
    const lifetime = this._container.lifetime;
    lifetime.run(
      async () => {
        await lifetime.guard(ready);
        await then();
      },
      (error) => this._log.error('a deferred navigation failed', error),
    );
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
    this._whenPluginsReady(() => {
      this._router.navigate(activityType, params[0] ?? {});
      if (activityType !== null) {
        // Never rejects; returned so the wait belongs to the deferred navigation's task.
        return waitForActivityBlock(this._router, activityType, {
          onTimeout: () => this._log.warn(`Activity type "${activityType}" not found in the context`),
          timeout: 100,
        });
      }
      return;
    });
  };

  /**
   * @deprecated Use {@link navigate} instead — it sets the activity *and* shows
   * it in one call. With the modal closed, `setCurrentActivity` only sets the
   * activity (in the background slot) without opening the modal, so it must be
   * paired with `setModalState(true)`; with the modal open it switches the modal
   * to the activity, as in v1.
   */
  public setCurrentActivity = <T extends ActivityType>(
    activityType: T,
    ...params: T extends keyof ActivityParamsMap
      ? [ActivityParamsMap[T]] extends [never]
        ? []
        : [ActivityParamsMap[T]]
      : []
  ) => {
    this._whenPluginsReady(() => {
      // `setCurrentActivity(null)` means "no current activity" — close every
      // slot (background + modal). An open modal switches to the activity, as
      // in v1. Otherwise set the background activity (no modal); a paired
      // `setModalState(true)` opens it in the modal slot.
      if (activityType === null) {
        this._router.navigate(null);
        return;
      }
      if (this._router.modal !== null) {
        this._router.openModal(activityType, params[0]);
      } else {
        this._router.setActivity(activityType, params[0]);
      }
      // Never rejects; returned so the wait belongs to the deferred navigation's task.
      return waitForActivityBlock(this._router, activityType, {
        onTimeout: () => this._log.warn(`Activity type "${activityType}" not found in the context`),
        timeout: 100,
      });
    });
  };

  public on = <T extends EventKey>(type: T, handler: (payload: EventPayload[T]) => void): (() => void) => {
    return this._eventEmitter.on(type, handler);
  };

  /**
   * The auth token as `@uploadcare/upload-client` receives it: the configured
   * string, or a resolver whose result the uploader already caches.
   *
   * Forward this rather than `cfg.authToken` when something else has to
   * authenticate with the same token — a plugin, say — so it shares this cache
   * instead of calling your token endpoint again.
   *
   * Returns `undefined`, not the config's `null`, when no token is set: this is
   * upload-client's `authToken?: AuthToken`, so it can be passed straight on.
   *
   * The value reflects `authToken` at the time of the call. Call it again after
   * `authToken` changes, for example from a `config.subscribe('authToken')`
   * handler.
   */
  public getAuthToken = (): AuthToken | undefined => {
    return this._authToken.getAuthToken();
  };

  /**
   * Drop the cached auth token, so the next request asks `authToken` for a new
   * one.
   *
   * Assigning a different function to `authToken` does not do this: a new
   * function identity is taken to be the same function, which is what lets a
   * React component pass an inline resolver without refetching on every render.
   * Call this when the change is real — the signed-in user changed, say — or
   * rely on short-lived tokens.
   */
  public invalidateAuthToken = (): void => {
    this._authToken.invalidate();
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
    this._whenPluginsReady(() => {
      const router = this._router;
      if (!opened) {
        // A solution without a modal (the inline uploader) has none to close; nulling its activity would only reset it
        // to the start screen.
        if (!this._appInfo.hasModal) {
          this._log.warnOnce(
            'setModalState(false) does nothing for the inline uploader, which has no modal. Use navigate() to change its activity.',
          );
          return;
        }
        // Close everything (matches v1: close the modal + null the activity,
        // which also cleared history).
        router.navigate(null);
        return;
      }

      // An open modal already shows the intended activity: `setCurrentActivity`
      // switches it. Otherwise open the one `setCurrentActivity` put in the
      // background slot.
      const activityType = router.modal ?? router.activity ?? router.currentActivity;
      if (!activityType) {
        this._log.warn(`Can't open modal without current activity. Please use "setCurrentActivity" method first.`);
        return;
      }

      return this._container.lifetime
        .guard(
          waitForActivityBlock(router, activityType, {
            onTimeout: () => this._log.warn(`Activity block "${activityType}" not found in the context`),
          }),
        )
        .then((found) => {
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
    return deserializeCsv(this.cfg.sourceList);
  }

  public destroy(): void {
    // No subscriptions of its own to unwind (config/locale/router/… are
    // container-owned and disposed by the container). Present so the container
    // can treat every owned instance uniformly.
  }
}
