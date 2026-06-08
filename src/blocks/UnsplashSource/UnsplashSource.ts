import { html } from 'lit';
import { state } from 'lit/decorators.js';
import '../ActivityHeader/ActivityHeader';
import '../Icon/Icon';
import './unsplash-source.css';
import { ChildBlock } from '../../abstract/ChildBlock';
import type { UploaderController } from '../../abstract/controllers/UploaderController';

type UnsplashPhoto = {
  id: string;
  urls: { small: string; full: string };
  alt_description: string | null;
  user: { name: string };
};

/**
 * v2 `<uc-unsplash-source>`. Port of v1's `uc-unsplash-activity` — same
 * markup + same search/grid flow, but extends v2's ChildBlock and reads
 * `unsplashAccessKey` from `controller.config`. Picking a photo adds it
 * via `controller.api.addFileFromUrl`.
 */
export class UnsplashSource extends ChildBlock {
  @state() private _photos: UnsplashPhoto[] = [];
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _query = '';

  private _abort: AbortController | null = null;

  protected override subscriptionsFor(ctrl: UploaderController) {
    return [ctrl.locale.subscribe.bind(ctrl.locale), ctrl.config.subscribe.bind(ctrl.config)];
  }

  protected override controllerReady(_ctrl: UploaderController): void {
    void this._load();
  }

  public override disconnectedCallback(): void {
    this._abort?.abort();
    this._abort = null;
    super.disconnectedCallback();
  }

  private _t(key: string): string {
    return this.uploaderOrNull?.locale.t(key) ?? key;
  }

  private get _accessKey(): string {
    return (this.uploaderOrNull?.config.getCustom<string>('unsplashAccessKey') as string) ?? '';
  }

  private async _load(): Promise<void> {
    if (!this._accessKey) {
      this._error = this._t('unsplash-no-key');
      this._photos = [];
      return;
    }
    this._abort?.abort();
    const abort = new AbortController();
    this._abort = abort;
    this._loading = true;
    this._error = null;
    try {
      const params = new URLSearchParams({ count: '24', client_id: this._accessKey });
      if (this._query) params.set('query', this._query);
      const res = await fetch(`https://api.unsplash.com/photos/random?${params}`, {
        signal: abort.signal,
      });
      if (!res.ok) throw new Error(`Unsplash API: ${res.status} ${res.statusText}`);
      const json = (await res.json()) as UnsplashPhoto[];
      this._photos = Array.isArray(json) ? json : [];
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      this._error = (err as Error).message;
    } finally {
      if (this._abort === abort) this._abort = null;
      this._loading = false;
    }
  }

  private _pick(photo: UnsplashPhoto): void {
    this.uploader.api.addFileFromUrl(photo.urls.full, {
      source: 'unsplash',
      fileName: `unsplash-${photo.id}.jpg`,
    });
    this.uploader.router.afterFileAdd();
  }

  private _handleBack = (): void => this.uploader.router.traverse('onCancel');
  private _handleClose = (): void => this.uploader.api.close();
  private _handleDone = (): void => {
    if (this.uploader.collection.size > 0) this.uploader.router.afterFileAdd();
    else this.uploader.router.traverse('onCancel');
  };

  private _handleQueryInput = (e: InputEvent): void => {
    this._query = (e.target as HTMLInputElement).value;
  };

  private _handleSubmit = (e: Event): void => {
    e.preventDefault();
    void this._load();
  };

  public override render() {
    const searchIcon = html`
      <svg
        class="uc-search-field-icon"
        width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    `;
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
          <uc-icon name="unsplash"></uc-icon>
          <span>${this._t('unsplash-label')}</span>
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
      <form class="uc-toolbar uc-search-toolbar" @submit=${this._handleSubmit}>
        <div class="uc-search-field">
          ${searchIcon}
          <input
            class="uc-search-input"
            type="text"
            placeholder=${this._t('unsplash-search-placeholder')}
            .value=${this._query}
            @input=${this._handleQueryInput}
          />
        </div>
        <button
          type="submit"
          class="uc-primary-btn"
          ?disabled=${this._loading}
        >${this._loading ? this._t('unsplash-loading') : this._t('unsplash-search')}</button>
      </form>
      ${
        this._error
          ? html`<div class="uc-status uc-error">${this._error}</div>`
          : this._loading
            ? html`<div class="uc-status">${this._t('unsplash-loading')}</div>`
            : html`
            <div class="uc-grid">
              ${this._photos.map(
                (photo) => html`
                  <button
                    type="button"
                    class="uc-photo"
                    title=${photo.alt_description ?? ''}
                    @click=${() => this._pick(photo)}
                  >
                    <img
                      src=${photo.urls.small}
                      alt=${photo.alt_description ?? ''}
                      loading="lazy"
                    />
                    <span class="uc-add-icon">
                      <svg
                        width="36" height="36" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                      </svg>
                    </span>
                  </button>
                `,
              )}
            </div>
          `
      }
      <div class="uc-toolbar uc-bottom-toolbar">
        <button
          type="button"
          class="uc-secondary-btn"
          @click=${this._handleDone}
        >${this._t('done')}</button>
      </div>
    `;
  }
}

if (!customElements.get('uc-unsplash-source')) customElements.define('uc-unsplash-source', UnsplashSource);
