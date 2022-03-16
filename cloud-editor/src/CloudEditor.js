import { ElementComponent } from '@uploadcare/elements';
import { classNames } from './lib/classNames.js';
import { debounce } from './lib/debounce.js';
import { preloadImage } from './lib/preloadImage.js';
import { TRANSPARENT_PIXEL_SRC } from './lib/transparentPixelSrc.js';
import { initState } from './state.js';
import { TEMPLATE } from './template.js';
import { TabId } from './toolbar-constants.js';
import { viewerImageSrc } from './util.js';

export class CloudEditor extends ElementComponent {
  init$ = initState(this);
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
    return viewerImageSrc(this.$['*originalUrl'], width, {});
  }

  initCallback() {
    super.initCallback();

    // TODO: fix hardcode
    this.$['*originalUrl'] = `https://ucarecdn.com/${this.$.uuid}/`;

    fetch(`${this.$['*originalUrl']}-/json/`)
      .then((response) => response.json())
      .then(({ width, height }) => {
        this.$['*imageSize'] = { width, height };
      });

    this._loadImageFromCdn();

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
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }
}

CloudEditor.template = TEMPLATE;
CloudEditor.bindAttributes({
  uuid: 'uuid',
});
