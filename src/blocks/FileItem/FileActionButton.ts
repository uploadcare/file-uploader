import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import '../../blocks/FileItem/file-action-button.css';
import '../Icon/Icon';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';

const L10N_REMOVE_KEY = 'file-item-remove-button';

/**
 * v2 `<uc-file-action-button>`. Multi-state remove/abort button used by
 * DynamicBtn: morphs between `idle/uploading/success/failed` to show
 * either a remove glyph or a spinner overlay. Dispatches `uc:remove`
 * (bubbling) when clicked so the host decides what to do — remove all,
 * abort all, or clear failed.
 */
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

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.locale.subscribe.bind(ctrl.locale)];
  }

  private _handleRemove = (): void => {
    this.dispatchEvent(
      new CustomEvent('uc:remove', {
        bubbles: true,
        composed: true,
      }),
    );
  };

  public override render() {
    const label = this.uploaderOrNull?.locale.t(L10N_REMOVE_KEY) ?? L10N_REMOVE_KEY;
    const classes = classMap({
      'uc-remove-btn': true,
      'uc-mini-btn': true,
      'uc-idle': this.idle,
      'uc-uploading': this.uploading,
      'uc-failed': this.failed,
      'uc-success': this.success,
    });

    return html`
      <button
        type="button"
        @click=${this._handleRemove}
        title=${label}
        aria-label=${label}
        class=${classes}
      >
        <uc-icon name="remove-file"></uc-icon>
        <uc-icon name="close"></uc-icon>
      </button>
    `;
  }
}

if (!customElements.get('uc-file-action-button')) customElements.define('uc-file-action-button', FileActionButton);

// Tag is globally declared by v1's `src/blocks/FileItem/FileActionButton.ts`.
