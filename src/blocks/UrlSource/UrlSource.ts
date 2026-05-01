import { consume } from '@lit/context';
import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { LitActivityBlock } from '../../lit/LitActivityBlock';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import { UploadSource } from '../../utils/UploadSource';
import { smartBtnActiveContext } from '../SmartBtn/smart-btn-context';
import { InternalEventType } from '../UploadCtxProvider/EventEmitter';
import './url-source.css';

import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';

export class UrlSource extends LitUploaderBlock {
  @state()
  private _url = '';

  @consume({ context: smartBtnActiveContext, subscribe: true })
  @state()
  private _smartBtnActive = false;

  private _handleInput = (event: Event) => {
    this._url = (event.target as HTMLInputElement | null)?.value ?? '';
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
    const url = this._url.trim();
    if (!url) {
      return;
    }
    this.api.addFileFromUrl(url, { source: UploadSource.URL });

    if (this._usingAdjustBasedOnSmartBtn()) {
      this.modalManager?.close(this.$['*currentActivity']);
      this.$['*currentActivity'] = null;
      return;
    }

    this.$['*currentActivity'] = LitActivityBlock.activities.UPLOAD_LIST;
    this.modalManager?.open(LitActivityBlock.activities.UPLOAD_LIST);
  };

  private _usingAdjustBasedOnSmartBtn() {
    const history = this._sharedInstancesBag.ctx.read('*history');
    const len = history.length;

    if (len === 0 && this._smartBtnActive) {
      return true;
    }

    return false;
  }

  public override render() {
    return html`
      <uc-activity-header>
        <button
          type="button"
          class="uc-mini-btn"
          @click=${this.historyBack}
          title=${this.l10n('back')}
          aria-label=${this.l10n('back')}
        >
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
            placeholder="https://"
            class="uc-url-input"
            type="text"
            autofocus
            @input=${this._handleInput}
          />
        </label>
        <button
          type="submit"
          class="uc-url-upload-btn uc-primary-btn"
          ?disabled=${!this._url}
        >
          ${this.l10n('upload-url')}
        </button>
      </form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-url-source': UrlSource;
  }
}
