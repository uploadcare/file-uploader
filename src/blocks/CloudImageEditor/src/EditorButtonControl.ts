import type { PropertyValues } from 'lit';
import { html, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { CloudImageEditorController } from './CloudImageEditorController';
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

  private _updateHostStateClasses(): void {
    this.classList.toggle('uc-active', this.active);
    this.classList.toggle('uc-not_active', !this.active);
  }

  protected onClick(_event: MouseEvent): void {}

  /**
   * Sets `buttonLabel`, `caption` and `icon`. Runs before every render, so labels resolved before the editor attached
   * or before a locale switch are redone.
   */
  protected updateLabels(): void {}

  /** Whether the control shows as selected, derived from controller state. Keeps `active` by default. */
  protected isActive(_controller: CloudImageEditorController): boolean {
    return this.active;
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    this.updateLabels();
    // Derived here, not in `render`, so `updated` sees `active` change and toggles the host classes.
    const controller = this.editorControllerOrNull;
    if (controller) {
      this.active = this.isActive(controller);
    }
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
