import type { PropertyValues } from 'lit';
import { html, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { EditorBlock } from './editor-context';

import './EditorIcon';

export class EditorButtonControl extends EditorBlock {
  @state()
  public active = false;

  /** The button's accessible name, also shown as its tooltip. */
  @state()
  protected buttonLabel = '';

  /** Text shown inside the button; hidden when empty. */
  @state()
  protected caption = '';

  @state()
  protected icon = '';

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

  /**
   * Sets `buttonLabel`, `caption` and `icon`. Runs before every render, so labels resolved before the editor attached
   * or before a locale switch are redone.
   */
  protected updateLabels(): void {}

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    this.updateLabels();
  }

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

  /** What goes inside the button: the icon, then the caption. */
  protected renderContent(): TemplateResult {
    return html`<uc-editor-icon name=${this.icon}></uc-editor-icon>${this.renderCaption()}`;
  }

  protected renderCaption(): TemplateResult {
    return html`<div class="uc-title" ?hidden=${!this.caption}>${this.caption}</div>`;
  }

  public override render() {
    return html`
      <button
        role="option"
        aria-selected=${this.active ? 'true' : 'false'}
        type="button"
        aria-label=${ifDefined(this.buttonLabel)}
        title=${ifDefined(this.buttonLabel)}
        @click=${this.onClick}
      >
        ${this.renderContent()}
      </button>
    `;
  }
}
