import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../../../env';
import { createCdnUrl, createCdnUrlModifiers } from '../../../utils/cdn-utils.js';
import { preloadImage } from '../../../utils/preloadImage.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import { FAKE_ORIGINAL_FILTER } from './EditorSlider.js';
import { COMMON_OPERATIONS, transformationsToOperations } from './lib/transformationUtils.js';
import type { Transformations } from './types';

import './EditorIcon';

/**
 * Bubbles up to `EditorToolbar`, which owns the toolbar-local `currentFilter`/
 * `showSlider` state and the slider ref. `active`/`isOriginal` are threaded
 * through so the toolbar can reproduce the old "apply immediately vs. open
 * slider to adjust" branch without needing them back as props.
 */
export class FilterSelectEvent extends Event {
  public static readonly eventName = 'uc-internal:filter-select';
  public constructor(
    public readonly operation: 'filter',
    public readonly filter: string,
    public readonly active: boolean,
    public readonly isOriginal: boolean,
    public readonly originalEvent: MouseEvent,
  ) {
    super(FilterSelectEvent.eventName, { bubbles: true, composed: true });
  }
}

declare global {
  interface HTMLElementEventMap {
    [FilterSelectEvent.eventName]: FilterSelectEvent;
  }
}

export class EditorFilterControl extends EditorButtonControl {
  private _operation = '';
  private _filter = '';
  private _originalUrl = '';
  private _observer?: IntersectionObserver;
  private _cancelPreload?: () => void;
  private _lastPreviewRequestId = 0;
  private _previewVisibilityCheckRaf?: number;
  private _previewVisibilityCheckTimeout?: number;

  @state()
  private _previewImage: string | null = null;

  @state()
  private _previewLoaded = false;

  // This is public because it's used in the updated lifecycle to assign to the shared state.
  @state()
  public isOriginal = false;

  @state()
  private _iconSize = 20;

  /**
   * Toolbar-local `currentFilter`, received as a reactive prop (replaces the
   * old shared-ctx `this.sub('*currentFilter', ...)`) — `EditorToolbar` is
   * the sole owner of this key now.
   */
  @property({ attribute: false })
  public currentFilter = FAKE_ORIGINAL_FILTER;

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    if (changedProperties.has('currentFilter') || changedProperties.has('filter')) {
      this.active = !!(this.currentFilter && this.currentFilter === this._filter);
    }
  }

  @property({ type: String })
  public get filter(): string {
    return this._filter;
  }

  public set filter(value: string) {
    const nextFilter = value ?? '';
    if (this._filter === nextFilter) {
      return;
    }
    const previousValue = this._filter;
    this._filter = nextFilter;
    this._operation = 'filter';
    this.isOriginal = nextFilter === FAKE_ORIGINAL_FILTER;
    this.icon = this.isOriginal ? 'original' : 'slider';
    this._iconSize = this.isOriginal ? 40 : 20;
    this.requestUpdate('filter', previousValue);
    if (this.isConnected) {
      this._updateFilterLabels(nextFilter);
    }
  }

  public override onClick(e: MouseEvent) {
    this.dispatchEvent(new FilterSelectEvent('filter', this._filter, this.active, this.isOriginal, e));
  }

  private _previewSrc(): string {
    const cssSize = parseInt(window.getComputedStyle(this).getPropertyValue('--l-base-min-width'), 10);
    const previewSize = Number.isFinite(cssSize) && cssSize > 0 ? cssSize : this._iconSize || 32;
    const dpr = window.devicePixelRatio;
    const size = Math.ceil(dpr * previewSize);
    const quality = dpr >= 2 ? 'lightest' : 'normal';
    const filterValue = 100;

    const transformations: Transformations = { ...this.editorController.get('*editorTransformations') };
    // @ts-expect-error FIXME: fix this
    transformations[this._operation] =
      this._filter !== FAKE_ORIGINAL_FILTER
        ? {
            name: this._filter,
            amount: filterValue,
          }
        : undefined;
    return createCdnUrl(
      this._originalUrl,
      createCdnUrlModifiers(
        COMMON_OPERATIONS,
        transformationsToOperations(transformations),
        `quality/${quality}`,
        `scale_crop/${size}x${size}/center`,
        `@clib/${PACKAGE_NAME}/${PACKAGE_VERSION}/uc-cloud-image-editor/`,
      ),
    );
  }

  private async _observerCallback(entries: IntersectionObserverEntry[], observer: IntersectionObserver): Promise<void> {
    const intersectionEntry = entries[0];
    if (intersectionEntry?.isIntersecting) {
      await this._loadPreview(observer);
    } else {
      this._cancelPreload?.();
    }
  }

  public constructor() {
    super();

    // Cross-cutting reactions — fine to wire once in the constructor
    // (`onEditorAttach`/`subEditorKey` re-run on every editor-controller
    // (re)attach); the `isConnected`-gated one-time setup below (observer
    // creation, initial observe/schedule, label init) needs the `filter`
    // property (set via template binding) already applied, so it stays in
    // `connectedCallback` — same timing the old `initCallback` relied on.
    this.subEditorKey('*originalUrl', (nextUrl: string | null) => {
      this._originalUrl = nextUrl ?? '';
      if (!this.isOriginal && this._originalUrl && this.isConnected && !this._previewImage) {
        this._observer?.observe(this);
        this._schedulePreviewVisibilityCheck();
      }
    });

    this.subEditorKey('*networkProblems', async (networkProblems: boolean) => {
      if (networkProblems) {
        return;
      }
      if (this._previewImage) {
        await this._loadPreview();
      } else {
        this._schedulePreviewVisibilityCheck();
      }
    });

    // The `filter` prop is typically set (by `EditorToolbar`'s template
    // binding) before the editor context finishes resolving, so the one-shot
    // `_updateFilterLabels` call from the property setter/`connectedCallback`
    // can run with no controller yet (`l10nSafe` falling back to the raw
    // key). Redo it once the controller actually attaches so the real l10n
    // label lands.
    this.onEditorAttach(() => {
      if (this._filter) {
        this._updateFilterLabels(this._filter);
      }
    });
  }

  public override connectedCallback(): void {
    super.connectedCallback();

    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), {
      threshold: [0, 1],
    });

    if (!this.isOriginal) {
      this._observer.observe(this);
      this._schedulePreviewVisibilityCheck();
    }

    if (this._filter) {
      this._updateFilterLabels(this._filter);
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._cancelPreload?.();
    this._clearPreviewVisibilityChecks();
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('isOriginal')) {
      if (this.isOriginal) {
        this._observer?.unobserve(this);
      } else {
        this._observer?.observe(this);
        this._schedulePreviewVisibilityCheck();
      }
    }
  }

  private _updateFilterLabels(filterName: string): void {
    if (!filterName) {
      this.titleProp = '';
      return;
    }

    const label = this.l10nSafe('a11y-cloud-editor-apply-filter', {
      name: filterName.toLowerCase(),
    });
    this.titleProp = label;
  }

  private async _loadPreview(observer?: IntersectionObserver): Promise<void> {
    if (!this.isConnected) {
      observer?.unobserve(this);
      this._cancelPreload?.();
      this._cancelPreload = undefined;
      return;
    }

    if (!this._originalUrl) {
      if (!this._previewVisibilityCheckTimeout && !this._previewVisibilityCheckRaf) {
        this._schedulePreviewVisibilityCheck();
      }
      return;
    }
    const requestId = ++this._lastPreviewRequestId;
    let src = '';
    try {
      src = await this.editorController.proxyUrl(this._previewSrc());
    } catch (err) {
      this.editorController.set('*networkProblems', true);
      console.error('Failed to resolve preview URL', { error: err });
      return;
    }

    this._previewLoaded = false;
    this._cancelPreload?.();
    const { promise, cancel } = preloadImage(src);
    this._cancelPreload = () => {
      cancel();
      if (this._lastPreviewRequestId === requestId) {
        this._cancelPreload = undefined;
      }
    };

    try {
      await promise;
      if (this._lastPreviewRequestId !== requestId || !this.isConnected) {
        return;
      }
      this._previewImage = src;
      this._previewLoaded = true;
      this._clearPreviewVisibilityChecks();
      (observer ?? this._observer)?.unobserve(this);
    } catch (err) {
      this.editorController.set('*networkProblems', true);
      console.error('Failed to load image', { error: err });
      this._schedulePreviewVisibilityCheck();
    } finally {
      if (this._lastPreviewRequestId === requestId) {
        this._cancelPreload = undefined;
      }
    }
  }

  private _schedulePreviewVisibilityCheck(): void {
    if (
      !this.isConnected ||
      this._previewImage ||
      this._previewLoaded ||
      this.isOriginal ||
      this.editorController.get('*networkProblems')
    ) {
      this._clearPreviewVisibilityChecks();
      return;
    }
    if (this._previewVisibilityCheckRaf) {
      cancelAnimationFrame(this._previewVisibilityCheckRaf);
    }
    this._previewVisibilityCheckRaf = requestAnimationFrame(() => {
      this._previewVisibilityCheckRaf = undefined;
      if (!this.isConnected || this._previewImage || this._previewLoaded || this.isOriginal) {
        this._clearPreviewVisibilityChecks();
        return;
      }
      const rect = this.getBoundingClientRect();
      const hasSize = rect.width > 0 && rect.height > 0;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const isVisible =
        hasSize && rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
      if (isVisible) {
        void this._loadPreview();
        return;
      }
      this._previewVisibilityCheckTimeout = window.setTimeout(() => {
        this._previewVisibilityCheckTimeout = undefined;
        this._schedulePreviewVisibilityCheck();
      }, 500);
    });
  }

  private _clearPreviewVisibilityChecks(): void {
    if (this._previewVisibilityCheckRaf) {
      cancelAnimationFrame(this._previewVisibilityCheckRaf);
      this._previewVisibilityCheckRaf = undefined;
    }
    if (this._previewVisibilityCheckTimeout) {
      window.clearTimeout(this._previewVisibilityCheckTimeout);
      this._previewVisibilityCheckTimeout = undefined;
    }
  }

  private get _shouldShowPreview(): boolean {
    return Boolean(this._previewLoaded && !this.active && !this.isOriginal);
  }

  public override render() {
    const clickHandler = this.onClick;
    const previewStyles: Record<string, string> = {
      opacity: this._shouldShowPreview ? '1' : '0',
    };
    if (this._previewImage) {
      previewStyles.backgroundImage = `url(${this._previewImage})`;
    }

    const iconStyles = {
      opacity: this.active || this.isOriginal ? '1' : '0',
    };

    return html`
      <button
        role="option"
        type="button"
        class=${classMap(this.buttonClasses)}
        aria-label=${ifDefined(this.titleProp)}
        title=${ifDefined(this.titleProp)}
        @click=${clickHandler}
      >
        <div class="uc-preview" ?data-loaded=${this._previewLoaded} style=${styleMap(previewStyles)}></div>
        <uc-editor-icon
          class=${classMap({ 'uc-original-icon': this.isOriginal })}
          name=${this.icon}
          style=${styleMap(iconStyles)}
        ></uc-editor-icon>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-filter-control': EditorFilterControl;
  }
}
