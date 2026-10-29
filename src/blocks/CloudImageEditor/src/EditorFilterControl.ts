import { Signal } from '@lit-labs/signals';
import { modifiers } from '@uploadcare/cdn-url';
import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { isAbortError } from '../../../abstract/di/Lifetime';
import { subscription, type Unsubscribe } from '../../../lit/subscription';
import { operationsFromModifiers } from '../../../utils/cdn/operations';
import { preloadImage } from '../../../utils/preloadImage.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import { FAKE_ORIGINAL_FILTER, type SliderFilter } from './EditorSlider.js';
import { editorPreviewUrl } from './lib/editorUrls';
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
    public readonly filter: SliderFilter | '',
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
  private _filter: SliderFilter | '' = '';
  private _originalUrl = '';
  private _observer?: IntersectionObserver;
  private _cancelPreload?: () => void;
  private _lastPreviewRequestId = 0;
  private _previewVisibilityCheckRaf?: number;

  @state()
  private _previewImage: string | null = null;

  @state()
  private _previewLoaded = false;

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
  public currentFilter: SliderFilter | '' = FAKE_ORIGINAL_FILTER;

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    if (changedProperties.has('currentFilter') || changedProperties.has('filter')) {
      this.active = !!(this.currentFilter && this.currentFilter === this._filter);
    }
  }

  @property({ type: String })
  public get filter(): SliderFilter | '' {
    return this._filter;
  }

  public set filter(value: SliderFilter | '') {
    const nextFilter = value ?? '';
    if (this._filter === nextFilter) {
      return;
    }
    const previousValue = this._filter;
    this._filter = nextFilter;
    this.isOriginal = nextFilter === FAKE_ORIGINAL_FILTER;
    this.icon = this.isOriginal ? 'original' : 'slider';
    this._iconSize = this.isOriginal ? 40 : 20;
    this.requestUpdate('filter', previousValue);
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

    const transformations: Transformations = {
      ...this.editorController.editorTransformations,
      filter:
        this._filter && this._filter !== FAKE_ORIGINAL_FILTER ? { name: this._filter, amount: filterValue } : undefined,
    };
    return editorPreviewUrl({
      originalUrl: this._originalUrl,
      transformations,
      sourceOperations: this.editorController.sourceOperations,
      quality,
      sizeOperations: operationsFromModifiers(modifiers(`scale_crop/${size}x${size}/center`)),
    });
  }

  private _observerCallback(entries: IntersectionObserverEntry[], observer: IntersectionObserver): void {
    const intersectionEntry = entries[0];
    if (intersectionEntry?.isIntersecting) {
      this.runTask(() => this._loadPreview(observer));
    } else {
      this._cancelPreload?.();
    }
  }

  // Cross-cutting reactions, re-wired on every editor-controller (re)attach;
  // the `isConnected`-gated one-time setup (observer creation, initial
  // observe/schedule, label init) needs the `filter` property (set via
  // template binding) already applied, so it stays in `connectedCallback` —
  // same timing the old `initCallback` relied on.
  /** @internal */
  @subscription()
  protected _watchState(): Unsubscribe[] {
    const controller = this.editorController;
    return [
      controller.observe(
        'originalUrl',
        (nextUrl) => {
          this._originalUrl = nextUrl ?? '';
          if (!this.isOriginal && this._originalUrl && this.isConnected && !this._previewImage) {
            this._observer?.observe(this);
            this._schedulePreviewVisibilityCheck();
          }
        },
        { immediate: true },
      ),
      controller.observe(
        'networkProblems',
        (networkProblems) => {
          if (networkProblems) {
            return;
          }
          if (this._previewImage) {
            this.runTask(() => this._loadPreview());
          } else {
            this._schedulePreviewVisibilityCheck();
          }
        },
        { immediate: true },
      ),
    ];
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
        // Untracked: the check's controller reads are no state this control renders.
        Signal.subtle.untrack(() => this._schedulePreviewVisibilityCheck());
      }
    }
  }

  protected override updateLabels(): void {
    this.buttonLabel = this._filter
      ? this.l10nSafe('a11y-cloud-editor-apply-filter', { name: this._filter.toLowerCase() })
      : '';
  }

  private async _loadPreview(observer?: IntersectionObserver): Promise<void> {
    // An observer entry queued before disconnect can still be delivered after it; `disconnectedCallback` has already
    // disconnected the observer and cancelled the preload.
    if (this.adoptionSignal.aborted) {
      return;
    }

    // The `originalUrl` subscription checks again once the image is known.
    if (!this._originalUrl) {
      return;
    }
    const requestId = ++this._lastPreviewRequestId;
    let src = '';
    try {
      src = await this.whileAdopted(this.editorController.proxyUrl(this._previewSrc()));
    } catch (err) {
      if (isAbortError(err)) throw err;
      this.editorController.networkProblems = true;
      this._log.error('Failed to resolve preview URL', { error: err });
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
      await this.whileAdopted(promise);
      if (this._lastPreviewRequestId !== requestId) {
        return;
      }
      this._previewImage = src;
      this._previewLoaded = true;
      this._clearPreviewVisibilityChecks();
      (observer ?? this._observer)?.unobserve(this);
    } catch (err) {
      if (isAbortError(err)) throw err;
      this.editorController.networkProblems = true;
      this._log.error('Failed to load image', { error: err });
      this._schedulePreviewVisibilityCheck();
    } finally {
      if (this._lastPreviewRequestId === requestId) {
        this._cancelPreload = undefined;
      }
    }
  }

  private _schedulePreviewVisibilityCheck(): void {
    if (
      this.adoptionSignal.aborted ||
      this._previewImage ||
      this._previewLoaded ||
      this.isOriginal ||
      this.editorController.networkProblems
    ) {
      this._clearPreviewVisibilityChecks();
      return;
    }
    if (this._previewVisibilityCheckRaf) {
      cancelAnimationFrame(this._previewVisibilityCheckRaf);
    }
    this._previewVisibilityCheckRaf = requestAnimationFrame(() => {
      this._previewVisibilityCheckRaf = undefined;
      // No adoption check: `disconnectedCallback` cancels this frame.
      if (this._previewImage || this._previewLoaded || this.isOriginal) {
        this._clearPreviewVisibilityChecks();
        return;
      }
      const rect = this.getBoundingClientRect();
      const hasSize = rect.width > 0 && rect.height > 0;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const isVisible =
        hasSize && rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
      // Out of view, the IntersectionObserver loads the preview when it scrolls in.
      if (isVisible) {
        this.runTask(() => this._loadPreview());
      }
    });
  }

  private _clearPreviewVisibilityChecks(): void {
    if (this._previewVisibilityCheckRaf) {
      cancelAnimationFrame(this._previewVisibilityCheckRaf);
      this._previewVisibilityCheckRaf = undefined;
    }
  }

  private get _shouldShowPreview(): boolean {
    return Boolean(this._previewLoaded && !this.active && !this.isOriginal);
  }

  protected override renderContent(): TemplateResult {
    // Prefixed like `ChildBlock` prefixes its inner test ids; editor blocks aren't `ChildBlock`s.
    const previewTestId = this.editorControllerOrNull?.getConfig('testMode')
      ? `${this.tagName.toLowerCase()}--preview`
      : undefined;
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
      <div
        class="uc-preview"
        data-testid=${ifDefined(previewTestId)}
        ?data-loaded=${this._previewLoaded}
        style=${styleMap(previewStyles)}
      ></div>
      <uc-editor-icon
        class=${classMap({ 'uc-original-icon': this.isOriginal })}
        name=${this.icon}
        style=${styleMap(iconStyles)}
      ></uc-editor-icon>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-editor-filter-control': EditorFilterControl;
  }
}
