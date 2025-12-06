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
  public active = false;

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

  protected override firstUpdated(_changed: PropertyValues<this>): void {
    super.firstUpdated(_changed);
    this.applyReverse();
    this.applyThemeClass();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);

    if (changed.has('reverse')) {
      this.applyReverse();
    }

    if (changed.has('theme')) {
      this.applyThemeClass();
    }
  }

  private applyReverse(): void {
    this.style.flexDirection = this.reverse ? 'row-reverse' : '';
  }

  private applyThemeClass(): void {
    if (this.theme && this.theme !== 'custom') {
      this.className = `uc-${this.theme}`;
    }
  }

  private get iconClassMap(): Record<string, boolean> {
    const iconHidden = this.computedIconHidden;
    return {
      'uc-icon': true,
      'uc-icon_left': !this.reverse,
      'uc-icon_right': this.reverse,
      'uc-icon_hidden': iconHidden,
      'uc-icon_single': this.computedIconSingle,
    };
  }

  private get computedIconHidden(): boolean {
    return !this.icon;
  }

  private get computedIconSingle(): boolean {
    return !this.text && !this.computedIconHidden;
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
          class=${classMap(this.iconClassMap)}
          name=${ifDefined(this.icon || undefined)}
          ?hidden=${this.computedIconHidden}
        ></uc-icon>
        <div class="uc-text">${this.text}</div>
      </button>
    `;
  }
}
