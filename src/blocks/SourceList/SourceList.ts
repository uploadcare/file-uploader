import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { inject } from '../../abstract/di/inject';
import { observeSources } from '../../abstract/sources';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import '../SourceBtn/SourceBtn';
import './source-list.css';
import { ChildBlock } from '../../lit/ChildBlock';
import { subscription, type Unsubscribe } from '../../lit/subscription';

export class SourceList extends ChildBlock {
  @inject(ConfigController) private readonly _config!: ConfigController;

  @state()
  private _sources: SourceButtonConfig[] = [];

  /**
   * CSS-only attribute
   */
  @property({ type: Boolean, attribute: 'wrap', noAccessor: true })
  public wrap = false;

  /** @internal */
  @subscription()
  protected _wireSources(): Unsubscribe {
    return observeSources(this.container, (sources) => {
      this._sources = sources;
    });
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    // Imperative `updated()` read (host attribute side-effect) — `get()`, not
    // the tracked `getTracked()`: it is re-evaluated only on re-render (driven
    // by `_sources`), not as its own reactive trigger. `[nowrap]` maps to `display: contents` in the
    // stylesheet, so a consumer's inline `display` still wins.
    this.toggleAttribute('nowrap', !this._config.get('sourceListWrap'));
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
