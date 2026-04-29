import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';

import '../Icon/Icon';

import './file-action-button.css';
import { classMap } from 'lit/directives/class-map.js';

const L10N_REMOVE_KEY = 'file-item-remove-button';

export class FileActionButton extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-file-action-button'];

  @property({ type: Boolean })
  public uploading = false;

  @property({ type: Boolean })
  public failed = false;

  @property({ type: Number })
  public progress = 0;

  private _handleRemove() {
    this.dispatchEvent(
      new CustomEvent('uc:remove', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  public override render() {
    const classes = classMap({
      'uc-remove-btn': true,
      'uc-mini-btn': true,
      'uc-uploading': this.uploading,
      'uc-failed': this.failed,
      'uc-success': !this.uploading && this.progress === 100,
    });

    return html`
      <button
          type="button"
          @click=${this._handleRemove}
          title=${this.l10n(L10N_REMOVE_KEY)}
          aria-label=${this.l10n(L10N_REMOVE_KEY)}
          class=${classes}
        >
          <uc-icon name="remove-file"></uc-icon>
          <uc-icon name="close"></uc-icon>
        </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-action-button': FileActionButton;
  }
}
