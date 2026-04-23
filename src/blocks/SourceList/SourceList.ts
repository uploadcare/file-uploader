import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { SourceListController } from '../../abstract/controllers';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import '../SourceBtn/SourceBtn';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';

export class SourceList extends LitUploaderBlock {
  private _controller?: SourceListController;

  @state()
  private _sources: SourceButtonConfig[] = [];

  /**
   * CSS-only attribute
   */
  @property({ type: Boolean, attribute: 'wrap', noAccessor: true })
  public wrap = false;

  public override initCallback(): void {
    super.initCallback();

    this._controller = new SourceListController({
      ctx: this._sharedInstancesBag.ctx,
      sharedInstancesBag: this._sharedInstancesBag,
      onSourcesChange: (sources) => {
        this._sources = sources;
      },
    });
    this._controller.init();
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (this.cfg.sourceListWrap) {
      this.style.removeProperty('display');
    } else {
      this.style.display = 'contents';
    }
  }

  public override render() {
    return html`${this._sources.map((source) => html`<uc-source-btn role="listitem" .source=${source} data-source-id=${source.id}></uc-source-btn>`)}`;
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._controller?.destroy();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-source-list': SourceList;
  }
}
