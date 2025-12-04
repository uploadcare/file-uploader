import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LitBlock } from '../../../lit/LitBlock';

export class EditorButtonControl extends LitBlock {
  @state()
  active = false;

  @state()
  override title = '';

  @state()
  icon = '';

  @state()
  titleProp = '';

  protected get buttonClasses(): Record<string, boolean> {
    const isActive = this.active;
    return {
      'uc-active': isActive,
      'uc-not_active': !isActive,
    };
  }

  private updateHostStateClasses(): void {
    const classes = this.buttonClasses;
    for (const [className, enabled] of Object.entries(classes)) {
      this.classList.toggle(className, enabled);
    }
  }

  protected onClick(_event: MouseEvent): void {}

  override connectedCallback(): void {
    super.connectedCallback();
    this.updateHostStateClasses();
  }

  protected override updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (changedProperties.has('active')) {
      this.updateHostStateClasses();
    }
  }

  override render() {
    const clickHandler = this.onClick;
    const title = this.title;

    return html`
      <button
        role="option"
        type="button"
        aria-label=${ifDefined(this.titleProp)}
        title=${ifDefined(this.titleProp)}
        @click=${clickHandler}
      >
        <uc-icon name=${this.icon}></uc-icon>
        <div class="uc-title" ?hidden=${!title}>${title}</div>
      </button>
    `;
  }
}
