import { html } from '@symbiotejs/symbiote';
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

  constructor() {
    super();

    this.init$ = {
      ...this.init$,
      active: false,
      title: '',
      icon: '',
      isOriginal: false,
      iconSize: 20,
      'on.click': null,
    };
  }

  private _previewSrc(): string {
    const previewSize = parseInt(window.getComputedStyle(this).getPropertyValue('--l-base-min-width'), 10);
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
      const src = await this.proxyUrl(this._previewSrc());
      const previewEl = this.ref['preview-el'] as HTMLElement;
      const { promise, cancel } = preloadImage(src);
      this._cancelPreload = cancel;
      promise
        .catch((err) => {
          this.$['*networkProblems'] = true;
          console.error('Failed to load image', { error: err });
        })
        .finally(() => {
          previewEl.style.backgroundImage = `url(${src})`;
          previewEl.setAttribute('loaded', '');

          observer.unobserve(this);
        });
    } else {
      this._cancelPreload?.();
    }
  }

  override initCallback(): void {
    super.initCallback();

    this.$['on.click'] = (e: MouseEvent) => {
      if (!this.$.active) {
        const slider = this.$['*sliderEl'] as { setOperation: (op: string, filter: string) => void; apply: () => void };
        slider.setOperation(this._operation, this._filter);
        slider.apply();
      } else if (!this.$.isOriginal) {
        const slider = this.$['*sliderEl'] as { setOperation: (op: string, filter: string) => void };
        slider.setOperation(this._operation, this._filter);
        this.$['*showSlider'] = true;
      }

      this.telemetryManager.sendEventCloudImageEditor(e, this.$['*tabId'], {
        operation: parseFilterValue(this.$['*operationTooltip']),
      });

      this.$['*currentFilter'] = this._filter;
    };

    this.defineAccessor('filter', (filter: string) => {
      this._operation = 'filter';
      this._filter = filter;
      this.$.isOriginal = filter === FAKE_ORIGINAL_FILTER;
      this.$.icon = this.$.isOriginal ? 'original' : 'slider';

      this.bindL10n('title-prop', () =>
        this.l10n('a11y-cloud-editor-apply-filter', {
          name: filter.toLowerCase(),
        }),
      );
    });

    this._observer = new window.IntersectionObserver(this._observerCallback.bind(this), {
      threshold: [0, 1],
    });

    const originalUrl = this.$['*originalUrl'] as string;
    this._originalUrl = originalUrl;

    if (this.$.isOriginal) {
      const iconEl = this.ref['icon-el'] as HTMLElement;
      iconEl.classList.add('uc-original-icon');
    } else {
      this._observer.observe(this);
    }

    this.sub('*currentFilter', (currentFilter: string) => {
      this.$.active = !!(currentFilter && currentFilter === this._filter);
    });

    this.sub('isOriginal', (isOriginal: boolean) => {
      this.$.iconSize = isOriginal ? 40 : 20;
    });

    this.sub('active', (active: boolean) => {
      if (this.$.isOriginal) {
        return;
      }
      const iconEl = this.ref['icon-el'] as HTMLElement;
      iconEl.style.opacity = active ? '1' : '0';

      const previewEl = this.ref['preview-el'] as HTMLElement;
      if (active) {
        previewEl.style.opacity = '0';
      } else if (previewEl.style.backgroundImage) {
        previewEl.style.opacity = '1';
      }
    });

    this.sub('*networkProblems', async (networkProblems: boolean) => {
      if (!networkProblems) {
        const src = await this.proxyUrl(this._previewSrc());
        const previewEl = this.ref['preview-el'] as HTMLElement;
        if (previewEl.style.backgroundImage) {
          previewEl.style.backgroundImage = 'none';
          previewEl.style.backgroundImage = `url(${src})`;
        }
      }
    });
  }

  override destroyCallback(): void {
    super.destroyCallback();
    this._observer?.disconnect();
    this._cancelPreload?.();
  }
}

EditorFilterControl.template = html`
  <button type="button" role="option" l10n="@title:title-prop;@aria-label:title-prop">
    <div class="uc-preview" ref="preview-el"></div>
    <uc-icon ref="icon-el" bind="@name: icon; @size: iconSize;"></uc-icon>
  </button>
`;
