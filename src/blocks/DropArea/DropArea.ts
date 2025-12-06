import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import { LitActivityBlock } from '../../lit/LitActivityBlock';
import { LitUploaderBlock } from '../../lit/LitUploaderBlock';
import { stringToArray } from '../../utils/stringToArray';
import { UploadSource } from '../../utils/UploadSource';
import { addDropzone, DropzoneState, type DropzoneStateValue } from './addDropzone';
import './drop-area.css';
import type { DropItem } from './getDropItems';

const dropAreaRegistry = new Set<DropArea>();

export class DropArea extends LitUploaderBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-drop-area'];

  @property({ type: Boolean, reflect: true })
  public disabled = false;

  @property({ type: Boolean, reflect: true })
  public clickable = false;

  @property({ type: Boolean, attribute: 'with-icon', reflect: true })
  public withIcon = false;

  @property({ type: Boolean, reflect: true })
  public fullscreen = false;

  @property({ type: Boolean, reflect: true })
  public initflow = false;

  @property({ type: String })
  public text?: string;

  @state()
  private _isEnabled = true;

  @state()
  private _isVisible = true;

  private get _localizedText() {
    const customText = this.text;
    if (typeof customText === 'string' && customText.length > 0) {
      return this.l10n(customText) || customText;
    }
    return this.l10n('drop-files-here');
  }

  private _destroyDropzone: (() => void) | null = null;
  private _destroyContentWrapperDropzone: (() => void) | null = null;
  private _contentWrapperRef: Ref<HTMLInputElement> = createRef();
  private readonly _handleAreaInteraction = (event: Event) => {
    if (event instanceof KeyboardEvent) {
      if (event.code !== 'Space' && event.code !== 'Enter') {
        return;
      }
    } else if (!(event instanceof MouseEvent)) {
      return;
    }

    if (this.initflow) {
      this.api.initFlow();
      return;
    }

    this.api.openSystemDialog();
  };
  private _sourceListAllowsLocal = true;
  private _clickableListenersAttached = false;

  public isActive(): boolean {
    if (!this._isEnabled) {
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

  public override initCallback(): void {
    super.initCallback();

    dropAreaRegistry.add(this);
    this._updateIsEnabled();
    this._updateVisibility();
    this._updateClickableListeners();
    this._updateDragStateAttribute(DropzoneState.INACTIVE);

    this._destroyDropzone = addDropzone({
      element: this,
      shouldIgnore: () => this._shouldIgnore(),
      onChange: (state: DropzoneStateValue) => {
        this._updateDragStateAttribute(state);
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
          this.modalManager?.open(LitActivityBlock.activities.UPLOAD_LIST);
          this.set$({
            '*currentActivity': LitActivityBlock.activities.UPLOAD_LIST,
          });
        }
      },
    });

    const contentWrapperEl = this._contentWrapperRef.value;
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

    this.subConfigValue('sourceList', (value: string) => {
      const list = stringToArray(value);
      this._sourceListAllowsLocal = list.includes(UploadSource.LOCAL);
      this._updateIsEnabled();
      this._updateVisibility();
    });
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('disabled')) {
      this._updateIsEnabled();
      this._updateVisibility();
    }
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('clickable')) {
      this._updateClickableListeners();
    }
  }

  /** Ignore drop events if there are other visible drop areas on the page. */
  private _shouldIgnore(): boolean {
    if (!this._isEnabled) {
      return true;
    }
    if (!this._couldHandleFiles()) {
      return true;
    }
    if (!this.fullscreen) {
      return false;
    }
    const registry = dropAreaRegistry;
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

  private _updateIsEnabled(): void {
    const nextIsEnabled = this._sourceListAllowsLocal && !this.disabled;
    this._isEnabled = nextIsEnabled;
  }

  private _updateVisibility(): void {
    const shouldBeVisible = this._isEnabled || !this.querySelector('[data-default-slot]');
    this._isVisible = shouldBeVisible;
    this.hidden = !shouldBeVisible;
  }

  private _updateDragStateAttribute(state: DropzoneStateValue): void {
    const stateText = Object.entries(DropzoneState)
      .find(([, value]) => value === state)?.[0]
      .toLowerCase();
    if (stateText) {
      this.setAttribute('drag-state', stateText);
    }
  }

  private _updateClickableListeners(): void {
    if (this.clickable && !this._clickableListenersAttached) {
      this.addEventListener('keydown', this._handleAreaInteraction);
      this.addEventListener('click', this._handleAreaInteraction);
      this._clickableListenersAttached = true;
    } else if (!this.clickable && this._clickableListenersAttached) {
      this.removeEventListener('keydown', this._handleAreaInteraction);
      this.removeEventListener('click', this._handleAreaInteraction);
      this._clickableListenersAttached = false;
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();

    dropAreaRegistry.delete(this);

    this._destroyDropzone?.();
    this._destroyContentWrapperDropzone?.();
    if (this._clickableListenersAttached) {
      this.removeEventListener('keydown', this._handleAreaInteraction);
      this.removeEventListener('click', this._handleAreaInteraction);
      this._clickableListenersAttached = false;
    }
  }

  public override render() {
    return html`
    ${this.yield(
      '',
      html`<div data-default-slot hidden></div>
    <div ${ref(this._contentWrapperRef)} class="uc-content-wrapper" ?hidden=${!this._isVisible}>
      <div class="uc-icon-container" ?hidden=${!this.withIcon}>
        <uc-icon name="default"></uc-icon>
        <uc-icon name="arrow-down"></uc-icon>
      </div>
      <span class="uc-text">${this._localizedText}</span>
    </div>`,
    )}
    `;
  }
}
