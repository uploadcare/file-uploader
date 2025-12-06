import type { UploadEntryData, UploadEntryKeys, UploadEntryTypedData } from '../../abstract/uploadEntrySchema';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';

type EntrySubscription = ReturnType<UploadEntryTypedData['subscribe']>;

export class FileItemConfig extends LitUploaderBlock {
  private _entrySubs: Set<EntrySubscription> = new Set<EntrySubscription>();

  protected entry: UploadEntryTypedData | null = null;

  protected withEntry<A extends unknown[], R>(
    fn: (entry: UploadEntryTypedData, ...args: A) => R,
  ): (...args: A) => R | undefined {
    return (...args: A) => {
      const entry = this.entry;
      if (!entry) {
        console.warn('No entry found');
        return undefined;
      }
      return fn(entry, ...args);
    };
  }

  protected subEntry<K extends UploadEntryKeys>(prop: K, handler: (value: UploadEntryData[K]) => void): void {
    this.withEntry<[K, (value: UploadEntryData[K]) => void], void>((entry, propInner, handlerInner) => {
      const sub = entry.subscribe(propInner, (value) => {
        if (this.isConnected) {
          handlerInner(value);
        }
      });
      this._entrySubs.add(sub);
    })(prop, handler);
  }

  protected reset(): void {
    for (const sub of this._entrySubs) {
      sub.remove();
    }

    this._entrySubs = new Set<EntrySubscription>();
    this.entry = null;
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._entrySubs = new Set<EntrySubscription>();
  }
}
