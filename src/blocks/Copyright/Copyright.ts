import { html } from 'lit';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { ChildBlock } from '../../lit/ChildBlock';
import './copyright.css';

/**
 * Probe block for the M-god step-6a reactive path: it declares its dependency
 * with `static uses`, resolves it with `this.use()`, and reads `removeCopyright`
 * through the TRACKED signal accessor inside `render()`. `SignalWatcher` (on the
 * `ChildBlock` base) auto-tracks that read, so a later `removeCopyright` config
 * change re-renders this element with no `controllerReady`/`subConfigValue`/
 * imperative `toggleAttribute` — the whole v1 subscription dance is gone.
 */
export class Copyright extends ChildBlock {
  public static override readonly uses = [ConfigController] as const;

  public override render() {
    const hidden = this.use(ConfigController).getTracked('removeCopyright');
    return html`
      <a
        href="https://uploadcare.com/?utm_source=copyright&amp;utm_medium=referral&amp;utm_campaign=v4"
        target="_blank noopener"
        class="uc-credits"
        ?hidden=${hidden}
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
