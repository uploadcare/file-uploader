import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { ChildBlock } from '../../lit/ChildBlock';

import '../Icon/Icon';

import './file-action-button.css';
import { classMap } from 'lit/directives/class-map.js';

const L10N_REMOVE_KEY = 'file-item-remove-button';

export class FileActionButton extends ChildBlock {
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

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [(listener: () => void) => ctrl.locale.subscribe(listener)];
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
          <uc-icon
            name="preloader"
            class="uc-preloader"
            style=${styleMap({
              '--l-progress-offset': String(progressOffset),
            })}
          ></uc-icon>
        </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-file-action-button': FileActionButton;
  }
}
