import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { when } from 'lit/directives/when.js';
import { LitBlock } from '../../../lit/LitBlock';
import {
  createCdnUrl,
  createCdnUrlModifiers,
  createOriginalUrl,
  extractOperations,
  extractUuid,
} from '../../../utils/cdn-utils';
import { serializeCsv } from '../../../utils/comma-separated';
import { debounce } from '../../../utils/debounce.js';
import { TRANSPARENT_PIXEL_SRC } from '../../../utils/transparentPixelSrc';
import type { EditorImageCropper } from './EditorImageCropper';
import type { EditorImageFader } from './EditorImageFader';
import { classNames } from './lib/classNames.js';
import { getClosestAspectRatio, parseCropPreset } from './lib/parseCropPreset.js';
import { parseTabs } from './lib/parseTabs.js';
import { operationsToTransformations, transformationsToOperations } from './lib/transformationUtils.js';
import { initState } from './state.js';
import svgIconsSprite from './svg-sprite';
import { ALL_TABS, TabId } from './toolbar-constants.js';
import type { ApplyResult, CropPresetList, ImageSize, Transformations } from './types';

type TabIdValue = (typeof TabId)[keyof typeof TabId];

const DEFAULT_TABS = serializeCsv([...ALL_TABS]);

export class CloudImageEditorBlock extends LitBlock {
  ctxOwner = true;
  static override styleAttrs = ['uc-cloud-image-editor'];

  @property({ attribute: false })
  entry: unknown = null;

  @property({ attribute: false })
  extension: string | null = null;

  @property({ type: Boolean, attribute: false })
  editorMode = false;

  @property({ type: String, attribute: false })
  modalCaption = '';

  @property({ type: Boolean, attribute: false })
  isImage = false;

  @property({ type: String, attribute: false })
  msg = '';

  @property({ type: String, attribute: false })
  src = TRANSPARENT_PIXEL_SRC;

  @property({ type: String, attribute: false })
  fileType = '';

  @property({ type: Boolean, attribute: false })
  showLoader = false;

  @property({ type: String, reflect: true })
  uuid: string | null = null;

  @property({ type: String, attribute: 'cdn-url', reflect: true })
  cdnUrl: string | null = null;

  @property({ type: String, attribute: 'crop-preset', reflect: true })
  cropPreset = '';

  @property({ type: String, reflect: true })
  tabs: string | null = DEFAULT_TABS;

  @property({ type: Boolean, attribute: false })
  presenceNetworkProblems = false;

  @property({ type: Boolean, attribute: false })
  presenceModalCaption = true;

  @property({ type: Boolean, attribute: false })
  presenceEditorToolbar = false;

  @property({ type: Boolean, attribute: false })
  presenceViewerToolbar = true;

  @state()
  private isInitialized = false;

  private pendingInitUpdate: Promise<void> | null = null;

  private readonly _debouncedShowLoader = debounce((show: boolean) => {
    this.showLoader = show;
  }, 300);

  private readonly imgRef = createRef<HTMLImageElement>();
  private readonly cropperRef = createRef<EditorImageCropper>();
  private readonly faderRef = createRef<EditorImageFader>();
  private readonly imgContainerRef = createRef<HTMLDivElement>();

  private readonly handleImageLoad = (): void => {
    this._debouncedShowLoader(false);

    if (this.src !== TRANSPARENT_PIXEL_SRC) {
      this.$['*networkProblems'] = false;
    }
  };

  private readonly handleImageError = (): void => {
    this._debouncedShowLoader(false);
    this.$['*networkProblems'] = true;
  };

  private readonly handleRetryNetwork = (): void => {
    const retry = this.$['*on.retryNetwork'] as (() => void) | undefined;
    retry?.();
  };

  private scheduleInitialization(): void {
    if (this.isInitialized || this.pendingInitUpdate) {
      return;
    }
    this.pendingInitUpdate = this.updateComplete.then(() => {
      this.pendingInitUpdate = null;
      this.isInitialized = true;
    });
  }

  override init$ = {
    ...this.init$,
    ...initState(this),
  } as ReturnType<typeof initState>;

  override initCallback(): void {
    super.initCallback();

    this.syncTabListFromProp();
    this.syncCropPresetState();
  }

  private assignSharedElements(): void {
    const faderEl = this.faderRef.value;
    if (faderEl) {
      this.$['*faderEl'] = faderEl;
    }

    const cropperEl = this.cropperRef.value;
    if (cropperEl) {
      this.$['*cropperEl'] = cropperEl;
    }

    const imgContainerEl = this.imgContainerRef.value;
    if (imgContainerEl) {
      this.$['*imgContainerEl'] = imgContainerEl;
    }

    const imgEl = this.imgRef.value;
    if (imgEl) {
      this.$['*imgEl'] = imgEl;
    }
  }

  private attachImageListeners(): void {
    const imgEl = this.imgRef.value;
    if (!imgEl) {
      return;
    }
    imgEl.addEventListener('load', this.handleImageLoad);
    imgEl.addEventListener('error', this.handleImageError);
  }

  private detachImageListeners(): void {
    const imgEl = this.imgRef.value;
    if (!imgEl) {
      return;
    }
    imgEl.removeEventListener('load', this.handleImageLoad);
    imgEl.removeEventListener('error', this.handleImageError);
  }

  private get imageClassName(): string {
    const tabId = this.$['*tabId'] as TabIdValue;
    return classNames('uc-image', {
      'uc-image_hidden_to_cropper': tabId === TabId.CROP,
      'uc-image_hidden_effects': tabId !== TabId.CROP,
    });
  }

  /**
   * To proper work, we need non-zero size the element. So, we'll wait for it.
   */
  private _waitForSize(): Promise<void> {
    const TIMEOUT = 3000;
    return new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error('[cloud-image-editor] timeout waiting for non-zero container size'));
      }, TIMEOUT);
      const resizeObserver = new ResizeObserver((entries) => {
        const [element] = entries;
        if (!element) {
          return;
        }
        if (element.contentRect.width > 0 && element.contentRect.height > 0) {
          window.clearTimeout(timeoutId);
          resizeObserver.disconnect();
          window.setTimeout(() => resolve(), 0);
        }
      });
      resizeObserver.observe(this);
    });
  }

  override firstUpdated(_changedProperties: Map<PropertyKey, unknown>): void {
    super.firstUpdated(_changedProperties);
    this.assignSharedElements();
    this.attachImageListeners();
    void this.initEditor();

    const hasInitialSource = Boolean(this.uuid || this.cdnUrl);
    const alreadyRequested = _changedProperties.has('uuid') || _changedProperties.has('cdnUrl');
    if (hasInitialSource && !alreadyRequested) {
      void this.updateImage();
    }
  }

  override disconnectedCallback(): void {
    this.detachImageListeners();
    super.disconnectedCallback();
  }

  override render() {
    const fileType = this.fileType ?? '';
    const message = this.msg ?? '';
    const src = this.src || TRANSPARENT_PIXEL_SRC;
    const showLoader = this.showLoader;
    const showNetworkProblems = this.presenceNetworkProblems;

    return html`
      ${unsafeSVG(svgIconsSprite)}
      <div class="uc-wrapper uc-wrapper_desktop">
        <uc-presence-toggle class="uc-network_problems_splash" .visible=${showNetworkProblems}>
          <div class="uc-network_problems_content">
            <div class="uc-network_problems_icon">
              <uc-icon name="sad"></uc-icon>
            </div>
            <div class="uc-network_problems_text">Network error</div>
          </div>
          <div class="uc-network_problems_footer">
            <uc-btn-ui theme="primary" text="Retry" @click=${this.handleRetryNetwork}></uc-btn-ui>
          </div>
        </uc-presence-toggle>
        <div class="uc-viewport">
          <div class="uc-file_type_outer">
            <div class="uc-file_type">${fileType}</div>
          </div>
          <div class="uc-image_container" ${ref(this.imgContainerRef)}>
            <img src=${src} class=${this.imageClassName} ${ref(this.imgRef)} />
            ${when(this.isInitialized, () => html`<uc-editor-image-cropper ${ref(this.cropperRef)}></uc-editor-image-cropper>`)}
            <uc-editor-image-fader ${ref(this.faderRef)}></uc-editor-image-fader>
          </div>
          <div class="uc-info_pan">${message}</div>
        </div>
        <div class="uc-toolbar">
          <uc-line-loader-ui .active=${showLoader}></uc-line-loader-ui>
          <div class="uc-toolbar_content uc-toolbar_content__editor">
            ${when(this.isInitialized, () => html`<uc-editor-toolbar></uc-editor-toolbar>`)}
          </div>
        </div>
      </div>
    `;
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('uuid') && this.uuid) {
      void this.updateImage();
    }

    if (changedProperties.has('cdnUrl') && this.cdnUrl) {
      void this.updateImage();
    }

    if (changedProperties.has('tabs')) {
      this.syncTabListFromProp();
    }

    if (changedProperties.has('cropPreset') || changedProperties.has('cdnUrl')) {
      this.syncCropPresetState();
    }
  }

  private syncTabListFromProp(): void {
    const tabsValue = this.tabs || DEFAULT_TABS;
    this.$['*tabList'] = parseTabs(tabsValue);
  }

  private syncCropPresetState(): void {
    const list = parseCropPreset(this.cropPreset ?? '') as CropPresetList;
    let closest: CropPresetList[number] | null = null;

    if (this.cdnUrl) {
      const operations = extractOperations(this.cdnUrl);
      const transformations = operationsToTransformations(operations) as Transformations;

      if (Array.isArray(transformations?.crop?.dimensions)) {
        const [w, h] = transformations.crop.dimensions;
        closest = getClosestAspectRatio(w, h, list, 0.1);
      }
    }

    this.$['*cropPresetList'] = list;
    this.$['*currentAspectRatio'] = closest ?? list?.[0] ?? null;
  }

  async updateImage(): Promise<void> {
    if (!this.isConnected) {
      return;
    }
    await this._waitForSize();

    if (this.cdnUrl) {
      const cdnUrlValue = this.cdnUrl as string;
      const uuid = extractUuid(cdnUrlValue);
      const originalUrl = createOriginalUrl(cdnUrlValue, uuid);
      if (originalUrl === this.$['*originalUrl']) {
        return;
      }
      this.$['*originalUrl'] = originalUrl;
      const operations = extractOperations(cdnUrlValue);
      const transformations = operationsToTransformations(operations) as Transformations;
      this.$['*editorTransformations'] = transformations;
    } else if (this.uuid) {
      const originalUrl = createOriginalUrl(this.cfg.cdnCname, this.uuid as string);
      if (originalUrl === this.$['*originalUrl']) {
        return;
      }
      this.$['*originalUrl'] = originalUrl;
      this.$['*editorTransformations'] = {};
    } else {
      throw new Error('No UUID nor CDN URL provided');
    }

    if (this.$['*tabId'] === TabId.CROP) {
      (this.$['*cropperEl'] as EditorImageCropper)?.deactivate({ reset: true });
    } else {
      (this.$['*faderEl'] as EditorImageFader)?.deactivate();
    }

    try {
      const originalUrlValue = this.$['*originalUrl'] as string;
      const cdnUrl = await this.proxyUrl(createCdnUrl(originalUrlValue, createCdnUrlModifiers('json')));
      const json = (await fetch(cdnUrl).then((response) => response.json())) as { width: number; height: number };

      const { width, height } = json;
      this.$['*imageSize'] = { width, height };

      if (this.$['*tabId'] === TabId.CROP) {
        (this.$['*cropperEl'] as EditorImageCropper)?.activate(this.$['*imageSize'] as ImageSize);
      } else {
        (this.$['*faderEl'] as EditorImageFader)?.activate({ url: originalUrlValue });
      }
    } catch (err) {
      if (err) {
        this.telemetryManager.sendEventError(err, 'cloud editor image. Failed to load image info');
        console.error('Failed to load image info', err);
      }
    }

    this.scheduleInitialization();
  }

  async initEditor(): Promise<void> {
    try {
      await this._waitForSize();
    } catch (err) {
      if (this.isConnected) {
        // @ts-expect-error TODO: fix this
        console.error(err.message);
      }
      return;
    }

    this.classList.add('uc-editor_ON');

    this.sub('*networkProblems', (networkProblems) => {
      const hasIssues = Boolean(networkProblems);
      this.presenceNetworkProblems = hasIssues;
      this.presenceModalCaption = !hasIssues;
    });

    this.sub(
      '*editorTransformations',
      (transformations: Transformations) => {
        if (Object.keys(transformations).length === 0) {
          return;
        }
        const originalUrl = this.$['*originalUrl'] as string;
        const cdnUrlModifiers = createCdnUrlModifiers(transformationsToOperations(transformations), 'preview');
        const cdnUrl = createCdnUrl(originalUrl, cdnUrlModifiers);

        const eventData: ApplyResult = {
          originalUrl,
          cdnUrlModifiers,
          cdnUrl,
          transformations,
        };
        this.dispatchEvent(
          new CustomEvent<ApplyResult>('change', {
            detail: eventData,
            bubbles: true,
            composed: true,
          }),
        );
      },
      false,
    );
  }
}
