import type { UploadEntryData, UploadEntryKeys, UploadEntryTypedData } from '../../abstract/uploadEntrySchema';
import { ChildBlock } from '../../lit/ChildBlock';

type EntrySubscription = ReturnType<UploadEntryTypedData['observe']>;

export class FileItemConfig extends ChildBlock {
  private _entrySubs: Set<EntrySubscription> = new Set<EntrySubscription>();

  protected entry: UploadEntryTypedData | null = null;

  protected subEntry<K extends UploadEntryKeys>(
    prop: K,
    handler: (value: UploadEntryData[K] | undefined) => void,
  ): void {
    const sub = this.entry?.observe(
      prop,
      // `undefined` is delivered too: clearing an optional field is a real change.
      (value) => {
        if (this.isConnected) handler(value);
      },
      { immediate: true },
    );
    if (sub) this._entrySubs.add(sub);
  }

  /**
   * Observe ALL of the entry's key changes through a SINGLE subscription (the
   * entry's keyed-notify channel), dispatching by the changed key — instead of
   * one `subEntry`/`observe` per key. `handler` runs on any changed key while
   * connected; it reads current values off `entry` as needed. No initial fire
   * (unlike `subEntry`'s `{immediate}`): the caller seeds initial state itself.
   * This is the large-N win — 1 subscription per row instead of ~15.
   */
  protected subEntryKeys(handler: (key: UploadEntryKeys) => void): void {
    const sub = this.entry?.subscribeKeys((key) => {
      if (this.isConnected) handler(key);
    });
    if (sub) this._entrySubs.add(sub);
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
    // Unsubscribe on disconnect — the previous `= new Set()` dropped the
    // subscription refs WITHOUT calling them, leaking `Listeners` callbacks that
    // kept running `select()` on every later entry write until the entry's
    // deferred destroy (~10s). `reset()` invokes each unsubscribe first.
    this.reset();
  }
}
