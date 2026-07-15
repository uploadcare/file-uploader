import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, type Ref, ref } from 'lit/directives/ref.js';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { ChildBlock } from '../../lit/ChildBlock';
import { createDebugPrinter } from '../../lit/createDebugPrinter';
import { ensureUploaderScope } from '../../lit/ensureUploaderScope';
import { stringToArray } from '../../utils/stringToArray';
import { UploadSource } from '../../utils/UploadSource';
import { addDropzone, DropzoneState, type DropzoneStateValue } from './addDropzone';
import './drop-area.css';
import type { DropItem } from './getDropItems';

import '../Icon/Icon';

const dropAreaRegistry = new Set<DropArea>();

export class DropArea extends ChildBlock {
  public static override styleAttrs = [...super.styleAttrs, 'uc-drop-area'];

  public declare attributesMeta: {
    single?: boolean;
    ghost?: boolean;
    disabled?: boolean;
    clickable?: boolean;
    'with-icon'?: boolean;
    fullscreen?: boolean;
    initflow?: boolean;
    text?: string;
    'ctx-name': string;
  };

  /** Same contract as v1 `LitBlock.debugPrint` (`createDebugPrinter`), scoped to this ctx. */
  private _debugPrint = createDebugPrinter(() => this.bag.ctx, this.constructor.name);

  /**
   * CSS-only attribute
   */
  @property({ type: Boolean, noAccessor: true })
  public single = false;

  /**
   * CSS-only attribute
   */
  @property({ type: Boolean, noAccessor: true })
  public ghost = false;

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

  private _dropTextKey = 'drop-files-here';

  private _isMultiple = false;
  private _updateDropText(): void {
    const customText = this.text;
    if (typeof customText === 'string' && customText.length > 0) {
      this._dropTextKey = customText;
      return;
    }
    this._dropTextKey = this._isMultiple ? 'drop-files-here' : 'drop-file-here';
  }

  private _destroyDropzone: (() => void) | null = null;
  private _destroyContentWrapperDropzone: (() => void) | null = null;
  private _contentWrapperRef: Ref<HTMLDivElement> = createRef();
  private readonly _handleAreaInteraction = (event: Event) => {
    if (event instanceof KeyboardEvent) {
      if (event.code !== 'Space' && event.code !== 'Enter') {
        return;
      }
    } else if (!(event instanceof MouseEvent)) {
      return;
    }

    if (this.initflow) {
      this.bag.api.initFlow();
      return;
    }

    this.bag.api.openSystemDialog();
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

  protected override controllerReady(ctrl: UploaderController): void {
    // `<uc-drop-area>` is the uploader block in the built-in solutions (they
    // never render `<uc-upload-ctx-provider>`), so it must attach the
    // uploader scope itself — same contract as v1's `LitUploaderBlock.
    // initCallback`, and the identical seam `<uc-upload-ctx-provider>` uses.
    ensureUploaderScope(
      this.bag,
      ctrl,
      (...args) => this._debugPrint(...args),
      (type, payload, options) => this.emit(type, payload, options),
    );

    // Re-adoption (release-while-connected followed by re-adopt) would
    // otherwise stack a new dropzone per adoption without ever removing the
    // previous one's listeners — tear down any prior instances before
    // recreating them below (same teardown-before-recreate hazard
    // `UploadCtxProvider` handles for its `EventBridgeController`). The
    // `ensureUploaderScope` call above is idempotent and never touches the
    // dropzones, so its position relative to this teardown is immaterial.
    this._destroyDropzone?.();
    this._destroyDropzone = null;
    this._destroyContentWrapperDropzone?.();
    this._destroyContentWrapperDropzone = null;

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
        const prevSize = this.bag.uploadCollection.size;

        items.forEach((item) => {
          if (item.type === 'url') {
            this.bag.api.addFileFromUrl(item.url, {
              source: UploadSource.DROP_AREA,
            });
          } else if (item.type === 'file') {
            this.bag.api.addFileFromObject(item.file, {
              source: UploadSource.DROP_AREA,
              fullPath: item.fullPath,
            });
          }
        });
        if (this.bag.uploadCollection.size > prevSize) {
          this.bag.router.traverse('onFileAdd');
        }
      },
    });

    this.updateComplete.then(() => this._setupContentWrapperDropzone());

    this.subConfigValue('sourceList', (value: string) => {
      const list = stringToArray(value);
      this._sourceListAllowsLocal = list.includes(UploadSource.LOCAL);
      this._updateIsEnabled();
      this._updateVisibility();
    });

    this.subConfigValue('multiple', (val) => {
      this._isMultiple = Boolean(val);
      this._updateDropText();
    });
  }

  protected override controllerReleased(): void {
    this._destroyDropzone?.();
    this._destroyDropzone = null;
    this._destroyContentWrapperDropzone?.();
    this._destroyContentWrapperDropzone = null;
  }

  protected override subscriptionsFor(ctrl: UploaderController): Array<(listener: () => void) => () => void> {
    return [(l: () => void) => ctrl.locale.subscribe(l)];
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has('disabled')) {
      this._updateIsEnabled();
      this._updateVisibility();
    }

    if (changedProperties.has('text')) {
      this._updateDropText();
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
    const isMultiple = this.uploader.config.get('multiple');
    const multipleMax = this.uploader.config.get('multipleMax');
    const currentFilesCount = this.bag.uploadCollection.size;

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

  private _setupContentWrapperDropzone(): void {
    if (this._destroyContentWrapperDropzone) {
      return;
    }

    const contentWrapperEl = this._contentWrapperRef.value;
    if (!contentWrapperEl) {
      return;
    }

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
    this._destroyDropzone = null;
    this._destroyContentWrapperDropzone?.();
    this._destroyContentWrapperDropzone = null;
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
          <div
            ${ref(this._contentWrapperRef)}
            class="uc-content-wrapper"
            ?hidden=${!this._isVisible}
          >
            <div class="uc-icon-container" ?hidden=${!this.withIcon}>
              <uc-icon name="default"></uc-icon>
              <uc-icon name="arrow-down"></uc-icon>
            </div>
            <span class="uc-text">${this.l10n(this._dropTextKey)}</span>
          </div>`,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-drop-area': DropArea;
  }
}
