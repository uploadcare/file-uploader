import { initialEntryFields, type UploadEntryFieldKey, type UploadEntryFields } from './UploadEntryFields';

type AnyListener = () => void;
type KeyListener<K extends UploadEntryFieldKey> = (value: UploadEntryFields[K]) => void;

/**
 * v2-native upload entry. Owns its own field storage and per-key
 * listeners — no PubSub, no `TypedData`. Each `setValue` / `setMany`
 * call fires the matching per-key listeners and the any-change
 * listeners exactly once per actually-changed key.
 *
 * Reactive consumers (Lit blocks) should wrap an entry in
 * `UploadEntryController` rather than subscribing directly.
 */
export class UploadEntry {
  public readonly internalId: string;

  private _fields: UploadEntryFields;
  private _keyListeners = new Map<UploadEntryFieldKey, Set<KeyListener<UploadEntryFieldKey>>>();
  private _anyListeners = new Set<AnyListener>();

  public constructor(internalId: string, initial?: Partial<UploadEntryFields>) {
    this.internalId = internalId;
    this._fields = { ...initialEntryFields, ...initial };
  }

  public getValue<K extends UploadEntryFieldKey>(key: K): UploadEntryFields[K] {
    return this._fields[key];
  }

  public setValue<K extends UploadEntryFieldKey>(key: K, value: UploadEntryFields[K]): void {
    if (this._fields[key] === value) return;
    this._fields[key] = value;
    this._notifyKey(key, value);
    this._notifyAny();
  }

  public setMultipleValues(patch: Partial<UploadEntryFields>): void {
    let changedAny = false;
    for (const k of Object.keys(patch) as UploadEntryFieldKey[]) {
      const next = patch[k];
      if (next === undefined) continue;
      if (this._fields[k] === next) continue;
      // Assigning across mapped keys — the field type narrows per key but we
      // can't express that as a generic write loop without a discriminated
      // union, so the cast stays local to this single line.
      (this._fields as Record<UploadEntryFieldKey, unknown>)[k] = next;
      this._notifyKey(k, next as UploadEntryFields[typeof k]);
      changedAny = true;
    }
    if (changedAny) this._notifyAny();
  }

  public subscribe<K extends UploadEntryFieldKey>(key: K, handler: KeyListener<K>): () => void {
    const set = this._keyListeners.get(key) ?? new Set();
    set.add(handler as KeyListener<UploadEntryFieldKey>);
    this._keyListeners.set(key, set);
    return () => {
      set.delete(handler as KeyListener<UploadEntryFieldKey>);
    };
  }

  /** Subscribe to any field change. Used by `UploadEntryController`. */
  public subscribeAny(handler: AnyListener): () => void {
    this._anyListeners.add(handler);
    return () => {
      this._anyListeners.delete(handler);
    };
  }

  public destroy(): void {
    this._keyListeners.clear();
    this._anyListeners.clear();
  }

  private _notifyKey<K extends UploadEntryFieldKey>(key: K, value: UploadEntryFields[K]): void {
    const set = this._keyListeners.get(key);
    if (!set) return;
    for (const listener of set) (listener as KeyListener<K>)(value);
  }

  private _notifyAny(): void {
    for (const listener of this._anyListeners) listener();
  }
}
