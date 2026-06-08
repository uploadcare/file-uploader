import { html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import '../SourceBtn/SourceBtn';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

/**
 * v2 `<uc-source-list>`. Reads `config.sourceList` (CSV like
 * `"local,url,camera,dropbox"`) plus the plugin registry's
 * `sources` and renders one `<uc-source-btn>` per match. Honors
 * `expand()` (used by camera to fan out to mobile photo/video on
 * htmlMediaCapture devices). v1's `source-list.css` styles the tag
 * directly.
 */
export class SourceList extends ChildBlock {
  /** CSS-only attribute (kept for visual parity with v1). */
  @property({ type: Boolean, attribute: 'wrap', noAccessor: true })
  public wrap = false;

  protected override subscriptionsFor(ctrl: UploaderController) {
    // `sources` carries the resolved list (already dedups config +
    // plugins changes that *affect* the list). Locale flips re-render
    // the labels. Config covers `sourceListWrap` and any other config
    // flag we read in `updated()` that isn't part of the source list
    // itself.
    return [
      ctrl.sources.subscribe.bind(ctrl.sources),
      ctrl.locale.subscribe.bind(ctrl.locale),
      ctrl.config.subscribe.bind(ctrl.config),
    ];
  }

  public override updated(_changed: PropertyValues<this>): void {
    const cfg = this.uploaderOrNull?.config.values as { sourceListWrap?: boolean } | undefined;
    if (cfg?.sourceListWrap) {
      this.style.removeProperty('display');
    } else {
      this.style.display = 'contents';
    }
  }

  private get _sources(): readonly SourceButtonConfig[] {
    return this.uploaderOrNull?.sources.list ?? [];
  }

  public override render() {
    return html`${this._sources.map(
      (source) => html`
        <uc-source-btn
          role="listitem"
          .source=${source}
          data-source-id=${source.id}
        ></uc-source-btn>
      `,
    )}`;
  }
}

if (!customElements.get('uc-source-list')) customElements.define('uc-source-list', SourceList);
