import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LitBlock } from '../../lit/LitBlock';
import type { IconHrefResolver } from '../../types/index';
import './icon.css';

export class Icon extends LitBlock {
  @property({ type: String })
  public name = '';

  @state()
  private resolvedHref = '';

  private iconHrefResolver: IconHrefResolver | null = null;

  public override initCallback(): void {
    super.initCallback();
    this.setAttribute('aria-hidden', 'true');

    this.subConfigValue('iconHrefResolver', (resolver: IconHrefResolver | null) => {
      this.iconHrefResolver = resolver;
      this.updateResolvedHref();
    });
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    if (changedProperties.has('name')) {
      this.updateResolvedHref();
    }
  }

  private updateResolvedHref(): void {
    if (!this.name) {
      this.resolvedHref = '';
      return;
    }

    const defaultHref = `#uc-icon-${this.name}`;
    const customHref = this.iconHrefResolver?.(this.name);
    this.resolvedHref = customHref ?? defaultHref;
  }

  public override render() {
    return html`
      ${this.yield(
        '',
        html`<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <use href=${this.resolvedHref}></use>
      </svg>`,
      )}
    `;
  }
}
