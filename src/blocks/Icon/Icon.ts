import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { inject } from '../../abstract/di/inject';
import { PluginController } from '../../abstract/managers/plugin';
import { ChildBlock } from '../../lit/ChildBlock';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import { renderIconSvg } from './renderIconSvg';
import { renderResolvedIcon } from './renderResolvedIcon';
import './icon.css';

export class Icon extends ChildBlock {
  @inject(ConfigController) private readonly _config!: ConfigController;

  @property({ type: String })
  public name = '';

  // Transiently null until the container resolves the `PluginController`
  // (`whenController`) — render falls back to the sprite href meanwhile. The
  // plugin manager is CONDITIONALLY bound (only once an uploader scope attaches,
  // or never in a bare ctx), so a synchronous `use(PluginController)` could
  // throw; `whenController` fires now if resolved, else on first resolution. A
  // plugin change re-renders via `requestUpdate` since its snapshot is not a
  // signal.
  private _pluginManager: PluginController | null = null;

  public override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }

  /** @internal */
  @subscription()
  protected _wirePluginIcons(): Unsubscribe {
    return this.container.whenController(PluginController, (pluginManager) => {
      this._pluginManager = pluginManager;
      this.requestUpdate();
      return pluginManager.onPluginsChange(() => this.requestUpdate());
    });
  }

  protected override controllerReleased(): void {
    this._pluginManager = null;
  }

  public override render() {
    if (!this.name) {
      return html` ${this.yield('', renderIconSvg(''))} `;
    }

    // Tracked read: reading `iconHrefResolver` here auto-tracks it under
    // `SignalWatcher`, so a later config `set()` re-renders.
    const iconHrefResolver = this._config.getTracked('iconHrefResolver');
    const icon = renderResolvedIcon(this.name, this._pluginManager?.snapshot().icons, iconHrefResolver);
    return html` ${this.yield('', icon)} `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-icon': Icon;
  }
}
