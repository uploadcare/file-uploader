import type { PropertyValues } from 'lit';
import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { LitBlock } from '../../../lit/LitBlock';

import '../../Icon/Icon';

export class EditorButtonControl extends LitBlock {
  // This is public because it's used in the updated lifecycle to assign to the shared state.
  @state()
  public active = false;

  // TODO: Rename title since it conflicts with HTMLElement.title
  @state()
  public override title = '';

  @state()
  protected icon = '';

  @state()
  protected titleProp = '';

  protected get buttonClasses(): Record<string, boolean> {
    const isActive = this.active;
    return {
      'uc-active': isActive,
      'uc-not_active': !isActive,
    };
  }

  private _updateHostStateClasses(): void {
    const classes = this.buttonClasses;
    for (const [className, enabled] of Object.entries(classes)) {
      this.classList.toggle(className, enabled);
    }
  }

  protected onClick(_event: MouseEvent): void {}

  public override connectedCallback(): void {
    super.connectedCallback();
    this._updateHostStateClasses();
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);
    if (changedProperties.has('active')) {
      this._updateHostStateClasses();
    }
  }

  public override render() {
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
