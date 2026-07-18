import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import type { PluginController } from '../../abstract/managers/plugin';
import { ChildBlock } from '../../lit/ChildBlock';
import { renderIconSvg } from './renderIconSvg';
import './icon.css';

export class Icon extends ChildBlock {
  public static override readonly uses = [ConfigController] as const;

  @property({ type: String })
  public name = '';

  // Transiently null until the shared PluginController registers (bag.when) —
  // render falls back to the sprite href meanwhile. The plugin manager is NOT
  // container-resolved (no DI token), so it stays on the v1 `bag` path (step 8);
  // a plugin change re-renders via `requestUpdate` since its snapshot is not a
  // signal.
  private _pluginManager: PluginController | null = null;

  public override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }

  protected override controllerReady(): void {
    this.trackSub(
      this.bag.when('pluginManager', (pluginManager) => {
        this._pluginManager = pluginManager;
        this.trackSub(pluginManager.onPluginsChange(() => this.requestUpdate()));
        this.requestUpdate();
      }),
    );
  }

  protected override controllerReleased(): void {
    this._pluginManager = null;
  }

  public override render() {
    if (!this.name) {
      return html` ${this.yield('', renderIconSvg(''))} `;
    }

    const pluginIcon = this._pluginManager?.snapshot().icons.find((icon) => icon.name === this.name);
    if (pluginIcon) {
      return html`${this.yield('', html`${unsafeSVG(pluginIcon.svg)}`)}`;
    }

    // Tracked read: reading `iconHrefResolver` here auto-tracks it under
    // `SignalWatcher`, so a later config `set()` re-renders — replacing the v1
    // `subConfigValue('iconHrefResolver', …)` mirror that fed `_resolvedHref`.
    const iconHrefResolver = this.use(ConfigController).getTracked('iconHrefResolver');
    const href = iconHrefResolver?.(this.name) ?? `#uc-icon-${this.name}`;
    return html` ${this.yield('', renderIconSvg(href))} `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-icon': Icon;
  }
}
