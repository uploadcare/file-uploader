import { html, type PropertyValues } from 'lit';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { inject } from '../../abstract/di/inject';
import { ChildBlock } from '../../lit/ChildBlock';
import './copyright.css';

/**
 * Probe block for the M-god step-9e `@inject`-on-element path: it declares its
 * dependency with the same `@inject` decorator the controllers use — a plain
 * prototype getter that resolves the token off `this[CONTAINER]` (tagged by
 * `ChildBlock` on adoption) — and reads `removeCopyright` through the TRACKED
 * signal accessor. `SignalWatcher` (on the `ChildBlock` base) wraps
 * `performUpdate`, so a `getTracked` read anywhere in the update cycle (here
 * `willUpdate`) is auto-tracked and a later `removeCopyright` config change
 * re-runs the update with no `subConfigValue`/manual subscription.
 *
 * The `hidden` attribute lives on the HOST `<uc-copyright>`, not the inner
 * `<a>`: the inline solution's layout CSS keys off it via
 * `:has(uc-copyright[hidden])` (see `solutions/file-uploader/inline/index.css`),
 * which only matches when the host carries the attribute. We toggle it in
 * `willUpdate` (mirroring pre-6a's `toggleAttribute` on the host) driven by the
 * tracked signal. `hidden` is not a declared reactive property, so toggling it
 * here does not schedule a further update.
 */
export class Copyright extends ChildBlock {
  @inject(ConfigController) private readonly _config!: ConfigController;

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    const removeCopyright = this._config.getTracked('removeCopyright');
    this.toggleAttribute('hidden', !!removeCopyright);
  }

  public override render() {
    return html`
      <a
        href="https://uploadcare.com/?utm_source=copyright&amp;utm_medium=referral&amp;utm_campaign=v4"
        target="_blank noopener"
        class="uc-credits"
        >Powered by Uploadcare</a
      >
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-copyright': Copyright;
  }
}
