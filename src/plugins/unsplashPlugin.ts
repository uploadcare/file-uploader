import { css, html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';

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
  public static override styles = css`
    :host {
      display: grid;
      grid-template-rows: auto auto 1fr;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      color: var(--uc-foreground, #111827);
      background: var(--uc-background, #fff);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--uc-padding, 16px);
      padding: var(--uc-padding, 16px);
      color: var(--uc-foreground, #000);
      font-weight: 500;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: var(--uc-button-size, 32px);
      height: var(--uc-button-size, 32px);
      padding: 0;
      background: transparent;
      border: none;
      border-radius: var(--uc-radius, 8px);
      color: inherit;
      cursor: pointer;
      flex-shrink: 0;
    }

    .icon-btn:hover {
      background: var(--uc-secondary-hover, #e5e7eb);
    }

    .toolbar {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--uc-border, #e4e4e8);
      flex-shrink: 0;
    }

    .search-field {
      position: relative;
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
    }

    .search-field-icon {
      position: absolute;
      left: 10px;
      color: var(--uc-muted-foreground, #9ca3af);
      pointer-events: none;
      flex-shrink: 0;
      transition: color 150ms ease;
    }

    .search-field:focus-within .search-field-icon {
      color: var(--uc-primary, #4f46e5);
    }

    .search-input {
      width: 100%;
      padding: 8px 12px 8px 34px;
      border: 1.5px solid var(--uc-border, #e4e4e8);
      border-radius: 8px;
      font-size: 14px;
      background: var(--uc-muted, #f5f5f5);
      color: var(--uc-foreground, #111827);
      outline: none;
      min-width: 0;
      transition:
        border-color 150ms ease,
        box-shadow 150ms ease,
        background-color 150ms ease;
    }

    .search-input::placeholder {
      color: var(--uc-muted-foreground, #9ca3af);
    }

    .search-input:hover {
      border-color: var(--uc-border, #e4e4e8);
      background: var(--uc-background, #fff);
    }

    .search-input:focus {
      border-color: var(--uc-primary, #4f46e5);
      background: var(--uc-background, #fff);
      box-shadow: 0 0 0 3px var(--uc-primary-transparent, rgb(79 70 229 / 10%));
    }

    .search-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: var(--uc-primary, #4f46e5);
      color: var(--uc-primary-foreground, #fff);
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: opacity 150ms ease, transform 100ms ease;
    }

    .search-btn:hover:not(:disabled) {
      opacity: 0.88;
    }

    .search-btn:active:not(:disabled) {
      transform: scale(0.97);
    }

    .search-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      grid-auto-rows: min-content;
      align-content: start;
      gap: 6px;
      padding: 12px 16px;
      overflow-y: auto;
    }

    .photo {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      background: var(--uc-muted, #f5f5f5);
    }

    .photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 200ms ease;
    }

    .photo:hover img {
      transform: scale(1.06);
    }

    .photo::after {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0);
      transition: background 200ms ease;
      pointer-events: none;
    }

    .photo:hover::after {
      background: rgba(0, 0, 0, 0.32);
    }

    .add-icon {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 200ms ease;
      color: #fff;
      pointer-events: none;
    }

    .photo:hover .add-icon {
      opacity: 1;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .status {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: var(--uc-muted-foreground, #717171);
      padding: 32px 24px;
      text-align: center;
      line-height: 1.5;
    }

    .status.error {
      color: var(--uc-destructive-foreground, #ef4444);
    }
  `;

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
      <div class="header">
        <button class="icon-btn" title="Back" @click=${() => {
          // TODO: We need API to make history back
          this.uploaderApi.setCurrentActivity?.('start-from');
          this.uploaderApi.setModalState?.(true);
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <span class="header-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 6.75V0h9v6.75h-9zm9 3.75H24V24H0V10.5h7.5v6.75h9V10.5z"/></svg>
          Unsplash
        </span>
        <button class="icon-btn" title="Close" @click=${() => this.uploaderApi.setModalState?.(false)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="toolbar">
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
        <button class="search-btn" ?disabled=${this._loading} @click=${() => void this._load()}>
          ${
            this._loading
              ? html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="animation: spin 0.7s linear infinite">
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
