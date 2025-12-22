import { ContextProvider } from '@lit/context';
import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { when } from 'lit/directives/when.js';
import { PubSub } from '../../../lit/PubSubCompat';
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
import { UID } from '../../../utils/UID';
import { CloudImageEditorElement, cloudImageEditorContext } from './context';
import type { EditorImageCropper } from './EditorImageCropper';
import type { EditorImageFader } from './EditorImageFader';
import { classNames } from './lib/classNames.js';
import { getClosestAspectRatio, parseCropPreset } from './lib/parseCropPreset.js';
import { parseTabs } from './lib/parseTabs.js';
import { operationsToTransformations, transformationsToOperations } from './lib/transformationUtils.js';
import { type CloudImageEditorState, createCloudImageEditorState } from './state.js';
import svgIconsSprite from './svg-sprite';
import { ALL_TABS, TabId } from './toolbar-constants.js';
import type { ApplyResult, CropPresetList, ImageSize, Transformations } from './types';

type TabIdValue = (typeof TabId)[keyof typeof TabId];

const DEFAULT_TABS = serializeCsv([...ALL_TABS]);

export class CloudImageEditorBlock extends CloudImageEditorElement {
  public declare attributesMeta: ({ uuid: string } | { 'cdn-url': string }) &
    Partial<{ tabs: string; 'crop-preset': string }> & {
      'ctx-name': string;
    };

  public override ctxOwner = true;
  public static override styleAttrs = ['uc-cloud-image-editor'];

  @state()
  private _statusMessage = '';

  @state()
  private _imageSrc = TRANSPARENT_PIXEL_SRC;

  @state()
  private _fileType = '';

  @state()
  private _showLoader = false;

  @property({ type: String, reflect: true })
  public uuid: string | null = null;

  @property({ type: String, attribute: 'cdn-url', reflect: true })
  public cdnUrl: string | null = null;

  @property({ type: String, attribute: 'crop-preset', reflect: true })
  public cropPreset = '';

  @property({ type: String, reflect: true })
  public tabs: string | null = DEFAULT_TABS;

  @state()
  private _hasNetworkProblems = false;

  @state()
  private _isInitialized = false;

  private _pendingInitUpdate: Promise<void> | null = null;

  private readonly _debouncedShowLoader = debounce((show: boolean) => {
    this._showLoader = show;
  }, 300);

  private readonly _imgRef = createRef<HTMLImageElement>();
  private readonly _cropperRef = createRef<EditorImageCropper>();
  private readonly _faderRef = createRef<EditorImageFader>();
  private readonly _imgContainerRef = createRef<HTMLDivElement>();
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: <explanation>
  private _contextProvider?: ContextProvider<typeof cloudImageEditorContext>;
  private _editorCtxId?: string;

  private readonly _handleImageLoad = (): void => {
    this._debouncedShowLoader(false);

    if (this._imageSrc !== TRANSPARENT_PIXEL_SRC) {
      this.editor$['*networkProblems'] = false;
    }
  };

  private readonly _handleImageError = (): void => {
    this._debouncedShowLoader(false);
    this.editor$['*networkProblems'] = true;
  };

  private readonly _handleRetryNetwork = (): void => {
    const retry = this.editor$['*on.retryNetwork'] as (() => void) | undefined;
    retry?.();
  };

  private _scheduleInitialization(): void {
    if (this._isInitialized || this._pendingInitUpdate) {
      return;
    }
    this._pendingInitUpdate = this.updateComplete.then(() => {
      this._pendingInitUpdate = null;
      this._isInitialized = true;
    });
  }

  public override contextConsumedCallback(): void {
    super.contextConsumedCallback();

    this._syncTabListFromProp();
    this._syncCropPresetState();
  }

  public override connectedCallback(): void {
    this._ensureEditorContext();
    super.connectedCallback();
  }

  private _assignSharedElements(): void {
    const faderEl = this._faderRef.value;
    if (faderEl) {
      this.editor$['*faderEl'] = faderEl;
    }

    const cropperEl = this._cropperRef.value;
    if (cropperEl) {
      this.editor$['*cropperEl'] = cropperEl;
    }

    const imgContainerEl = this._imgContainerRef.value;
    if (imgContainerEl) {
      this.editor$['*imgContainerEl'] = imgContainerEl;
    }

    const imgEl = this._imgRef.value;
    if (imgEl) {
      this.editor$['*imgEl'] = imgEl;
    }
  }

  private _attachImageListeners(): void {
    const imgEl = this._imgRef.value;
    if (!imgEl) {
      return;
    }
    imgEl.addEventListener('load', this._handleImageLoad);
    imgEl.addEventListener('error', this._handleImageError);
  }

  private _detachImageListeners(): void {
    const imgEl = this._imgRef.value;
    if (!imgEl) {
      return;
    }
    imgEl.removeEventListener('load', this._handleImageLoad);
    imgEl.removeEventListener('error', this._handleImageError);
  }

  private get _imageClassName(): string {
    const tabId = this.editor$['*tabId'] as TabIdValue;
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

  public override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this._assignSharedElements();
    this._attachImageListeners();
    void this.initEditor();

    const hasInitialSource = Boolean(this.uuid || this.cdnUrl);
    const alreadyRequested = changedProperties.has('uuid') || changedProperties.has('cdnUrl');
    if (hasInitialSource && !alreadyRequested) {
      void this.updateImage();
    }
  }

  public override disconnectedCallback(): void {
    this._detachImageListeners();
    this._destroyEditorContext();
    super.disconnectedCallback();
  }

  public override render() {
    const fileType = this._fileType ?? '';
    const message = this._statusMessage ?? '';
    const src = this._imageSrc || TRANSPARENT_PIXEL_SRC;
    const showLoader = this._showLoader;
    const showNetworkProblems = this._hasNetworkProblems;

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
            <uc-btn-ui theme="primary" text="Retry" @click=${this._handleRetryNetwork}></uc-btn-ui>
          </div>
        </uc-presence-toggle>
        <div class="uc-viewport">
          <div class="uc-file_type_outer">
            <div class="uc-file_type">${fileType}</div>
          </div>
          <div class="uc-image_container" ${ref(this._imgContainerRef)}>
            <img src=${src} class=${this._imageClassName} ${ref(this._imgRef)} />
            ${when(this._isInitialized, () => html`<uc-editor-image-cropper ${ref(this._cropperRef)}></uc-editor-image-cropper>`)}
            <uc-editor-image-fader ${ref(this._faderRef)}></uc-editor-image-fader>
          </div>
          <div class="uc-info_pan">${message}</div>
        </div>
        <div class="uc-toolbar">
          <uc-line-loader-ui .active=${showLoader}></uc-line-loader-ui>
          <div class="uc-toolbar_content uc-toolbar_content__editor">
            ${when(this._isInitialized, () => html`<uc-editor-toolbar></uc-editor-toolbar>`)}
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
      this._syncTabListFromProp();
    }

    if (changedProperties.has('cropPreset') || changedProperties.has('cdnUrl')) {
      this._syncCropPresetState();
    }
  }

  private _syncTabListFromProp(): void {
    const tabsValue = this.tabs || DEFAULT_TABS;
    this.editor$['*tabList'] = parseTabs(tabsValue);
  }

  private _syncCropPresetState(): void {
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

    this.editor$['*cropPresetList'] = list;
    this.editor$['*currentAspectRatio'] = closest ?? list?.[0] ?? null;
  }

  public async updateImage(): Promise<void> {
    if (!this.isConnected) {
      return;
    }
    await this._waitForSize();

    if (this.cdnUrl) {
      const cdnUrlValue = this.cdnUrl as string;
      const uuid = extractUuid(cdnUrlValue);
      const originalUrl = createOriginalUrl(cdnUrlValue, uuid);
      if (originalUrl === this.editor$['*originalUrl']) {
        return;
      }
      this.editor$['*originalUrl'] = originalUrl;
      const operations = extractOperations(cdnUrlValue);
      const transformations = operationsToTransformations(operations) as Transformations;
      this.editor$['*editorTransformations'] = transformations;
    } else if (this.uuid) {
      const originalUrl = createOriginalUrl(this.cfg.cdnCname, this.uuid as string);
      if (originalUrl === this.editor$['*originalUrl']) {
        return;
      }
      this.editor$['*originalUrl'] = originalUrl;
      if (Object.keys(this.editor$['*editorTransformations']).length > 0) {
        this.editor$['*editorTransformations'] = {};
      }
    } else {
      throw new Error('No UUID nor CDN URL provided');
    }

    if (this.editor$['*tabId'] === TabId.CROP) {
      (this.editor$['*cropperEl'] as EditorImageCropper)?.deactivate({ reset: true });
    } else {
      (this.editor$['*faderEl'] as EditorImageFader)?.deactivate();
    }

    try {
      const originalUrlValue = this.editor$['*originalUrl'] as string;
      const cdnUrl = await this.proxyUrl(createCdnUrl(originalUrlValue, createCdnUrlModifiers('json')));
      const json = (await fetch(cdnUrl).then((response) => response.json())) as { width: number; height: number };

      const { width, height } = json;
      this.editor$['*imageSize'] = { width, height };

      if (this.editor$['*tabId'] === TabId.CROP) {
        (this.editor$['*cropperEl'] as EditorImageCropper)?.activate(this.editor$['*imageSize'] as ImageSize);
      } else {
        (this.editor$['*faderEl'] as EditorImageFader)?.activate({ url: originalUrlValue });
      }
    } catch (err) {
      if (err) {
        this.telemetryManager.sendEventError(err, 'cloud editor image. Failed to load image info');
        console.error('Failed to load image info', err);
      }
    }

    this._scheduleInitialization();
  }

  public async initEditor(): Promise<void> {
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

    this.editorSub('*networkProblems', (networkProblems) => {
      const hasIssues = Boolean(networkProblems);
      this._hasNetworkProblems = hasIssues;
    });

    this.editorSub(
      '*editorTransformations',
      (transformations: Transformations) => {
        if (Object.keys(transformations).length === 0) {
          return;
        }
        const originalUrl = this.editor$['*originalUrl'] as string;
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

  private _ensureEditorContext(): void {
    if (this._editorCtxId) {
      return;
    }
    this._editorCtxId = `${this.ctxName}-cloud-image-editor-${UID.generateFastUid()}`;

    const initialState = createCloudImageEditorState(this);
    const editorPubSub = PubSub.registerCtx<CloudImageEditorState>(initialState, this._editorCtxId);
    this.editorCtxController.setPubSub(editorPubSub);
    this._contextProvider = new ContextProvider(this, {
      context: cloudImageEditorContext,
      initialValue: editorPubSub,
    });
  }

  private _destroyEditorContext(): void {
    if (this._editorCtxId) {
      PubSub.deleteCtx(this._editorCtxId);
    }
    this._contextProvider = undefined;
  }
}
