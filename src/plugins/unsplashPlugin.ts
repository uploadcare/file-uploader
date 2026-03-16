import { html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';

import '../blocks/ActivityHeader/ActivityHeader.js';
import '../blocks/Icon/Icon.js';
import './unsplash-activity.css';
import type { PluginUploaderApi, UploaderPlugin } from '../abstract/managers/plugin/index.js';

const UNSPLASH_ACTIVITY_ID = 'unsplash-gallery';

const UNSPLASH_ICON_SVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M7.5 6.75V0h9v6.75h-9zm9 3.75H24V24H0V10.5h7.5v6.75h9V10.5z"/></svg>';

type UnsplashPhoto = {
  id: string;
  urls: { small: string; full: string };
  alt_description: string | null;
  user: { name: string };
};

class UcUnsplashActivity extends LitElement {
  public override createRenderRoot() {
    return this;
  }

  @property({ attribute: false })
  public uploaderApi!: PluginUploaderApi;

  @property({ attribute: false })
  public override accessKey = '';

  @state()
  private _photos: UnsplashPhoto[] = [];

  @state()
  private _loading = false;

  @state()
  private _error: string | null = null;

  @state()
  private _query = '';

  public override connectedCallback() {
    super.connectedCallback();
    void this._load();
  }

  private async _load() {
    if (!this.accessKey) {
      this._error = 'No Unsplash API key configured.\nAdd unsplash-access-key="YOUR_KEY" to <uc-config>.';
      return;
    }

    this._loading = true;
    this._error = null;

    try {
      const params = new URLSearchParams({ count: '24', client_id: this.accessKey });
      if (this._query) params.set('query', this._query);

      const res = await fetch(`https://api.unsplash.com/photos/random?${params}`);
      if (!res.ok) throw new Error(`Unsplash API error: ${res.status} ${res.statusText}`);

      this._photos = (await res.json()) as UnsplashPhoto[];
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load photos';
    } finally {
      this._loading = false;
    }
  }

  private _pick(photo: UnsplashPhoto) {
    this.uploaderApi.addFileFromUrl(photo.urls.full, {
      fileName: `unsplash-${photo.id}.jpg`,
      source: 'unsplash',
    });
    this.uploaderApi.setCurrentActivity?.('upload-list');
    this.uploaderApi.setModalState?.(true);
  }

  public override render() {
    return html`
      <div class="uc-ui-activity-header">
        <button type="button" class="uc-ui-icon-btn" title="Back" @click=${() => this.uploaderApi.historyBack()}>
          <uc-icon name="back"></uc-icon>
        </button>
        <div>
          <uc-icon name="unsplash"></uc-icon>
          <span>Unsplash</span>
        </div>
        <button type="button" class="uc-ui-icon-btn" title="Close" @click=${() => this.uploaderApi.setModalState?.(false)}>
          <uc-icon name="close"></uc-icon>
        </button>
      </div>

      <div class="uc-ui-toolbar search-toolbar">
        <div class="search-field">
          <svg class="search-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            class="search-input"
            type="text"
            placeholder="Search photos…"
            .value=${this._query}
            @input=${(e: InputEvent) => {
              this._query = (e.target as HTMLInputElement).value;
            }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') void this._load();
            }}
          />
        </div>
        <button type="button" class="uc-ui-primary-btn" ?disabled=${this._loading} @click=${() => void this._load()}>
          ${
            this._loading
              ? html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="animation: uc-unsplash-spin 0.7s linear infinite">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>`
              : html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>`
          }
          ${this._loading ? 'Loading…' : 'Search'}
        </button>
      </div>

      ${
        this._error
          ? html`<div class="status error">${this._error}</div>`
          : this._loading
            ? html`<div class="status">Loading photos…</div>`
            : html`
              <div class="grid">
                ${this._photos.map(
                  (photo) => html`
                    <div class="photo" title=${photo.alt_description ?? ''} @click=${() => this._pick(photo)}>
                      <img src=${photo.urls.small} alt=${photo.alt_description ?? ''} loading="lazy" />
                      <span class="add-icon">
                        <svg
                          width="36"
                          height="36"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                      </span>
                    </div>
                  `,
                )}
              </div>
            `
      }
      <div class="uc-ui-toolbar bottom-toolbar">
        <div class="uc-ui-toolbar-spacer"></div>
        <button type="button" class="uc-ui-secondary-btn" @click=${() => {
          this.uploaderApi.setCurrentActivity?.('upload-list');
          this.uploaderApi.setModalState?.(true);
        }}>Done</button>
      </div>
    `;
  }
}

customElements.define('uc-unsplash-activity', UcUnsplashActivity);

export const unsplashPlugin: UploaderPlugin = {
  id: 'unsplash',
  setup({ pluginApi, uploaderApi }) {
    pluginApi.registry.registerConfig({
      name: 'unsplashAccessKey',
      defaultValue: 'coTRXFIt3uBtv4MRhmSy1-w55dDL0nV2X1ure63W78c',
      attribute: true,
    });

    pluginApi.registry.registerIcon({
      name: 'unsplash',
      svg: UNSPLASH_ICON_SVG,
    });

    pluginApi.registry.registerI18n({
      en: { 'unsplash.label': 'Unsplash' },
    });

    pluginApi.registry.registerSource({
      id: 'unsplash',
      label: 'unsplash.label',
      icon: 'unsplash',
      onSelect() {
        uploaderApi.setCurrentActivity?.(UNSPLASH_ACTIVITY_ID);
        uploaderApi.setModalState?.(true);
      },
    });

    pluginApi.registry.registerActivity({
      id: UNSPLASH_ACTIVITY_ID,
      render(el) {
        const activityEl = document.createElement('uc-unsplash-activity') as UcUnsplashActivity;
        activityEl.uploaderApi = uploaderApi;
        activityEl.accessKey = pluginApi.config.get('unsplashAccessKey');

        const unsubscribe = pluginApi.config.subscribe('unsplashAccessKey', (value) => {
          activityEl.accessKey = value;
        });

        el.replaceChildren(activityEl);

        return () => {
          unsubscribe();
          el.replaceChildren();
        };
      },
    });
  },
};

declare module '../abstract/customConfigOptions' {
  interface CustomConfig {
    unsplashAccessKey: string;
  }
}

declare module '../lit/LitActivityBlock' {
  interface CustomActivities {
    [UNSPLASH_ACTIVITY_ID]: { params: never };
  }
}
