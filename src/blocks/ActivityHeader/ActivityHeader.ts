import { html, LitElement } from 'lit';
import '../../blocks/ActivityHeader/activity-header.css';
import { LightDomMixin } from '../../lit/LightDomMixin';

/**
 * v2 `<uc-activity-header>`. Pure slot host used by plugin activities for
 * their top bar (typically back/icon/title/close). v1's
 * `activity-header.css` styles the tag directly so visuals are inherited.
 *
 * v1's class extended `LitActivityBlock`, but the activity-toggle behavior
 * was effectively dead code (no `activityType` set, no callbacks). The v2
 * version is a plain slotted container.
 */
export class ActivityHeader extends LightDomMixin(LitElement) {
  public override render() {
    return html`${this.yield('')}`;
  }
}

if (!customElements.get('uc-activity-header')) customElements.define('uc-activity-header', ActivityHeader);
