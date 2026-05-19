import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { LitBlock } from '../../lit/LitBlock';
import type { IconHrefResolver } from '../../types/index';
import './icon.css';

export class Icon extends LitBlock {
  @property({ type: String })
  public name = '';

  @state()
  private _resolvedHref = '';

  @state()
  private _pluginSvg: string | null = null;

  private _iconHrefResolver: IconHrefResolver | null = null;
  private _unsubscribePlugins?: () => void;

  public override initCallback(): void {
    super.initCallback();
    this.setAttribute('aria-hidden', 'true');

    this.subConfigValue('iconHrefResolver', (resolver: IconHrefResolver | null) => {
      this._iconHrefResolver = resolver;
      this._updateResolvedHref();
    });

    const pluginManager = this._sharedInstancesBag.pluginManager;
    if (pluginManager?.onPluginsChange) {
      this._unsubscribePlugins = pluginManager.onPluginsChange(() => this._updateResolvedHref());
    }
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

    const pluginManager = this._sharedInstancesBag.pluginManager;
    const pluginIcon = pluginManager?.snapshot().icons.find((icon) => icon.name === this.name);

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

  public override disconnectedCallback(): void {
    this._unsubscribePlugins?.();
    this._unsubscribePlugins = undefined;
    super.disconnectedCallback();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-icon': Icon;
  }
}
