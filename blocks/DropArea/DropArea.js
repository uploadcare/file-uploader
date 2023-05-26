import { UploaderBlock } from '../../abstract/UploaderBlock.js';
import { ActivityBlock } from '../../abstract/ActivityBlock.js';
import { DropzoneState, addDropzone } from './addDropzone.js';
import { fileIsImage } from '../../utils/fileTypes.js';
import { Modal } from '../Modal/Modal.js';
import { stringToArray } from '../../utils/stringToArray.js';

export class DropArea extends UploaderBlock {
  init$ = {
    ...this.init$,
    state: DropzoneState.INACTIVE,
    withIcon: false,
    isClickable: false,
    isFullscreen: false,
    isEnabled: true,
    isVisible: true,
    text: this.l10n('drop-files-here'),
    'lr-drop-area/targets': null,
  };

  isActive() {
    if (!this.$.isEnabled) {
      return false;
    }
    const bounds = this.getBoundingClientRect();
    const hasSize = bounds.width > 0 && bounds.height > 0;
    const isInViewport =
      bounds.top >= 0 &&
      bounds.left >= 0 &&
      bounds.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      bounds.right <= (window.innerWidth || document.documentElement.clientWidth);

    const style = window.getComputedStyle(this);
    const visible = style.visibility !== 'hidden' && style.display !== 'none';

    return hasSize && visible && isInViewport;
  }
  initCallback() {
    super.initCallback();

    if (!this.$['lr-drop-area/targets']) {
      this.$['lr-drop-area/targets'] = new Set();
    }
    this.$['lr-drop-area/targets'].add(this);

    this.defineAccessor('disabled', (value) => {
      this.set$({ isEnabled: !value });
    });
    this.defineAccessor('clickable', (value) => {
      this.set$({ isClickable: typeof value === 'string' });
    });
    this.defineAccessor('with-icon', (value) => {
      this.set$({ withIcon: typeof value === 'string' });
    });
    this.defineAccessor('fullscreen', (value) => {
      this.set$({ isFullscreen: typeof value === 'string' });
    });

    this.defineAccessor('text', (value) => {
      if (value) {
        this.set$({ text: this.l10n(value) || value });
      } else {
        this.set$({ text: this.l10n('drop-files-here') });
      }
    });

    /** @private */
    this._destroyDropzone = addDropzone({
      element: this,
      shouldIgnore: () => this._shouldIgnore(),
      onChange: (state) => {
        this.$.state = state;
      },
      /** @param {(File | String)[]} items */
      onItems: (items) => {
        if (!items.length) {
          return;
        }
        let isMultiple = this.cfg.multiple;
        let multipleMax = this.cfg.multipleMax;
        let currentFilesCount = this.uploadCollection.size;
        if (isMultiple && multipleMax) {
          items = items.slice(0, multipleMax - currentFilesCount - 1);
        } else if (!isMultiple) {
          items = items.slice(0, currentFilesCount > 0 ? 0 : 1);
        }
        items.forEach((/** @type {File | String} */ item) => {
          if (typeof item === 'string') {
            this.uploadCollection.add({
              externalUrl: item,
            });
            return;
          }
          let isImage = fileIsImage(item);
          this.uploadCollection.add({
            file: item,
            isImage: isImage,
            mimeType: item.type,
            fileName: item.name,
            fileSize: item.size,
          });
        });
        if (this.uploadCollection.size) {
          this.set$({
            '*currentActivity': ActivityBlock.activities.UPLOAD_LIST,
          });
          this.setForCtxTarget(Modal.StateConsumerScope, '*modalActive', true);
        }
      },
    });

    let contentWrapperEl = this.ref['content-wrapper'];
    if (contentWrapperEl) {
      this._destroyContentWrapperDropzone = addDropzone({
        element: contentWrapperEl,
        onChange: (state) => {
          const stateText = Object.entries(DropzoneState)
            .find(([, value]) => value === state)?.[0]
            .toLowerCase();
          stateText && contentWrapperEl.setAttribute('drag-state', stateText);
        },
        onItems: () => {},
        shouldIgnore: () => this._shouldIgnore(),
      });
    }

    this.sub('state', (state) => {
      const stateText = Object.entries(DropzoneState)
        .find(([, value]) => value === state)?.[0]
        .toLowerCase();
      if (stateText) {
        this.setAttribute('drag-state', stateText);
      }
    });

    this.subConfigValue('sourceList', (value) => {
      const list = stringToArray(value);
      // Enable drop area if local files are allowed
      this.$.isEnabled = list.includes(UploaderBlock.sourceTypes.LOCAL);
      // Show drop area if it's enabled or default slot is overrided
      this.$.isVisible = this.$.isEnabled || !this.querySelector('[data-default-slot]');
    });

    this.sub('isVisible', (value) => {
      this.toggleAttribute('hidden', !value);
    });

    if (this.$.isClickable) {
      // @private
      this._onAreaClicked = () => {
        this.openSystemDialog();
      };
      this.addEventListener('click', this._onAreaClicked);
    }
  }

  /**
   * Ignore drop events if there are other visible drop areas on the page
   *
   * @private
   * @returns {Boolean}
   */
  _shouldIgnore() {
    if (!this.$.isEnabled) {
      return true;
    }
    if (!this._couldHandleFiles()) {
      return true;
    }
    if (!this.$.isFullscreen) {
      return false;
    }
    const otherTargets = [...this.$['lr-drop-area/targets']].filter((el) => el !== this);
    const activeTargets = otherTargets.filter((/** @type {typeof this} */ el) => {
      return el.isActive();
    });
    return activeTargets.length > 0;
  }

  /** @private */
  _couldHandleFiles() {
    let isMultiple = this.cfg.multiple;
    let multipleMax = this.cfg.multipleMax;
    let currentFilesCount = this.uploadCollection.size;

    if (isMultiple && multipleMax && currentFilesCount >= multipleMax) {
      return false;
    }

    if (!isMultiple && currentFilesCount > 0) {
      return false;
    }

    return true;
  }

  destroyCallback() {
    super.destroyCallback();

    this.$['lr-drop-area/targets']?.remove?.(this);

    this._destroyDropzone?.();
    this._destroyContentWrapperDropzone?.();
    if (this._onAreaClicked) {
      this.removeEventListener('click', this._onAreaClicked);
    }
  }
}

DropArea.template = /* HTML */ `
  <slot>
    <div data-default-slot hidden></div>
    <div ref="content-wrapper" class="content-wrapper" set="@hidden: !isVisible">
      <div class="icon-container" set="@hidden: !withIcon">
        <lr-icon name="default"></lr-icon>
        <lr-icon name="arrow-down"></lr-icon>
      </div>
      <span class="text">{{text}}</span>
    </div>
  </slot>
`;

DropArea.bindAttributes({
  'with-icon': null,
  clickable: null,
  text: null,
  fullscreen: null,
  disabled: null,
});
