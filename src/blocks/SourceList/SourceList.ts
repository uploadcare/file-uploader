import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { SourceListController } from '../../abstract/controllers';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import type { ControllerContainer } from '../../abstract/di/ControllerContainer';
import { inject } from '../../abstract/di/inject';
import type { SourceButtonConfig } from '../SourceBtn/SourceBtn';

import '../SourceBtn/SourceBtn';
import { ChildBlock } from '../../lit/ChildBlock';

export class SourceList extends ChildBlock {
  @inject(ConfigController) private readonly _config!: ConfigController;

  @state()
  private _sources: SourceButtonConfig[] = [];

  /**
   * CSS-only attribute
   */
  @property({ type: Boolean, attribute: 'wrap', noAccessor: true })
  public wrap = false;

  private _sourceListController: SourceListController | null = null;

  protected override controllerReady(container: ControllerContainer): void {
    // Re-adoption (release-while-connected followed by re-adopt) would otherwise
    // stack a new SourceListController per adoption without ever removing the
    // previous one — tear down the old instance's subscriptions first.
    this._teardownSourceListController();

    this._sourceListController = new SourceListController(this, {
      config: this._config,
      container,
      onSourcesChange: (sources) => {
        this._sources = sources;
      },
    });
  }

  protected override controllerReleased(): void {
    this._teardownSourceListController();
  }

  private _teardownSourceListController(): void {
    if (!this._sourceListController) {
      return;
    }
    this._sourceListController.hostDisconnected();
    this.removeController(this._sourceListController);
    this._sourceListController = null;
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    // Imperative `updated()` read (host inline-style side-effect) — `get()`, not
    // the tracked `getTracked()`: v1 re-evaluated this only on re-render (driven
    // by `_sources`), not as its own reactive trigger, so keep it untracked to
    // preserve behavior exactly.
    if (this._config.get('sourceListWrap')) {
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
