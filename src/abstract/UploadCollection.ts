import { UID } from '../utils/UID';
import { UploadEntry } from './UploadEntry';
import type { UploadEntryFields } from './UploadEntryFields';

export type CollectionChange = {
  added: UploadEntry[];
  removed: UploadEntry[];
};

type CollectionListener = (change: CollectionChange) => void;

/**
 * v2-native upload collection. Map-backed, owns its entries.
 *
 * Emits one batched change per microtask (matching v1's
 * `TypedCollection._notify` semantics so subscribers don't re-render
 * mid-add for bulk operations). Per-entry mutations are reactive via
 * the entry itself — observers of the collection only learn about
 * structural changes (add / remove).
 */
export class UploadCollection {
  private _entries = new Map<string, UploadEntry>();
  private _listeners = new Set<CollectionListener>();
  private _added: UploadEntry[] = [];
  private _removed: UploadEntry[] = [];
  private _flushScheduled = false;

  public get size(): number {
    return this._entries.size;
  }

  public get items(): UploadEntry[] {
    return [...this._entries.values()];
  }

  public ids(): string[] {
    return [...this._entries.keys()];
  }

  public has(id: string): boolean {
    return this._entries.has(id);
  }

  public read(id: string): UploadEntry | null {
    return this._entries.get(id) ?? null;
  }

  /**
   * Create + insert a fresh entry. Accepts an optional preset id so the
   * bridge can mirror v1 entries under their existing uids.
   */
  public add(initial?: Partial<UploadEntryFields>, presetId?: string): UploadEntry {
    const id = presetId ?? UID.generateFastUid();
    const entry = new UploadEntry(id, initial);
    this._entries.set(id, entry);
    this._added.push(entry);
    this._scheduleFlush();
    return entry;
  }

  public remove(id: string): UploadEntry | null {
    const entry = this._entries.get(id);
    if (!entry) return null;
    this._entries.delete(id);
    this._removed.push(entry);
    this._scheduleFlush();
    return entry;
  }

  public clearAll(): void {
    for (const id of [...this._entries.keys()]) this.remove(id);
  }

  /** Subscribe to add/remove batches. Listener fires asynchronously. */
  public subscribe(listener: CollectionListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  public destroy(): void {
    for (const entry of this._entries.values()) entry.destroy();
    this._entries.clear();
    this._listeners.clear();
    this._added = [];
    this._removed = [];
  }

  private _scheduleFlush(): void {
    if (this._flushScheduled) return;
    this._flushScheduled = true;
    queueMicrotask(() => {
      this._flushScheduled = false;
      if (this._added.length === 0 && this._removed.length === 0) return;
      const change: CollectionChange = { added: this._added, removed: this._removed };
      this._added = [];
      this._removed = [];
      for (const l of this._listeners) l(change);
    });
  }
}
