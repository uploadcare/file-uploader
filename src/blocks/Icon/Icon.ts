import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LitBlock } from '../../lit/LitBlock';
import type { IconHrefResolver } from '../../types/index';
import './icon.css';

export class Icon extends LitBlock {
  @property({ type: String })
  public name = '';

  @state()
  private _resolvedHref = '';

  private _iconHrefResolver: IconHrefResolver | null = null;

  public override initCallback(): void {
    super.initCallback();
    this.setAttribute('aria-hidden', 'true');

    this.subConfigValue('iconHrefResolver', (resolver: IconHrefResolver | null) => {
      this._iconHrefResolver = resolver;
      this._updateResolvedHref();
    });
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
      return;
    }

    const defaultHref = `#uc-icon-${this.name}`;
    const customHref = this._iconHrefResolver?.(this.name);
    this._resolvedHref = customHref ?? defaultHref;
  }

  public override render() {
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
