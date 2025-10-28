import { UploaderBlock } from '../../abstract/UploaderBlock';
import type { UploadEntryData, UploadEntryKeys, UploadEntryTypedData } from '../../abstract/uploadEntrySchema';

type EntrySubscription = ReturnType<UploadEntryTypedData['subscribe']>;

export class FileItemConfig extends UploaderBlock {
  protected _entrySubs: Set<EntrySubscription> = new Set<EntrySubscription>();

  protected _entry: UploadEntryTypedData | null = null;

  protected _withEntry<A extends unknown[], R>(
    fn: (entry: UploadEntryTypedData, ...args: A) => R,
  ): (...args: A) => R | undefined {
    return (...args: A) => {
      const entry = this._entry;
      if (!entry) {
        console.warn('No entry found');
        return undefined;
      }
      return fn(entry, ...args);
    };
  }

  protected _subEntry<K extends UploadEntryKeys>(prop: K, handler: (value: UploadEntryData[K]) => void): void {
    this._withEntry<[K, (value: UploadEntryData[K]) => void], void>((entry, propInner, handlerInner) => {
      const sub = entry.subscribe(propInner, (value) => {
        if (this.isConnected) {
          handlerInner(value);
        }
      });
      this._entrySubs.add(sub);
    })(prop, handler);
  }

  protected _reset(): void {
    for (const sub of this._entrySubs) {
      sub.remove();
    }

    this._entrySubs = new Set<EntrySubscription>();
    this._entry = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._entrySubs = new Set<EntrySubscription>();
  }
}
