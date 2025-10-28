import { Data } from '@symbiotejs/symbiote';
import { ActivityBlock } from '../../abstract/ActivityBlock';
import { UploaderBlock } from '../../abstract/UploaderBlock';
import { stringToArray } from '../../utils/stringToArray';
import { UploadSource } from '../../utils/UploadSource';
import { asBoolean } from '../Config/validatorsType';
import { addDropzone, DropzoneState, type DropzoneStateValue } from './addDropzone';
import './drop-area.css';
import type { DropItem } from './getDropItems';

const GLOBAL_CTX_NAME = 'uc-drop-area';
const REGISTRY_KEY = `${GLOBAL_CTX_NAME}/registry`;

type DropAreaInitState = typeof UploaderBlock.prototype.init$ & {
  state: DropzoneStateValue;
  withIcon: boolean;
  isClickable: boolean;
  isFullscreen: boolean;
  isEnabled: boolean;
  isVisible: boolean;
  isInitFlow: boolean;
  text: string;
  [REGISTRY_KEY]: Set<DropArea>;
};

export class DropArea extends UploaderBlock {
  static override styleAttrs = [...super.styleAttrs, 'uc-drop-area'];

  private _destroyDropzone: (() => void) | null = null;
  private _destroyContentWrapperDropzone: (() => void) | null = null;
  private _onAreaClicked: ((event: Event) => void) | null = null;

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      state: DropzoneState.INACTIVE,
      withIcon: false,
      isClickable: false,
      isFullscreen: false,
      isEnabled: true,
      isVisible: true,
      isInitFlow: false,
      text: '',
      [REGISTRY_KEY]: new Set(),
    } as DropAreaInitState;
  }

  isActive(): boolean {
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

  override initCallback() {
    super.initCallback();

    this.bindL10n('text', () => this.l10n('drop-files-here'));

    const registry = (this.$ as DropAreaInitState)[REGISTRY_KEY];
    registry.add(this);

    this.defineAccessor('disabled', (value: unknown) => {
      this.set$({ isEnabled: !asBoolean(value) });
    });
    this.defineAccessor('clickable', (value: unknown) => {
      this.set$({ isClickable: asBoolean(value) });
    });
    this.defineAccessor('initflow', (value: unknown) => {
      this.set$({ isInitFlow: asBoolean(value) });
    });
    this.defineAccessor('with-icon', (value: unknown) => {
      this.set$({ withIcon: asBoolean(value) });
    });
    this.defineAccessor('fullscreen', (value: unknown) => {
      this.set$({ isFullscreen: asBoolean(value) });
    });

    this.defineAccessor('text', (value: unknown) => {
      if (typeof value === 'string') {
        this.bindL10n('text', () => this.l10n(value) || value);
      } else {
        this.bindL10n('text', () => this.l10n('drop-files-here'));
      }
    });

    this._destroyDropzone = addDropzone({
      element: this,
      shouldIgnore: () => this._shouldIgnore(),
      onChange: (state: DropzoneStateValue) => {
        this.$.state = state;
      },
      onItems: (items: DropItem[]) => {
        if (!items.length) {
          return;
        }

        items.forEach((item) => {
          if (item.type === 'url') {
            this.api.addFileFromUrl(item.url, { source: UploadSource.DROP_AREA });
          } else if (item.type === 'file') {
            this.api.addFileFromObject(item.file, { source: UploadSource.DROP_AREA, fullPath: item.fullPath });
          }
        });
        if (this.uploadCollection.size) {
          this.modalManager?.open(ActivityBlock.activities.UPLOAD_LIST);
          this.set$({
            '*currentActivity': ActivityBlock.activities.UPLOAD_LIST,
          });
        }
      },
    });

    const contentWrapperEl = this.ref['content-wrapper'];
    if (contentWrapperEl) {
      this._destroyContentWrapperDropzone = addDropzone({
        element: contentWrapperEl,
        onChange: (state: DropzoneStateValue) => {
          const stateText = Object.entries(DropzoneState)
            .find(([, value]) => value === state)?.[0]
            .toLowerCase();
          stateText && contentWrapperEl.setAttribute('drag-state', stateText);
        },
        onItems: () => {},
        shouldIgnore: () => this._shouldIgnore(),
      });
    }

    this.sub('state', (state: DropzoneStateValue) => {
      const stateText = Object.entries(DropzoneState)
        .find(([, value]) => value === state)?.[0]
        .toLowerCase();
      if (stateText) {
        this.setAttribute('drag-state', stateText);
      }
    });

    this.subConfigValue('sourceList', (value: string) => {
      const list = stringToArray(value);
      // Enable drop area if local files are allowed
      this.$.isEnabled = list.includes(UploadSource.LOCAL);
      // Show drop area if it's enabled or default slot is overrided
      this.$.isVisible = this.$.isEnabled || !this.querySelector('[data-default-slot]');
    });

    this.sub('isVisible', (value: boolean) => {
      this.toggleAttribute('hidden', !value);
    });

    this.sub('isClickable', (value: boolean) => {
      this.toggleAttribute('clickable', value);
    });

    if (this.$.isClickable) {
      const onAreaClicked = (event: Event) => {
        if (event instanceof KeyboardEvent) {
          if (event.code === 'Space' || event.code === 'Enter') {
            if (this.$.isInitFlow) {
              this.api.initFlow();
              return;
            }

            this.api.openSystemDialog();
          }
        } else if (event instanceof MouseEvent) {
          if (this.$.isInitFlow) {
            this.api.initFlow();
            return;
          }

          this.api.openSystemDialog();
        }
      };

      this._onAreaClicked = onAreaClicked;
      this.addEventListener('keydown', onAreaClicked);
      this.addEventListener('click', onAreaClicked);
    }
  }

  /** Ignore drop events if there are other visible drop areas on the page. */
  private _shouldIgnore(): boolean {
    if (!this.$.isEnabled) {
      return true;
    }
    if (!this._couldHandleFiles()) {
      return true;
    }
    if (!this.$.isFullscreen) {
      return false;
    }
    const registry = (this.$ as DropAreaInitState)[REGISTRY_KEY];
    if (registry.size === 0) {
      return false;
    }
    const otherTargets = [...registry].filter((el) => el !== this);
    const activeTargets = otherTargets.filter((el) => el.isActive());
    return activeTargets.length > 0;
  }

  private _couldHandleFiles(): boolean {
    const isMultiple = this.cfg.multiple;
    const multipleMax = this.cfg.multipleMax;
    const currentFilesCount = this.uploadCollection.size;

    if (isMultiple && multipleMax && currentFilesCount >= multipleMax) {
      return false;
    }

    if (!isMultiple && currentFilesCount > 0) {
      return false;
    }

    return true;
  }

  override destroyCallback() {
    super.destroyCallback();

    const registry = (this.$ as DropAreaInitState)[REGISTRY_KEY];
    registry.delete(this);

    if (registry.size === 0) {
      Data.deleteCtx(GLOBAL_CTX_NAME);
    }

    this._destroyDropzone?.();
    this._destroyContentWrapperDropzone?.();
    if (this._onAreaClicked) {
      this.removeEventListener('keydown', this._onAreaClicked);
      this.removeEventListener('click', this._onAreaClicked);
      this._onAreaClicked = null;
    }
  }
}

DropArea.template = /* HTML */ `
  <slot>
    <div data-default-slot hidden></div>
    <div ref="content-wrapper" class="uc-content-wrapper" set="@hidden: !isVisible">
      <div class="uc-icon-container" set="@hidden: !withIcon">
        <uc-icon name="default"></uc-icon>
        <uc-icon name="arrow-down"></uc-icon>
      </div>
      <span class="uc-text">{{text}}</span>
    </div>
  </slot>
`;

DropArea.bindAttributes({
  // @ts-expect-error TODO: fix types inside symbiote
  'with-icon': null,
  // @ts-expect-error TODO: fix types inside symbiote
  clickable: null,
  // @ts-expect-error TODO: fix types inside symbiote
  text: null,
  // @ts-expect-error TODO: fix types inside symbiote
  fullscreen: null,
  // @ts-expect-error TODO: fix types inside symbiote
  disabled: null,
  // @ts-expect-error TODO: fix types inside symbiote
  initflow: null,
});
