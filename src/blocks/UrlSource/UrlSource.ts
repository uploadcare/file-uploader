import { html } from 'lit';
import { state } from 'lit/decorators.js';
import '../../blocks/UrlSource/url-source.css';
import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { UploadSource } from '../../utils/UploadSource';

/**
 * v2 `<uc-url-source>`. Port of v1's UrlSource — same DOM + state +
 * handlers, but as a v2 ChildBlock so it resolves the controller via
 * @lit/context (or `ctx-name` fallback) and re-renders on locale change.
 * The plugin mounts this element into the plugin-activity host; v1's
 * `url-source.css` styles `uc-url-source` directly, so the look stays
 * pixel-identical.
 */
export class UrlSource extends ChildBlock {
  @state()
  private _url = '';

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.locale.subscribe.bind(ctrl.locale)];
  }

  private _t(key: string): string {
    return this.uploaderOrNull?.locale.t(key) ?? key;
  }

  private _handleInput = (event: Event): void => {
    this._url = (event.target as HTMLInputElement | null)?.value ?? '';
  };

  private _handleUpload = (event: Event): void => {
    event.preventDefault();
    const url = this._url.trim();
    if (!url) return;
    this.uploader.api.addFileFromUrl(url, { source: UploadSource.URL });
    // Route through `afterFileAdd` — runs preset/DynamicBtn hooks that
    // can override the default `'upload-list'` navigation (DynamicBtn
    // suppresses it when there's no history).
    this.uploader.router.afterFileAdd();
  };

  private _handleBack = (): void => {
    this.uploader.router.traverse('onCancel');
  };

  private _handleClose = (): void => {
    this.uploader.api.close();
  };

  public override render() {
    return html`
      <uc-activity-header>
        <button
          type="button"
          class="uc-mini-btn"
          @click=${this._handleBack}
          title=${this._t('back')}
          aria-label=${this._t('back')}
        >
          <uc-icon name="back"></uc-icon>
        </button>
        <div>
          <uc-icon name="url"></uc-icon>
          <span>${this._t('caption-from-url')}</span>
        </div>
        <button
          type="button"
          class="uc-mini-btn uc-close-btn"
          @click=${this._handleClose}
          title=${this._t('a11y-activity-header-button-close')}
          aria-label=${this._t('a11y-activity-header-button-close')}
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
        >${this._t('upload-url')}</button>
      </form>
    `;
  }
}

if (!customElements.get('uc-url-source')) customElements.define('uc-url-source', UrlSource);
