import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { LocaleController } from '../../abstract/controllers/LocaleController';
import { RouterController } from '../../abstract/controllers/RouterController';
import type { ControllerContainer } from '../../abstract/di/ControllerContainer';
import { inject } from '../../abstract/di/inject';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ChildBlock } from '../../lit/ChildBlock';
import { UploadSource } from '../../utils/UploadSource';
import { InternalEventType } from '../UploadCtxProvider/EventEmitter';
import './url-source.css';

import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';

export class UrlSource extends ChildBlock {
  @inject(TelemetryManager) private readonly _telemetry!: TelemetryManager;
  @inject(RouterController) private readonly _router!: RouterController;
  // `api` (UploaderPublicApi) is host-boundary state with no dedicated DI
  // token — it is container-resolved (M-god step 8a), injected via `@inject`.
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  @state()
  private _url = '';

  protected override subscriptionsFor(container: ControllerContainer) {
    return [(listener: () => void) => container.get(LocaleController).subscribe(listener)];
  }

  private _handleInput = (event: Event) => {
    this._url = (event.target as HTMLInputElement | null)?.value ?? '';
  };

  private _handleUpload = (event: Event) => {
    event.preventDefault();
    this._telemetry.sendEvent({
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
    this._api.addFileFromUrl(url, { source: UploadSource.URL });
    this._router.traverse('onFileAdd');
  };

  public override render() {
    return html`
      <uc-activity-header>
        <button
          type="button"
          class="uc-mini-btn"
          @click=${() => this._router.traverse('onBack')}
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
          @click=${() => this._router.traverse('onClose')}
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
