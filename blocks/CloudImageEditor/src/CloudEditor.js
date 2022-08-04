import { Block } from '../../../abstract/Block.js';
import { createCdnUrl, createCdnUrlModifiers, createOriginalUrl } from '../../../utils/cdn-utils.js';
import { classNames } from './lib/classNames.js';
import { debounce } from './lib/debounce.js';
import { preloadImage } from './lib/preloadImage.js';
import { TRANSPARENT_PIXEL_SRC } from './lib/transparentPixelSrc.js';
import { initState } from './state.js';
import { TEMPLATE } from './template.js';
import { TabId } from './toolbar-constants.js';
import { viewerImageSrc } from './util.js';

export class CloudEditor extends Block {
  get ctxName() {
    return this.autoCtxName;
  }

  init$ = {
    ...this.init$,
    ...initState(this),
  };

  /** @private */
  _debouncedShowLoader = debounce(this._showLoader.bind(this), 300);

  _showLoader(show) {
    this.$.showLoader = show;
  }

  _loadImageFromCdn() {
    this._debouncedShowLoader(true);
    let src = this._imageSrc();
    let { promise, cancel } = preloadImage(src);
    promise
      .then(() => {
        this.$.src = src;
      })
      .catch((err) => {
        this.$['*networkProblems'] = true;
        this._debouncedShowLoader(false);
        this.$.src = src;
      });
    this._cancelPreload && this._cancelPreload();
    this._cancelPreload = cancel;
  }

  _imageSrc() {
    let { width } = this.ref['img-container-el'].getBoundingClientRect();
    return this.proxyUrl(viewerImageSrc(this.$['*originalUrl'], width, {}));
  }

  /**
   * To proper work, we need non-zero size the element. So, we'll wait for it.
   *
   * @private
   * @returns {Promise<void>}
   */
  _waitForSize() {
    return new Promise((resolve, reject) => {
      let timeout = 300;
      let start = Date.now();

      let callback = () => {
        // there could be problem when element disconnected and connected again between ticks
        if (!this.isConnected) {
          clearInterval(interval);
          reject();
          return;
        }
        if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error('[cloud-image-editor] timout waiting for non-zero container size'));
          return;
        }
        let { width, height } = this.getBoundingClientRect();

        if (width > 0 && height > 0) {
          clearInterval(interval);
          resolve();
        }
      };
      let interval = setInterval(callback, 50);
      callback();
    });
  }

  cssInit$ = {
    '--cfg-cdn-cname': 'https://ucarecdn.com',
  };

  async initCallback() {
    this.$['*originalUrl'] = createOriginalUrl(this.localCtx.read('--cfg-cdn-cname'), this.$.uuid);

    this.$['*faderEl'] = this.ref['fader-el'];
    this.$['*cropperEl'] = this.ref['cropper-el'];
    this.$['*imgContainerEl'] = this.ref['img-container-el'];

    this.classList.add('editor_ON');

    this.sub('*networkProblems', (networkProblems) => {
      this.$['presence.networkProblems'] = networkProblems;
      this.$['presence.modalCaption'] = !networkProblems;
    });

    this.ref['img-el'].addEventListener('load', (e) => {
      this._imgLoading = false;
      this._debouncedShowLoader(false);

      if (this.$.src !== TRANSPARENT_PIXEL_SRC) {
        this.$['*networkProblems'] = false;
      }
    });

    this.ref['img-el'].addEventListener('error', (e) => {
      this._imgLoading = false;
      this._debouncedShowLoader(false);

      this.$['*networkProblems'] = true;
    });

    this.sub('src', (src) => {
      let el = this.ref['img-el'];
      if (el.src !== src) {
        this._imgLoading = true;
        el.src = src || TRANSPARENT_PIXEL_SRC;
      }
    });

    this.sub('*tabId', (tabId) => {
      this.ref['img-el'].className = classNames('image', {
        image_hidden_to_cropper: tabId === TabId.CROP,
        image_hidden_effects: tabId !== TabId.CROP,
      });
    });

    try {
      // TODO: catch errors
      fetch(createCdnUrl(this.$['*originalUrl'], createCdnUrlModifiers('json')))
        .then((response) => response.json())
        .then(({ width, height }) => {
          this.$['*imageSize'] = { width, height };
        });
      await this._waitForSize();
      this._loadImageFromCdn();
    } catch (err) {
      if (err) {
        console.error('Failed to load image info', err);
      }
    }
  }
}

CloudEditor.template = TEMPLATE;
CloudEditor.bindAttributes({
  uuid: 'uuid',
});
