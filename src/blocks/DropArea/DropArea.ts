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
  static override styleAttrs = [...super.styleAttrs, 'uc-drop-area'];

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, reflect: true })
  clickable = false;

  @property({ type: Boolean, attribute: 'with-icon', reflect: true })
  withIcon = false;

  @property({ type: Boolean, reflect: true })
  fullscreen = false;

  @property({ type: Boolean, reflect: true })
  initflow = false;

  @property({ type: String })
  text?: string;

  @state()
  private isEnabled = true;

  @state()
  private isVisible = true;

  private get localizedText() {
    const customText = this.text;
    if (typeof customText === 'string' && customText.length > 0) {
      return this.l10n(customText) || customText;
    }
    return this.l10n('drop-files-here');
  }

  private _destroyDropzone: (() => void) | null = null;
  private _destroyContentWrapperDropzone: (() => void) | null = null;
  private contentWrapperRef: Ref<HTMLInputElement> = createRef();
  private readonly handleAreaInteraction = (event: Event) => {
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
  private sourceListAllowsLocal = true;
  private clickableListenersAttached = false;

  isActive(): boolean {
    if (!this.isEnabled) {
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

    dropAreaRegistry.add(this);
    this.updateIsEnabled();
    this.updateVisibility();
    this.updateClickableListeners();
    this.updateDragStateAttribute(DropzoneState.INACTIVE);

    this._destroyDropzone = addDropzone({
      element: this,
      shouldIgnore: () => this._shouldIgnore(),
      onChange: (state: DropzoneStateValue) => {
        this.updateDragStateAttribute(state);
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

    const contentWrapperEl = this.contentWrapperRef.value;
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
      this.sourceListAllowsLocal = list.includes(UploadSource.LOCAL);
      this.updateIsEnabled();
      this.updateVisibility();
    });
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('disabled')) {
      this.updateIsEnabled();
      this.updateVisibility();
    }
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('clickable')) {
      this.updateClickableListeners();
    }
  }

  /** Ignore drop events if there are other visible drop areas on the page. */
  private _shouldIgnore(): boolean {
    if (!this.isEnabled) {
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

  private updateIsEnabled(): void {
    const nextIsEnabled = this.sourceListAllowsLocal && !this.disabled;
    this.isEnabled = nextIsEnabled;
  }

  private updateVisibility(): void {
    const shouldBeVisible = this.isEnabled || !this.querySelector('[data-default-slot]');
    this.isVisible = shouldBeVisible;
    this.hidden = !shouldBeVisible;
  }

  private updateDragStateAttribute(state: DropzoneStateValue): void {
    const stateText = Object.entries(DropzoneState)
      .find(([, value]) => value === state)?.[0]
      .toLowerCase();
    if (stateText) {
      this.setAttribute('drag-state', stateText);
    }
  }

  private updateClickableListeners(): void {
    if (this.clickable && !this.clickableListenersAttached) {
      this.addEventListener('keydown', this.handleAreaInteraction);
      this.addEventListener('click', this.handleAreaInteraction);
      this.clickableListenersAttached = true;
    } else if (!this.clickable && this.clickableListenersAttached) {
      this.removeEventListener('keydown', this.handleAreaInteraction);
      this.removeEventListener('click', this.handleAreaInteraction);
      this.clickableListenersAttached = false;
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    dropAreaRegistry.delete(this);

    this._destroyDropzone?.();
    this._destroyContentWrapperDropzone?.();
    if (this.clickableListenersAttached) {
      this.removeEventListener('keydown', this.handleAreaInteraction);
      this.removeEventListener('click', this.handleAreaInteraction);
      this.clickableListenersAttached = false;
    }
  }

  override render() {
    return html`
    ${this.yield(
      '',
      html`<div data-default-slot hidden></div>
    <div ${ref(this.contentWrapperRef)} class="uc-content-wrapper" ?hidden=${!this.isVisible}>
      <div class="uc-icon-container" ?hidden=${!this.withIcon}>
        <uc-icon name="default"></uc-icon>
        <uc-icon name="arrow-down"></uc-icon>
      </div>
      <span class="uc-text">${this.localizedText}</span>
    </div>`,
    )}
    `;
  }
}
