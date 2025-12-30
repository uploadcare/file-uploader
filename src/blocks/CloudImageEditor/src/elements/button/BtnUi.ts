import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LitBlock } from '../../../../../lit/LitBlock';

type Theme = string | null;

export class BtnUi extends LitBlock {
  @property({ type: String })
  public text = '';

  @property({ type: String })
  public icon = '';

  @property({ type: Boolean, reflect: true })
  public reverse = false;

  @property({ type: String, reflect: true })
  public theme: Theme = 'default';

  @property({ attribute: 'aria-role' })
  public ariaRole = '';

  @property({ attribute: 'aria-controls' })
  public ariaControls = '';

  @property({ attribute: 'title-prop' })
  public titleProp = '';

  protected override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed);
    this._applyReverse();
    this._applyThemeClass();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);

    if (changed.has('reverse')) {
      this._applyReverse();
    }

    if (changed.has('theme')) {
      this._applyThemeClass();
    }
  }

  private _applyReverse(): void {
    this.style.flexDirection = this.reverse ? 'row-reverse' : '';
  }

  private _applyThemeClass(): void {
    if (this.theme && this.theme !== 'custom') {
      this.className = `uc-${this.theme}`;
    }
  }

  private get _iconClassMap(): Record<string, boolean> {
    const iconHidden = this._computedIconHidden;
    return {
      'uc-icon': true,
      'uc-icon_left': !this.reverse,
      'uc-icon_right': this.reverse,
      'uc-icon_hidden': iconHidden,
      'uc-icon_single': this._computedIconSingle,
    };
  }

  private get _computedIconHidden(): boolean {
    return !this.icon;
  }

  private get _computedIconSingle(): boolean {
    return !this.text && !this._computedIconHidden;
  }

  public override render() {
    return html`
      <button
        type="button"
        role=${ifDefined(this.ariaRole || undefined)}
        aria-controls=${ifDefined(this.ariaControls || undefined)}
        aria-label=${ifDefined(this.l10n(this.titleProp))}
        title=${ifDefined(this.l10n(this.titleProp))}
      >
        <uc-icon
          class=${classMap(this._iconClassMap)}
          name=${ifDefined(this.icon || undefined)}
          ?hidden=${this._computedIconHidden}
        ></uc-icon>
        <div class="uc-text">${this.text}</div>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-btn-ui': BtnUi;
  }
}
