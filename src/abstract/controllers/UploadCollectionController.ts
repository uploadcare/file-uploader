import type { OutputFileEntry } from '../../types/exported';
import { fileIsImage } from '../../utils/fileTypes';
import { parseCdnUrl } from '../../utils/parseCdnUrl';
import { type EventBus, UploaderEventType } from '../EventBus';
import { Listeners } from '../host-subscription';
import { getOutputItem } from '../output-collection-state';
import { UploadCollection } from '../UploadCollection';
import type { UploadEntry } from '../UploadEntry';
import type { UploadEntryFields } from '../UploadEntryFields';
import type { ConfigController } from './ConfigController';
import type { ValidationController } from './ValidationController';

export type BeforeUploadHandler = (ctx: {
  file: File;
  item: OutputFileEntry;
}) => Promise<{ file: File } | undefined> | { file: File } | undefined;

export type OnAddHandler = (ctx: {
  file: File | Blob;
  signal: AbortSignal;
}) => Promise<{ file: File | Blob }> | { file: File | Blob };

/**
 * Shape of options accepted by every `addFile*` method. Mirrors v1's
 * `ApiAddFileCommonOptions` so the public API surface matches.
 */
export type AddFileOptions = {
  /** Skip the `file-added` event emission for this add. v1-compat. */
  silent?: boolean;
  /** Override the file name (otherwise derived from `File.name` or null). */
  fileName?: string;
  /** Logical source for telemetry / display (`'local'`, `'url'`, `'api'`, …). */
  source?: string;
};

/**
 * v2 upload collection. Owns the entry store directly — no v1 mirror,
 * no PubSub bridge. Adds/removes/snapshots flow through `this.collection`;
 * file lifecycle events (`file-added`, `file-upload-start`, etc.) emit
 * here as entries transition.
 */
export class UploadCollectionController {
  public readonly collection = new UploadCollection();

  private _listeners = new Listeners();
  private _beforeUpload: BeforeUploadHandler[] = [];
  private _onAdd: OnAddHandler[] = [];
  private _entryUnsubs = new Map<string, Array<() => void>>();
  private _onAddAbort = new Map<string, AbortController>();

  public constructor(
    private _events: EventBus,
    private _config: ConfigController,
    _validation: ValidationController,
  ) {
    void _validation;

    this.collection.subscribe((change) => {
      for (const entry of change.added) this._onEntryAdded(entry);
      for (const entry of change.removed) this._onEntryRemoved(entry);
      this._listeners.notify();
    });
  }

  // ─── Public reads ──────────────────────────────────────────────────────

  public get items(): OutputFileEntry[] {
    return this.collection.items.map((entry) => getOutputItem(entry));
  }

  /** Live `UploadEntry` instances. Use when you need per-entry reactivity. */
  public get entries(): UploadEntry[] {
    return this.collection.items;
  }

  public get size(): number {
    return this.collection.size;
  }

  public read(internalId: string): UploadEntry | undefined {
    return this.collection.read(internalId) ?? undefined;
  }

  public snapshot(internalId: string): OutputFileEntry | undefined {
    const entry = this.collection.read(internalId);
    return entry ? getOutputItem(entry) : undefined;
  }

  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  // ─── Mutations ─────────────────────────────────────────────────────────

  public addFile(file: File, options: AddFileOptions & { fullPath?: string } = {}): OutputFileEntry {
    const entry = this.collection.add({
      file,
      fileName: options.fileName ?? file.name,
      fileSize: file.size,
      mimeType: file.type || null,
      isImage: (file.type || '').startsWith('image/'),
      source: options.source ?? null,
      fullPath: options.fullPath ?? null,
    });
    const snap = getOutputItem(entry);
    if (!options.silent) {
      this._events.emit(UploaderEventType.FILE_ADDED, snap as OutputFileEntry<'idle'>);
    }
    return snap;
  }

  public addFileFromUrl(url: string, options: AddFileOptions = {}): OutputFileEntry {
    const entry = this.collection.add({
      externalUrl: url,
      fileName: options.fileName ?? null,
      source: options.source ?? null,
    });
    const snap = getOutputItem(entry);
    if (!options.silent) {
      this._events.emit(UploaderEventType.FILE_ADDED, snap as OutputFileEntry<'idle'>);
    }
    return snap;
  }

  public addFileFromUuid(uuid: string, options: AddFileOptions = {}): OutputFileEntry {
    const entry = this.collection.add({
      uuid,
      fileName: options.fileName ?? null,
      source: options.source ?? null,
    });
    const snap = getOutputItem(entry);
    if (!options.silent) {
      this._events.emit(UploaderEventType.FILE_ADDED, snap as OutputFileEntry<'idle'>);
    }
    return snap;
  }

  public addFileFromCdnUrl(cdnUrl: string, options: AddFileOptions = {}): OutputFileEntry {
    const cfg = this._config.values as { cdnCname?: string };
    const parsed = parseCdnUrl({ url: cdnUrl, cdnBase: cfg.cdnCname ?? '' });
    if (!parsed) {
      throw new Error(`Invalid CDN URL: ${cdnUrl}`);
    }
    const entry = this.collection.add({
      uuid: parsed.uuid,
      cdnUrl,
      cdnUrlModifiers: parsed.cdnUrlModifiers,
      fileName: options.fileName ?? parsed.filename ?? null,
      source: options.source ?? null,
    });
    const snap = getOutputItem(entry);
    if (!options.silent) {
      this._events.emit(UploaderEventType.FILE_ADDED, snap as OutputFileEntry<'idle'>);
    }
    return snap;
  }

  public update(internalId: string, patch: Partial<OutputFileEntry>): void {
    const entry = this.collection.read(internalId);
    if (!entry) return;
    const mapped: Partial<UploadEntryFields> = {};
    if (patch.cdnUrl !== undefined) mapped.cdnUrl = patch.cdnUrl;
    if (patch.cdnUrlModifiers !== undefined) mapped.cdnUrlModifiers = patch.cdnUrlModifiers;
    if (patch.uuid !== undefined) mapped.uuid = patch.uuid;
    if (patch.isImage !== undefined) mapped.isImage = patch.isImage;
    if (patch.mimeType !== undefined) mapped.mimeType = patch.mimeType;
    entry.setMultipleValues(mapped);
  }

  public remove(internalId: string): void {
    this.collection.remove(internalId);
  }

  public clearAll(): void {
    this.collection.clearAll();
  }

  // ─── Hooks ─────────────────────────────────────────────────────────────

  public registerBeforeUpload(handler: BeforeUploadHandler): () => void {
    this._beforeUpload.push(handler);
    return () => {
      this._beforeUpload = this._beforeUpload.filter((h) => h !== handler);
    };
  }

  public get beforeUploadHandlers(): readonly BeforeUploadHandler[] {
    return this._beforeUpload;
  }

  public registerOnAdd(handler: OnAddHandler): () => void {
    this._onAdd.push(handler);
    return () => {
      this._onAdd = this._onAdd.filter((h) => h !== handler);
    };
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  private _onEntryAdded(entry: UploadEntry): void {
    const notify = (): void => this._scheduleNotify();
    const snapshot = (): OutputFileEntry => getOutputItem(entry);
    if (this._onAdd.length > 0) {
      const abort = new AbortController();
      this._onAddAbort.set(entry.internalId, abort);
      void this._runOnAddHooks(entry, abort.signal);
    }
    const unsubs: Array<() => void> = [
      entry.subscribe('isUploading', (uploading) => {
        notify();
        if (uploading) {
          this._events.emit(UploaderEventType.FILE_UPLOAD_START, snapshot() as OutputFileEntry<'uploading'>);
        }
      }),
      entry.subscribe('isQueuedForUploading', notify),
      entry.subscribe('uploadProgress', () => {
        if (entry.getValue('isUploading')) {
          this._events.emit(UploaderEventType.FILE_UPLOAD_PROGRESS, snapshot() as OutputFileEntry<'uploading'>);
        }
      }),
      entry.subscribe('fileInfo', (info) => {
        notify();
        if (info) {
          this._events.emit(UploaderEventType.FILE_UPLOAD_SUCCESS, snapshot() as OutputFileEntry<'success'>);
        }
      }),
      entry.subscribe('cdnUrl', (url) => {
        // v1 fires file-url-changed when cdnUrl is set post-upload (e.g.
        // after crop apply rewrites cdnUrlModifiers). Only emit once
        // the entry has fileInfo so the payload satisfies `success`.
        if (url && entry.getValue('fileInfo')) {
          this._events.emit(UploaderEventType.FILE_URL_CHANGED, snapshot() as OutputFileEntry<'success'>);
        }
      }),
      entry.subscribe('errors', (errs) => {
        notify();
        if (errs.length > 0) {
          this._events.emit(UploaderEventType.FILE_UPLOAD_FAILED, snapshot() as OutputFileEntry<'failed'>);
        }
      }),
    ];
    this._entryUnsubs.set(entry.internalId, unsubs);
  }

  // Many per-entry transitions can land in one tick — coalesce.
  private _notifyScheduled = false;
  private _scheduleNotify(): void {
    if (this._notifyScheduled) return;
    this._notifyScheduled = true;
    queueMicrotask(() => {
      this._notifyScheduled = false;
      this._listeners.notify();
    });
  }

  private async _runOnAddHooks(entry: UploadEntry, signal: AbortSignal): Promise<void> {
    const initial = entry.getValue('file');
    if (!initial) return;
    let file: File | Blob = initial;
    for (const hook of this._onAdd) {
      if (signal.aborted) return;
      try {
        const result = await hook({ file, signal });
        if (result?.file) file = result.file;
      } catch (err) {
        console.warn('[v2/collection] onAdd hook failed', err);
      }
    }
    if (signal.aborted) return;
    if (file !== initial) {
      entry.setValue('file', file as File);
      entry.setValue('fileSize', file.size);
      entry.setValue('mimeType', file.type || null);
      entry.setValue('isImage', fileIsImage(file));
      if (file instanceof File) entry.setValue('fileName', file.name);
    }
  }

  private _onEntryRemoved(entry: UploadEntry): void {
    this._onAddAbort.get(entry.internalId)?.abort();
    this._onAddAbort.delete(entry.internalId);
    const unsubs = this._entryUnsubs.get(entry.internalId);
    if (unsubs) for (const u of unsubs) u();
    this._entryUnsubs.delete(entry.internalId);
    // Mark the entry as removed *before* snapshotting so the event
    // payload reports status: 'removed'.
    entry.setValue('isRemoved', true);
    this._events.emit(UploaderEventType.FILE_REMOVED, getOutputItem(entry) as OutputFileEntry<'removed'>);
    entry.destroy();
  }

  public destroy(): void {
    for (const u of this._entryUnsubs.values()) {
      for (const fn of u) fn();
    }
    this._entryUnsubs.clear();
    for (const a of this._onAddAbort.values()) a.abort();
    this._onAddAbort.clear();
    this.collection.destroy();
    this._listeners.clear();
    this._beforeUpload = [];
    this._onAdd = [];
  }
}
