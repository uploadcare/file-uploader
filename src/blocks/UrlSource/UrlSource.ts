import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { LitActivityBlock } from '../../lit/LitActivityBlock';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import { UploadSource } from '../../utils/UploadSource';
import { InternalEventType } from '../UploadCtxProvider/EventEmitter';
import './url-source.css';

import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';

interface UrlSourceState {
  importDisabled: boolean;
}

export class UrlSource extends LitUploaderBlock {
  @state()
  private _formState: UrlSourceState = {
    importDisabled: true,
  };

  private _inputRef = createRef<HTMLInputElement>();

  private _handleInput = (event: Event) => {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this._formState = { importDisabled: !value };
  };

  private _handleUpload = (event: Event) => {
    event.preventDefault();
    this.telemetryManager.sendEvent({
      eventType: InternalEventType.ACTION_EVENT,
      payload: {
        metadata: {
          event: 'upload-from-url',
          node: this.tagName,
        },
      },
    });
    const input = this._inputRef.value;
    const url = input?.value?.trim();
    if (!url) {
      return;
    }
    this.api.addFileFromUrl(url, { source: UploadSource.URL });
    this.modalManager?.open(LitActivityBlock.activities.UPLOAD_LIST);
    this.$['*currentActivity'] = LitActivityBlock.activities.UPLOAD_LIST;
  };

  public override firstUpdated() {
    const input = this._inputRef.value;
    if (input) {
      input.value = '';
      input.focus();
    }
  }

  public override render() {
    return html`
      <uc-activity-header>
        <button type="button" class="uc-mini-btn" @click=${this.historyBack} title=${this.l10n('back')} aria-label=${this.l10n('back')}>
          <uc-icon name="back"></uc-icon>
        </button>
        <div>
          <uc-icon name="url"></uc-icon>
          <span>${this.l10n('caption-from-url')}</span>
        </div>
        <button
          type="button"
          class="uc-mini-btn uc-close-btn"
          @click=${this.$['*closeModal']}
          title=${this.l10n('a11y-activity-header-button-close')}
          aria-label=${this.l10n('a11y-activity-header-button-close')}
        >
          <uc-icon name="close"></uc-icon>
        </button>
      </uc-activity-header>
      <form class="uc-content" @submit=${this._handleUpload}>
        <label>
          <input
            ${ref(this._inputRef)}
            placeholder="https://"
            class="uc-url-input"
            type="text"
            @input=${this._handleInput}
          />
        </label>
          <button
            type="submit"
            class="uc-url-upload-btn uc-primary-btn"
            ?disabled=${this._formState.importDisabled}
            >${this.l10n('upload-url')}</button>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-url-source': UrlSource;
  }
}
