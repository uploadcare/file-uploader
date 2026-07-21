import type { UploadEntryData, UploadEntryKeys, UploadEntryTypedData } from '../../abstract/uploadEntrySchema';
import { ChildBlock } from '../../lit/ChildBlock';

type EntrySubscription = ReturnType<UploadEntryTypedData['observe']>;

export class FileItemConfig extends ChildBlock {
  private _entrySubs: Set<EntrySubscription> = new Set<EntrySubscription>();

  protected entry: UploadEntryTypedData | null = null;

  protected withEntry<A extends unknown[], R>(
    fn: (entry: UploadEntryTypedData, ...args: A) => R,
  ): (...args: A) => R | undefined {
    return (...args: A) => {
      const entry = this.entry;
      if (!entry) {
        this._log.warn('No entry found');
        return undefined;
      }
      return fn(entry, ...args);
    };
  }

  protected subEntry<K extends UploadEntryKeys>(prop: K, handler: (value: UploadEntryData[K]) => void): void {
    this.withEntry<[K, (value: UploadEntryData[K]) => void], void>((entry, propInner, handlerInner) => {
      const sub = entry.observe(
        propInner,
        (value) => {
          if (!this.isConnected || value === undefined) return;
          handlerInner(value);
        },
        { immediate: true },
      );
      this._entrySubs.add(sub);
    })(prop, handler);
  }

  protected reset(): void {
    for (const sub of this._entrySubs) {
      sub();
    }

    this._entrySubs = new Set<EntrySubscription>();
    this.entry = null;
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._entrySubs = new Set<EntrySubscription>();
  }
}
