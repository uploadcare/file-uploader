import { html } from 'lit';
import { state } from 'lit/decorators.js';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import { LitActivityBlock } from '../../lit/LitActivityBlock';
import type { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import '../../blocks/ActivityHeader/ActivityHeader';
import './unsplash-activity.css';

/**
 * Unsplash image from API
 */
interface UnsplashImage {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    username: string;
  };
  description: string | null;
  alt_description: string | null;
}

/**
 * Unsplash Activity - displays Unsplash images for selection
 */
export class UnsplashActivity extends LitUploaderBlock {
  public override couldBeCtxOwner = true;
  public override activityType = 'unsplash' as const;

  @state()
  private _images: UnsplashImage[] = [];

  @state()
  private _loading = false;

  @state()
  private _error: string | null = null;

  @state()
  private _searchQuery = '';

  private get _accessKey(): string {
    return this.cfg.unsplashAccessKey || 'YOUR_UNSPLASH_ACCESS_KEY';
  }

  public override initCallback(): void {
    super.initCallback();

    this.registerActivity(this.activityType, {
      onActivate: () => {
        this._loadImages();
      },
    });
  }

  private async _loadImages(query?: string): Promise<void> {
    this._loading = true;
    this._error = null;

    try {
      const endpoint = query
        ? `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20`
        : 'https://api.unsplash.com/photos?per_page=20';

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Client-ID ${this._accessKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.statusText}`);
      }

      const data = await response.json();
      this._images = query ? data.results : data;
    } catch (error) {
      this._error = error instanceof Error ? error.message : 'Failed to load images';
      console.error('Unsplash error:', error);
    } finally {
      this._loading = false;
    }
  }

  private _handleSearch(e: Event): void {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.querySelector('input') as HTMLInputElement;
    this._searchQuery = input.value;
    this._loadImages(this._searchQuery || undefined);
  }

  private async _handleImageClick(image: UnsplashImage): Promise<void> {
    const api = this.api as UploaderPublicApi;
    
    try {
      // Add image from URL
      await api.addFileFromUrl(image.urls.regular, {
        fileName: `${image.id}.jpg`,
        source: 'unsplash',
      });

      // Navigate back to upload list
      this.$['*currentActivity'] = LitActivityBlock.activities.UPLOAD_LIST;
    } catch (error) {
      console.error('Failed to add image:', error);
      this._error = 'Failed to add image';
    }
  }

  public override render() {
    return html`
      <div class="unsplash-activity">
        <uc-activity-header>
          <button
            type="button"
            class="uc-mini-btn uc-close-btn"
            @click=${() => this.historyBack()}
          >
            ${this.l10n('back')}
          </button>
          <div>${this.l10n('unsplash-title')}</div>
        </uc-activity-header>

        <div class="unsplash-content">
          <form class="unsplash-search" @submit=${this._handleSearch}>
            <input
              type="text"
              placeholder="${this.l10n('unsplash-search-placeholder')}"
              .value=${this._searchQuery}
            />
            <button type="submit">${this.l10n('unsplash-search-button')}</button>
          </form>

          ${this._loading
            ? html`<div class="unsplash-loading">${this.l10n('loading')}</div>`
            : ''}
          
          ${this._error
            ? html`<div class="unsplash-error">${this._error}</div>`
            : ''}

          ${!this._loading && !this._error
            ? html`
                <div class="unsplash-grid">
                  ${this._images.map(
                    (image) => html`
                      <div
                        class="unsplash-image"
                        @click=${() => this._handleImageClick(image)}
                      >
                        <img
                          src=${image.urls.small}
                          alt=${image.alt_description || image.description || 'Unsplash image'}
                        />
                        <div class="unsplash-image-overlay">
                          <div class="unsplash-image-author">
                            Photo by ${image.user.name}
                          </div>
                        </div>
                      </div>
                    `,
                  )}
                </div>
              `
            : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-unsplash-activity': UnsplashActivity;
  }
}
