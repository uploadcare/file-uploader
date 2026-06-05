import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
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

  @property({ type: Boolean })
  public success = false;

  @property({ type: Boolean })
  public idle = false;

  @property({ type: Boolean })
  public hideRemove = false;

  @property({ type: Number })
  public progress = 0;

  private get _normalizedProgress(): number {
    return Math.min(Math.max(this.progress || 0, 0), 100);
  }

  private _handleAction() {
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
      'uc-idle': this.idle,
      'uc-uploading': this.uploading,
      'uc-hide-remove': this.hideRemove,
      'uc-failed': this.failed,
      'uc-success': this.success,
    });
    const progressOffset = 100 - this._normalizedProgress;
    const actionLabel = this.l10n(L10N_REMOVE_KEY);

    return html`
      <button
          type="button"
          @click=${this._handleAction}
          title=${actionLabel}
          aria-label=${actionLabel}
          class=${classes}
        >
          <span class="uc-icon-wrap">
            <uc-icon name="close"></uc-icon>
            <uc-icon name="remove-file"></uc-icon>
          </span>
          <svg
            class="uc-preloader"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
          <g transform="rotate(-90 12 12)">
              <circle
                class="uc-progress-ring"
                cx="12"
                cy="12"
                r="11"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
                stroke-linecap="round"
                pathLength="100"
                style=${styleMap({
                  '--l-progress-offset': String(progressOffset),
                })}
              />
            </g>
            <g class="uc-preloader-bg">
              <circle
                cx="12"
                cy="12"
                r="11"
                stroke="currentColor"
                stroke-width="1"
                stroke-linecap="round"
                fill="none"
                opacity="0.2"
              />
            </g>
          </svg>
        </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-action-button': FileActionButton;
  }
}
