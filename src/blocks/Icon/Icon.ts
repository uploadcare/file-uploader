import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import type { PluginController } from '../../abstract/managers/plugin';
import { ChildBlock } from '../../lit/ChildBlock';
import type { IconHrefResolver } from '../../types/index';
import './icon.css';

export class Icon extends ChildBlock {
  @property({ type: String })
  public name = '';

  @state()
  private _resolvedHref = '';

  @state()
  private _pluginSvg: string | null = null;

  private _iconHrefResolver: IconHrefResolver | null = null;
  private _pluginManager: PluginController | null = null;

  public override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }

  protected override controllerReady(): void {
    this.subConfigValue('iconHrefResolver', (resolver: IconHrefResolver | null) => {
      this._iconHrefResolver = resolver;
      this._updateResolvedHref();
    });

    this.trackSub(
      this.bag.when('pluginManager', (pluginManager) => {
        this._pluginManager = pluginManager;
        this.trackSub(pluginManager.onPluginsChange(() => this._updateResolvedHref()));
        this._updateResolvedHref();
      }),
    );
  }

  protected override controllerReleased(): void {
    this._pluginManager = null;
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    if (changedProperties.has('name')) {
      this._updateResolvedHref();
    }
  }

  private _updateResolvedHref(): void {
    if (!this.name) {
      this._resolvedHref = '';
      this._pluginSvg = null;
      return;
    }

    const pluginIcon = this._pluginManager?.snapshot().icons.find((icon) => icon.name === this.name);

    if (pluginIcon) {
      this._pluginSvg = pluginIcon.svg;
      this._resolvedHref = '';
      return;
    }

    this._pluginSvg = null;
    const defaultHref = `#uc-icon-${this.name}`;
    const customHref = this._iconHrefResolver?.(this.name);
    this._resolvedHref = customHref ?? defaultHref;
  }

  public override render() {
    if (this._pluginSvg) {
      return html`${this.yield('', html`${unsafeSVG(this._pluginSvg)}`)}`;
    }

    return html`
      ${this.yield(
        '',
        html`<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <use href=${this._resolvedHref}></use>
      </svg>`,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-icon': Icon;
  }
}
