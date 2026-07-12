import { html } from 'lit';
import { state } from 'lit/decorators.js';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { ChildBlock } from '../../lit/ChildBlock';
import { UploadSource } from '../../utils/UploadSource';
import { InternalEventType } from '../UploadCtxProvider/EventEmitter';
import './url-source.css';

import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';

export class UrlSource extends ChildBlock {
  @state()
  private _url = '';

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [(listener: () => void) => ctrl.locale.subscribe(listener)];
  }

  private _handleInput = (event: Event) => {
    this._url = (event.target as HTMLInputElement | null)?.value ?? '';
  };

  private _handleUpload = (event: Event) => {
    event.preventDefault();
    this.bag.telemetryManager.sendEvent({
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
    this.bag.api.addFileFromUrl(url, { source: UploadSource.URL });
    this.bag.router.traverse('onFileAdd');
  };

  public override render() {
    return html`
      <uc-activity-header>
        <button
          type="button"
          class="uc-mini-btn"
          @click=${() => this.bag.router.traverse('onBack')}
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
          @click=${() => this.bag.router.traverse('onClose')}
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
