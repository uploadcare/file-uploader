import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { createCdnUrl, createCdnUrlModifiers } from '../../../utils/cdn-utils.js';
import { preloadImage } from '../../../utils/preloadImage.js';
import { EditorButtonControl } from './EditorButtonControl.js';
import { FAKE_ORIGINAL_FILTER } from './EditorSlider.js';
import { COMMON_OPERATIONS, transformationsToOperations } from './lib/transformationUtils.js';
import type { Transformations } from './types';
import { parseFilterValue } from './utils/parseFilterValue.js';

export class EditorFilterControl extends EditorButtonControl {
  private _operation = '';
  private _filter = '';
  private _originalUrl = '';
  private _observer?: IntersectionObserver;
  private _cancelPreload?: () => void;
  private _lastPreviewRequestId = 0;
  private previewVisibilityCheckRaf?: number;
  private previewVisibilityCheckTimeout?: number;

  @state()
  private previewImage: string | null = null;

  @state()
  private previewLoaded = false;

  // This is public because it's used in the updated lifecycle to assign to the shared state.
  @state()
  public isOriginal = false;

  @state()
  private iconSize = 20;

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
    this.iconSize = this.isOriginal ? 40 : 20;
    this.requestUpdate('filter', previousValue);
    this.updateFilterLabels(nextFilter);
  }

  public override onClick(e: MouseEvent) {
    if (!this.active) {
      const slider = this.$['*sliderEl'] as { setOperation: (op: string, filter: string) => void; apply: () => void };
      slider.setOperation(this._operation, this._filter);
      slider.apply();
    } else if (!this.isOriginal) {
      const slider = this.$['*sliderEl'] as { setOperation: (op: string, filter: string) => void };
      slider.setOperation(this._operation, this._filter);
      this.$['*showSlider'] = true;
    }

    this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
      operation: parseFilterValue(this.$['*operationTooltip']),
    });

    this.$['*currentFilter'] = this._filter;
  }

  private _previewSrc(): string {
    const cssSize = parseInt(window.getComputedStyle(this).getPropertyValue('--l-base-min-width'), 10);
    const previewSize = Number.isFinite(cssSize) && cssSize > 0 ? cssSize : this.iconSize || 32;
    const dpr = window.devicePixelRatio;
    const size = Math.ceil(dpr * previewSize);
    const quality = dpr >= 2 ? 'lightest' : 'normal';
    const filterValue = 100;

    const transformations = { ...(this.$['*editorTransformations'] as Transformations) };
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
      ),
    );
  }

  private async _observerCallback(entries: IntersectionObserverEntry[], observer: IntersectionObserver): Promise<void> {
    const intersectionEntry = entries[0];
    if (intersectionEntry?.isIntersecting) {
      await this.loadPreview(observer);
    } else {
      this._cancelPreload?.();
    }
  }

  public override initCallback(): void {
    super.initCallback();

    if ('IntersectionObserver' in window) {
      this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), {
        threshold: [0, 1],
      });
    }

    const originalUrl = this.$['*originalUrl'] as string;
    this._originalUrl = originalUrl ?? '';

    this.sub('*originalUrl', (nextUrl: string) => {
      this._originalUrl = nextUrl ?? '';
      if (!this.isOriginal && this._originalUrl && this.isConnected && !this.previewImage) {
        this._observer?.observe(this);
        this.schedulePreviewVisibilityCheck();
      }
    });

    if (!this.isOriginal) {
      this._observer?.observe(this);
      this.schedulePreviewVisibilityCheck();
    }

    if (this._filter) {
      this.updateFilterLabels(this._filter);
    }

    this.sub('*currentFilter', (currentFilter: string) => {
      this.active = !!(currentFilter && currentFilter === this._filter);
    });

    this.sub('*networkProblems', async (networkProblems: boolean) => {
      if (networkProblems) {
        return;
      }
      if (this.previewImage) {
        await this.loadPreview();
      } else {
        this.schedulePreviewVisibilityCheck();
      }
    });
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._cancelPreload?.();
    this.clearPreviewVisibilityChecks();
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('isOriginal')) {
      if (this.isOriginal) {
        this._observer?.unobserve(this);
      } else {
        this._observer?.observe(this);
        this.schedulePreviewVisibilityCheck();
      }
    }
  }

  private updateFilterLabels(filterName: string): void {
    if (!filterName) {
      this.titleProp = '';
      return;
    }

    const label = this.l10n('a11y-cloud-editor-apply-filter', {
      name: filterName.toLowerCase(),
    });
    this.titleProp = label;
  }

  private async loadPreview(observer?: IntersectionObserver): Promise<void> {
    if (!this.isConnected) {
      observer?.unobserve(this);
      this._cancelPreload?.();
      this._cancelPreload = undefined;
      return;
    }

    if (!this._originalUrl) {
      if (!this.previewVisibilityCheckTimeout && !this.previewVisibilityCheckRaf) {
        this.schedulePreviewVisibilityCheck();
      }
      return;
    }
    const requestId = ++this._lastPreviewRequestId;
    let src = '';
    try {
      src = await this.proxyUrl(this._previewSrc());
    } catch (err) {
      this.$['*networkProblems'] = true;
      console.error('Failed to resolve preview URL', { error: err });
      return;
    }

    this.previewLoaded = false;
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
      this.previewImage = src;
      this.previewLoaded = true;
      this.clearPreviewVisibilityChecks();
      (observer ?? this._observer)?.unobserve(this);
    } catch (err) {
      this.$['*networkProblems'] = true;
      console.error('Failed to load image', { error: err });
      this.schedulePreviewVisibilityCheck();
    } finally {
      if (this._lastPreviewRequestId === requestId) {
        this._cancelPreload = undefined;
      }
    }
  }

  private schedulePreviewVisibilityCheck(): void {
    if (!this.isConnected || this.previewImage || this.previewLoaded || this.isOriginal) {
      this.clearPreviewVisibilityChecks();
      return;
    }
    if (this.previewVisibilityCheckRaf) {
      cancelAnimationFrame(this.previewVisibilityCheckRaf);
    }
    this.previewVisibilityCheckRaf = requestAnimationFrame(() => {
      this.previewVisibilityCheckRaf = undefined;
      if (!this.isConnected || this.previewImage || this.previewLoaded || this.isOriginal) {
        this.clearPreviewVisibilityChecks();
        return;
      }
      const rect = this.getBoundingClientRect();
      const hasSize = rect.width > 0 && rect.height > 0;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const isVisible =
        hasSize && rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
      if (isVisible) {
        void this.loadPreview();
        return;
      }
      this.previewVisibilityCheckTimeout = window.setTimeout(() => {
        this.previewVisibilityCheckTimeout = undefined;
        this.schedulePreviewVisibilityCheck();
      }, 500);
    });
  }

  private clearPreviewVisibilityChecks(): void {
    if (this.previewVisibilityCheckRaf) {
      cancelAnimationFrame(this.previewVisibilityCheckRaf);
      this.previewVisibilityCheckRaf = undefined;
    }
    if (this.previewVisibilityCheckTimeout) {
      window.clearTimeout(this.previewVisibilityCheckTimeout);
      this.previewVisibilityCheckTimeout = undefined;
    }
  }

  private get shouldShowPreview(): boolean {
    return Boolean(this.previewLoaded && !this.active && !this.isOriginal);
  }

  public override render() {
    const clickHandler = this.onClick;
    const previewStyles: Record<string, string> = {
      opacity: this.shouldShowPreview ? '1' : '0',
    };
    if (this.previewImage) {
      previewStyles.backgroundImage = `url(${this.previewImage})`;
    }

    const iconStyles = {
      opacity: this.shouldShowPreview ? '0' : '1',
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
        <div class="uc-preview" ?loaded=${this.previewLoaded} style=${styleMap(previewStyles)}></div>
        <uc-icon
          class=${classMap({ 'uc-original-icon': this.isOriginal })}
          name=${this.icon}
          style=${styleMap(iconStyles)}
        ></uc-icon>
      </button>
    `;
  }
}
