import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { UploadEntry } from './UploadEntry';
import type { UploadEntryFieldKey, UploadEntryFields } from './UploadEntryFields';

type Options = {
  /**
   * If provided, the controller only requests host updates when one of
   * the listed fields changes. Defaults to "any field change".
   */
  keys?: readonly UploadEntryFieldKey[];
  /** Per-key callbacks; invoked in addition to the host update. */
  onChange?: <K extends UploadEntryFieldKey>(key: K, value: UploadEntryFields[K]) => void;
};

/**
 * Lit `ReactiveController` that binds an `UploadEntry` to a Lit host.
 *
 * Usage:
 * ```ts
 * private _entry = new UploadEntryController(this, entry, {
 *   keys: ['fileName', 'uploadProgress', 'errors'],
 * });
 * ```
 *
 * The host re-renders whenever the entry changes (or only when one of
 * the listed keys changes if `keys` is set). Unsubscribes on
 * `hostDisconnected` and re-subscribes on `hostConnected`.
 */
export class UploadEntryController implements ReactiveController {
  public readonly entry: UploadEntry;

  private readonly _host: ReactiveControllerHost;
  private readonly _opts: Options;
  private _unsubs: Array<() => void> = [];

  public constructor(host: ReactiveControllerHost, entry: UploadEntry, opts: Options = {}) {
    this._host = host;
    this.entry = entry;
    this._opts = opts;
    host.addController(this);
  }

  public hostConnected(): void {
    const rerender = (): void => this._host.requestUpdate();
    if (this._opts.keys?.length) {
      for (const key of this._opts.keys) {
        this._unsubs.push(
          this.entry.subscribe(key, (value) => {
            this._opts.onChange?.(key, value);
            rerender();
          }),
        );
      }
    } else {
      this._unsubs.push(this.entry.subscribeAny(rerender));
    }
  }

  public hostDisconnected(): void {
    for (const u of this._unsubs) u();
    this._unsubs = [];
  }
}
