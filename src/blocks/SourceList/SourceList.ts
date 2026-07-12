import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { SourceListController } from '../../abstract/controllers';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import '../SourceBtn/SourceBtn';
import { ChildBlock } from '../../lit/ChildBlock';

export class SourceList extends ChildBlock {
  @state()
  private _sources: SourceButtonConfig[] = [];

  /**
   * CSS-only attribute
   */
  @property({ type: Boolean, attribute: 'wrap', noAccessor: true })
  public wrap = false;

  protected override controllerReady(): void {
    new SourceListController(this, {
      ctx: this.bag.ctx,
      sharedInstancesBag: this.bag,
      onSourcesChange: (sources) => {
        this._sources = sources;
      },
    });
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (this.uploader.config.get('sourceListWrap')) {
      this.style.removeProperty('display');
    } else {
      this.style.display = 'contents';
    }
  }

  public override render() {
    return html`${this._sources.map((source) => html`<uc-source-btn role="listitem" .source=${source} data-source-id=${source.id}></uc-source-btn>`)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-source-list': SourceList;
  }
}
