import type { ConfigController } from '../abstract/controllers/ConfigController';
import type { RouterController } from '../abstract/controllers/RouterController';
import type { AddFileOptions, UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import type { UploadController } from '../abstract/controllers/UploadController';
import type { UploaderController } from '../abstract/controllers/UploaderController';
import type { OutputCollectionStatus, OutputFileEntry } from '../types/exported';
import { stringToArray } from '../utils/stringToArray';
import type { ActivityId } from './activity-ids';
import type { EventBus, UploaderEventKey, UploaderEventPayload } from './EventBus';
import { buildOutputCollectionState, getOutputItem } from './output-collection-state';

/**
 * Options accepted by every `addFile*` method. Re-exported for v1 parity
 * (used to live at `src/abstract/UploaderPublicApi.ts`).
 */
export type ApiAddFileCommonOptions = AddFileOptions;

const _warnedDeprecated = new Set<string>();
function _warnDeprecated(config: ConfigController, deprecated: string, replacement: string): void {
  if (_warnedDeprecated.has(deprecated)) return;
  _warnedDeprecated.add(deprecated);
  const debug = (config.values as { debug?: boolean }).debug;
  if (!debug) return;
  console.warn(`[uploadcare] \`api.${deprecated}()\` is deprecated. Use \`api.${replacement}()\` instead.`);
}

/**
 * Public facade over the v2 controllers. Stable surface for consumers —
 * internal controllers may evolve without breaking `element.api.*`.
 *
 * Includes the v1 method names (`initFlow`, `doneFlow`, `setCurrentActivity`,
 * `getCurrentActivity`, `setModalState`) as `@deprecated` aliases so v1
 * consumers continue to work. Use the v2 names (`open`, `close`,
 * `setActivity`, `getActivity`) in new code.
 */
export class UploaderApi {
  public constructor(
    private _controller: UploaderController,
    private _config: ConfigController,
    private _router: RouterController,
    private _collection: UploadCollectionController,
    private _events: EventBus,
    private _upload: UploadController,
  ) {}

  public get config() {
    return this._config.values;
  }

  /**
   * v1-compat alias for `this._collection`. Several v1 plugins reach in
   * for `uploaderApi._uploadCollection.size` and similar — exposing the
   * controller directly here keeps them working without leaking v2
   * internals through the new API.
   *
   * @deprecated Use `api.getItems()` / `api.getOutputCollectionState()`.
   */
  public get _uploadCollection() {
    return this._collection;
  }

  public setConfig<
    K extends keyof ReturnType<UploaderApi['config'] extends (...a: any[]) => any ? UploaderApi['config'] : never>,
  >(key: K, value: unknown): void {
    // biome-ignore lint/suspicious/noExplicitAny: variadic config api
    this._config.set(key as any, value as any);
  }

  // ─── Files ────────────────────────────────────────────────────────────

  public addFileFromObject(file: File, options: ApiAddFileCommonOptions & { fullPath?: string } = {}): OutputFileEntry {
    return this._collection.addFile(file, options);
  }

  public addFileFromUrl(url: string, options: ApiAddFileCommonOptions = {}): OutputFileEntry {
    return this._collection.addFileFromUrl(url, options);
  }

  public addFileFromUuid(uuid: string, options: ApiAddFileCommonOptions = {}): OutputFileEntry {
    return this._collection.addFileFromUuid(uuid, options);
  }

  public addFileFromCdnUrl(cdnUrl: string, options: ApiAddFileCommonOptions = {}): OutputFileEntry {
    return this._collection.addFileFromCdnUrl(cdnUrl, options);
  }

  public removeFileByInternalId(internalId: string): void {
    this._collection.remove(internalId);
  }

  public removeAllFiles(): void {
    this._collection.clearAll();
  }

  public uploadAll(): void {
    void this._upload.runAll();
  }

  public getItems(): OutputFileEntry[] {
    return this._collection.items;
  }

  /**
   * Returns the full `OutputFileEntry` for one item — matches v1's
   * `getOutputItem`. Throws if the id isn't in the collection.
   */
  public getOutputItem<TStatus extends OutputFileEntry['status'] = OutputFileEntry['status']>(
    internalId: string,
  ): OutputFileEntry<TStatus> {
    const entry = this._collection.read(internalId);
    if (!entry) {
      throw new Error(`UploaderApi#getOutputItem: Entry with ID "${internalId}" not found in the upload collection`);
    }
    return getOutputItem(entry) as OutputFileEntry<TStatus>;
  }

  /**
   * Snapshot of the full collection state. v1 parity — same shape, same
   * memoized getters, same async-access warning.
   */
  public getOutputCollectionState<TStatus extends OutputCollectionStatus = OutputCollectionStatus>() {
    return buildOutputCollectionState<TStatus>(this._controller);
  }

  // ─── Activity / router ────────────────────────────────────────────────

  /**
   * Open the uploader at the given activity id. With no argument,
   * picks `start-from` for an empty collection or `upload-list`
   * otherwise. Routes through the preset's `navigationStrategy`, so
   * the destination lands in the modal (regular/minimal source picker)
   * or inline (inline preset) automatically.
   */
  public open(activity?: ActivityId): void {
    const target: ActivityId = activity ?? (this._collection.size > 0 ? 'upload-list' : 'start-from');
    this._router.navigate(target);
  }

  /**
   * Close the uploader modal. Doesn't touch the background activity, so
   * the minimal preset's trigger stays visible after closing. Emits
   * `modal-close`.
   */
  public close(): void {
    this._router.closeModal();
  }

  public setActivity(activity: ActivityId | null, params?: Record<string, unknown>): void {
    this._router.navigate(activity, params);
  }

  public getActivity(): ActivityId | null {
    // Prefer the modal (foreground) slot — v1 callers expect a single
    // "current activity" that covers both inline + modal placement,
    // and modal activities are what consumers most often act on.
    return this._router.modal ?? this._router.activity;
  }

  public historyBack(): void {
    this._router.back();
  }

  // ─── v1 compat aliases ────────────────────────────────────────────────

  /**
   * Open the uploader flow. v1 parity:
   *  - If the collection is non-empty and `force` is not set → `upload-list`.
   *  - If exactly one source is configured → invoke that source's
   *    `onSelect()` directly (local → system dialog, url → url activity, …).
   *  - Otherwise → `start-from`.
   *
   * @deprecated Use `open()` instead. Removed in next major version.
   */
  public initFlow(force = false): void {
    _warnDeprecated(this._config, 'initFlow', 'open');
    if (this._collection.size > 0 && !force) {
      this.open();
      return;
    }
    const cfg = this._config.values as { sourceList?: string };
    const requested = stringToArray(cfg.sourceList ?? '');
    if (requested.length === 1) {
      const sourceId = requested[0];
      // Bypass `controller.sources.list` (microtask-debounced cache) and
      // read the plugin registry directly — config + plugin updates may
      // not have refreshed the resolved list yet.
      const registered = this._controller.plugins.sources;
      const source = registered.find((s) => s.id === sourceId);
      if (source) {
        source.onSelect();
        return;
      }
    }
    this.open('start-from');
  }

  /**
   * Close all open modals and reset the activity.
   *
   * @deprecated Use `close()` instead. Removed in next major version.
   */
  public doneFlow(): void {
    _warnDeprecated(this._config, 'doneFlow', 'close');
    this._router.navigate(null);
  }

  /**
   * Navigate to an activity. v1 used variadic params; v2 takes a single
   * `params` object via the second argument.
   *
   * @deprecated Use `setActivity(activity, params)` instead. Removed in next major version.
   */
  public setCurrentActivity<T extends ActivityId>(activityType: T, params: Record<string, unknown> = {}): void {
    _warnDeprecated(this._config, 'setCurrentActivity', 'setActivity');
    this._router.navigate(activityType, params);
  }

  /**
   * @deprecated Use `getActivity()` instead. Removed in next major version.
   */
  public getCurrentActivity(): ActivityId | null {
    _warnDeprecated(this._config, 'getCurrentActivity', 'getActivity');
    return this.getActivity();
  }

  /**
   * Open or close the modal for the current activity. v1's manual modal
   * open/close API.
   *
   * @deprecated Use `open(activity)` / `close()` instead. Removed in next major version.
   */
  public setModalState(opened: boolean): void {
    _warnDeprecated(this._config, 'setModalState', 'open/close');
    if (!opened) {
      this._router.closeModal();
      return;
    }
    // Prefer the FOREGROUND slot — v1 callers typically pair this with
    // `setCurrentActivity(id, params)` which lands in `router.modal`,
    // and re-opening that slot is the right thing. Fall back to the
    // background activity (`router.activity`) for the cases where the
    // caller really did set a background activity and now wants a
    // modal layered over it.
    const target = this._router.modal ?? this._router.activity;
    if (!target) {
      console.warn(
        '[uploadcare] `api.setModalState(true)` called without a current activity. Use `api.open(activityId)` instead.',
      );
      return;
    }
    this._router.openModal(target);
  }

  // ─── Events ───────────────────────────────────────────────────────────

  public on<K extends UploaderEventKey>(type: K, handler: (payload: UploaderEventPayload[K]) => void): () => void {
    return this._events.on(type, handler);
  }

  /**
   * Opens the system file picker. Pass `captureCamera: true` to bias the
   * picker toward the device camera; `modeCamera: 'photo' | 'video'` further
   * narrows the accept filter.
   */
  public openSystemDialog(
    options: {
      multiple?: boolean;
      accept?: string;
      captureCamera?: boolean;
      modeCamera?: 'photo' | 'video';
      source?: string;
    } = {},
  ): void {
    const input = document.createElement('input');
    input.type = 'file';
    if (options.multiple ?? true) input.multiple = true;
    if (options.captureCamera) {
      input.capture = 'environment';
      if (options.modeCamera === 'photo') input.accept = 'image/*';
      else if (options.modeCamera === 'video') input.accept = 'video/*';
      else input.accept = 'image/*,video/*';
    } else if (options.accept) {
      input.accept = options.accept;
    }
    input.style.cssText = 'position:absolute;left:-9999px;height:0;width:0;';
    input.addEventListener(
      'change',
      () => {
        if (input.files && input.files.length > 0) {
          for (const f of input.files) {
            this.addFileFromObject(f, { source: options.source ?? 'local' });
          }
          // Route through the hook chain — SmartBtn overrides this to
          // keep the modal closed when there's no history (file added
          // directly from the trigger). Defaults to navigating to
          // `upload-list`.
          this._router.afterFileAdd();
        }
        input.remove();
      },
      { once: true },
    );
    document.body.appendChild(input);
    input.click();
  }
}
