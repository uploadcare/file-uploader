import { ContextConsumer, ContextProvider } from '@lit/context';
import { html, LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { when } from 'lit/directives/when.js';
import { uploaderContext } from '../../../abstract/context';
import type { UploaderController } from '../../../abstract/controllers/UploaderController';
import { LightDomMixin } from '../../../lit/LightDomMixin';
import enLocale from '../../../locales/file-uploader/en';
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
import { type EditorContextValue, type EditorServices, editorContext, NO_OP_TELEMETRY } from '../editor-context';
import { createInitialEditorState, EditorStateController } from '../editor-state';
import type { EditorImageCropper } from './EditorImageCropper';
import type { EditorImageFader } from './EditorImageFader';
import { classNames } from './lib/classNames.js';
import { getClosestAspectRatio, parseCropPreset } from './lib/parseCropPreset.js';
import { parseTabs } from './lib/parseTabs.js';
import { operationsToTransformations, transformationsToOperations } from './lib/transformationUtils.js';
import svgIconsSprite from './svg-sprite';
import { ALL_TABS, TabId } from './toolbar-constants.js';
import type { ApplyResult, CropPresetList, ImageSize, Transformations } from './types';

import './elements/presence-toggle/PresenceToggle';
import './elements/line-loader/LineLoaderUi';
import './elements/button/BtnUi';
import './EditorImageCropper';
import './EditorImageFader';
import './EditorToolbar';
import '../../Icon/Icon';

const DEFAULT_TABS = serializeCsv([...ALL_TABS]);
const BASE = LightDomMixin(LitElement);

/**
 * v2-native cloud image editor. Self-contained: owns an
 * `EditorStateController`, provides it via Lit context to descendants,
 * and reads cdnCname / proxy / locale from a surrounding
 * `<uc-uploader>` controller when present, otherwise from its own
 * attributes. No `LitBlock`, no `SymbioteMixin`, no PubSub-by-`ctx-name`.
 */
export class CloudImageEditorBlock extends BASE {
  public static styleAttrs: string[] = ['uc-cloud-image-editor'];

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

  @property({ type: String, attribute: 'cdn-cname' })
  public cdnCname = '';

  @property({ type: String, attribute: 'crop-preset', reflect: true })
  public cropPreset = '';

  @property({ type: String, reflect: true })
  public tabs: string | null = DEFAULT_TABS;

  @property({ type: Boolean, attribute: 'test-mode', reflect: true })
  public testMode = false;

  @state()
  private _hasNetworkProblems = false;

  @state()
  private _isInitialized = false;

  private _pendingInitUpdate: Promise<void> | null = null;

  private _pendingSizeWait: Promise<void> | null = null;

  private readonly _debouncedShowLoader = debounce((show: boolean) => {
    this._showLoader = show;
  }, 300);

  private readonly _imgRef = createRef<HTMLImageElement>();
  private readonly _cropperRef = createRef<EditorImageCropper>();
  private readonly _faderRef = createRef<EditorImageFader>();
  private readonly _imgContainerRef = createRef<HTMLDivElement>();

  // ─── Editor context plumbing ─────────────────────────────────────────────
  private readonly _state: EditorStateController = new EditorStateController(
    createInitialEditorState({
      onApply: (transformations) => this._emitApply(transformations),
      onCancel: () => this._emitCancel(),
      onRetryNetwork: () => this._retryNetwork(),
    }),
  );

  // Seed with the same fallback `_buildServices(null)` returns so the
  // standalone path (no `<uc-uploader>` ancestor — `_adoptUploader`
  // never fires because `@lit/context` doesn't notify consumers when
  // there's no provider) still resolves CIE locale keys.
  private _currentServices: EditorServices = this._buildServices(null);

  private readonly _provider = new ContextProvider(this, {
    context: editorContext,
    initialValue: { state: this._state, services: this._currentServices } as EditorContextValue,
  });

  /**
   * Optional consumer for the surrounding `UploaderController`. When
   * present, services like locale, proxy resolver, and telemetry flow
   * through it. When absent, the editor stays on its own attributes +
   * the no-op fallback.
   */
  /* biome-ignore lint/correctness/noUnusedPrivateClassMembers: wired for side effect. */
  private readonly _uploaderConsumer = new ContextConsumer(this, {
    context: uploaderContext,
    subscribe: true,
    callback: (ctrl) => this._adoptUploader(ctrl ?? null),
  });

  private _uploaderUnsubs: Array<() => void> = [];
  private _stateUnsubs: Array<() => void> = [];

  // ─── Event handlers ──────────────────────────────────────────────────────
  private readonly _handleImageLoad = (): void => {
    this._debouncedShowLoader(false);

    if (this._imageSrc !== TRANSPARENT_PIXEL_SRC) {
      this._state.set('*networkProblems', false);
    }
  };

  private readonly _handleImageError = (): void => {
    this._debouncedShowLoader(false);
    this._state.set('*networkProblems', true);
  };

  private readonly _handleRetryNetwork = (): void => {
    this._state.get('*on.retryNetwork')?.();
  };

  // ─── Lifecycle ───────────────────────────────────────────────────────────
  public override connectedCallback(): void {
    super.connectedCallback();
    const ctor = this.constructor as typeof CloudImageEditorBlock;
    for (const attr of ctor.styleAttrs) {
      if (!this.hasAttribute(attr)) this.setAttribute(attr, '');
    }
    this._syncTestId();
    // Seed `*testMode` so descendants reflect data-testid on first render.
    this._state.set('*testMode', this.testMode);
  }

  public override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);
    this._assignSharedElements();
    this._attachImageListeners();
    this._syncTabListFromProp();
    this._syncCropPresetState();
    void this.initEditor();

    const hasInitialSource = Boolean(this.uuid || this.cdnUrl);
    const alreadyRequested = changedProperties.has('uuid') || changedProperties.has('cdnUrl');
    if (hasInitialSource && !alreadyRequested) {
      void this.updateImage();
    }
  }

  public override disconnectedCallback(): void {
    this._detachImageListeners();
    for (const u of this._uploaderUnsubs) u();
    this._uploaderUnsubs = [];
    for (const u of this._stateUnsubs) u();
    this._stateUnsubs = [];
    super.disconnectedCallback();
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

    if (changedProperties.has('testMode')) {
      this._syncTestId();
      this._state.set('*testMode', this.testMode);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  public override render() {
    const fileType = this._fileType ?? '';
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

  // ─── Imperative API (called by the toolbar / cropper / fader) ────────────
  public async updateImage(): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this._waitForSize();
    } catch {
      return;
    }
    if (!this.isConnected) return;

    if (this.cdnUrl) {
      const cdnUrlValue = this.cdnUrl;
      const uuid = extractUuid(cdnUrlValue);
      const originalUrl = createOriginalUrl(cdnUrlValue, uuid);
      if (originalUrl === this._state.get('*originalUrl')) return;
      this._state.set('*originalUrl', originalUrl);
      const operations = extractOperations(cdnUrlValue);
      const transformations = operationsToTransformations(operations) as Transformations;
      this._state.set('*editorTransformations', transformations);
    } else if (this.uuid) {
      const originalUrl = createOriginalUrl(this.cdnCname || '', this.uuid);
      if (originalUrl === this._state.get('*originalUrl')) return;
      this._state.set('*originalUrl', originalUrl);
      if (Object.keys(this._state.get('*editorTransformations')).length > 0) {
        this._state.set('*editorTransformations', {});
      }
    } else {
      throw new Error('No UUID nor CDN URL provided');
    }

    if (this._state.get('*tabId') === TabId.CROP) {
      (this._state.get('*cropperEl') as EditorImageCropper | null)?.deactivate({ reset: true });
    } else {
      (this._state.get('*faderEl') as EditorImageFader | null)?.deactivate();
    }

    try {
      const originalUrlValue = this._state.get('*originalUrl') as string;
      const cdnUrl = await this._currentServices.proxyUrl(
        createCdnUrl(originalUrlValue, createCdnUrlModifiers('json')),
      );
      const json = (await fetch(cdnUrl).then((response) => response.json())) as {
        width: number;
        height: number;
      };

      const { width, height } = json;
      this._state.set('*imageSize', { width, height });

      if (this._state.get('*tabId') === TabId.CROP) {
        (this._state.get('*cropperEl') as EditorImageCropper | null)?.activate(
          this._state.get('*imageSize') as ImageSize,
        );
      } else {
        (this._state.get('*faderEl') as EditorImageFader | null)?.activate({ url: originalUrlValue });
      }
    } catch (err) {
      if (err) {
        this._currentServices.telemetry.sendEventError(err, 'cloud editor image. Failed to load image info');
        console.error('Failed to load image info', err);
      }
    }

    this._scheduleInitialization();
  }

  public async initEditor(): Promise<void> {
    try {
      await this._waitForSize();
    } catch {
      return;
    }

    this.classList.add('uc-editor_ON');

    // Capture unsubs so a remount doesn't accumulate listeners and
    // emit `change` multiple times per transformation.
    this._stateUnsubs.push(
      this._state.subscribe('*networkProblems', () => {
        this._hasNetworkProblems = Boolean(this._state.get('*networkProblems'));
      }),
    );

    this._stateUnsubs.push(
      this._state.subscribe('*editorTransformations', () => {
        const transformations = this._state.get('*editorTransformations');
        if (Object.keys(transformations).length === 0) return;
        const originalUrl = this._state.get('*originalUrl') as string;
        const cdnUrlModifiers = createCdnUrlModifiers(transformationsToOperations(transformations), 'preview');
        const cdnUrl = createCdnUrl(originalUrl, cdnUrlModifiers);

        const eventData: ApplyResult = { originalUrl, cdnUrlModifiers, cdnUrl, transformations };
        this.dispatchEvent(
          new CustomEvent<ApplyResult>('change', {
            detail: eventData,
            bubbles: true,
            composed: true,
          }),
        );
      }),
    );
  }

  // ─── Internals ───────────────────────────────────────────────────────────
  private _assignSharedElements(): void {
    if (this._faderRef.value) this._state.set('*faderEl', this._faderRef.value);
    if (this._cropperRef.value) this._state.set('*cropperEl', this._cropperRef.value);
    if (this._imgContainerRef.value) this._state.set('*imgContainerEl', this._imgContainerRef.value);
    if (this._imgRef.value) this._state.set('*imgEl', this._imgRef.value);
  }

  private _attachImageListeners(): void {
    const imgEl = this._imgRef.value;
    if (!imgEl) return;
    imgEl.addEventListener('load', this._handleImageLoad);
    imgEl.addEventListener('error', this._handleImageError);
  }

  private _detachImageListeners(): void {
    const imgEl = this._imgRef.value;
    if (!imgEl) return;
    imgEl.removeEventListener('load', this._handleImageLoad);
    imgEl.removeEventListener('error', this._handleImageError);
  }

  private get _imageClassName(): string {
    const tabId = this._state.get('*tabId');
    return classNames('uc-image', {
      'uc-image_hidden_to_cropper': tabId === TabId.CROP,
      'uc-image_hidden_effects': tabId !== TabId.CROP,
    });
  }

  private _waitForSize(): Promise<void> {
    if (this._pendingSizeWait) return this._pendingSizeWait;

    const TIMEOUT = 3000;
    this._pendingSizeWait = new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeoutId);
        resizeObserver.disconnect();
        this._pendingSizeWait = null;
      };

      const hasNonZeroSize = () => {
        const { width, height } = this.getBoundingClientRect();
        return width > 0 && height > 0;
      };

      const resolveWait = () => {
        cleanup();
        window.setTimeout(() => resolve(), 0);
      };

      const rejectWait = () => {
        const error = new Error('[cloud-image-editor] timeout waiting for non-zero container size');
        cleanup();
        if (this.isConnected) console.error(error.message);
        reject(error);
      };

      const resizeObserver = new ResizeObserver((entries) => {
        const [element] = entries;
        if (!element) return;
        if (element.contentRect.width > 0 && element.contentRect.height > 0) resolveWait();
      });

      const timeoutId = window.setTimeout(() => rejectWait(), TIMEOUT);

      if (hasNonZeroSize()) {
        resolveWait();
        return;
      }
      resizeObserver.observe(this);
    });

    return this._pendingSizeWait;
  }

  private _scheduleInitialization(): void {
    if (this._isInitialized || this._pendingInitUpdate) return;
    this._pendingInitUpdate = this.updateComplete.then(async () => {
      this._pendingInitUpdate = null;
      this._isInitialized = true;
      // _isInitialized gates rendering of `<uc-editor-image-cropper>` +
      // `<uc-editor-toolbar>` — wait one more update cycle for them to
      // mount, then re-assign refs to `*cropperEl` so the toolbar's
      // crop/mirror/flip buttons can find the cropper instance. Then
      // (re-)run image activation. Without this, `cropperEl` stays null
      // forever and toolbar clicks silently no-op.
      await this.updateComplete;
      this._assignSharedElements();
      if (this._state.get('*imageSize') && this._state.get('*tabId') === TabId.CROP) {
        (this._state.get('*cropperEl') as EditorImageCropper | null)?.activate(
          this._state.get('*imageSize') as ImageSize,
        );
      }
    });
  }

  private _syncTabListFromProp(): void {
    const tabsValue = this.tabs || DEFAULT_TABS;
    this._state.set('*tabList', parseTabs(tabsValue));
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

    this._state.set('*cropPresetList', list);
    this._state.set('*currentAspectRatio', closest ?? list?.[0] ?? null);
  }

  private _syncTestId(): void {
    if (this.testMode) {
      this.setAttribute('data-testid', this.tagName.toLowerCase());
    } else {
      this.removeAttribute('data-testid');
    }
  }

  // ─── Uploader-context bridge ─────────────────────────────────────────────
  private _adoptUploader(ctrl: UploaderController | null): void {
    for (const u of this._uploaderUnsubs) u();
    this._uploaderUnsubs = [];

    this._currentServices = this._buildServices(ctrl);
    this._provider.setValue({ state: this._state, services: this._currentServices });

    if (!ctrl) return;

    const syncFromConfig = (): void => {
      const next = ctrl.config.values as {
        cdnCname?: string;
        testMode?: boolean;
        cloudImageEditorMaskHref?: string | null;
      };
      if (next.cdnCname && this.cdnCname !== next.cdnCname) {
        this.cdnCname = next.cdnCname;
      }
      if (typeof next.testMode === 'boolean' && this.testMode !== next.testMode) {
        this.testMode = next.testMode;
        this._state.set('*testMode', next.testMode);
      }
      const maskHref = next.cloudImageEditorMaskHref ?? null;
      if (this._state.get('*maskHref') !== maskHref) {
        this._state.set('*maskHref', maskHref);
      }
      this._currentServices = this._buildServices(ctrl);
      this._provider.setValue({ state: this._state, services: this._currentServices });
    };
    syncFromConfig();
    this._uploaderUnsubs.push(ctrl.config.subscribe(syncFromConfig));
  }

  private _buildServices(ctrl: UploaderController | null): EditorServices {
    const fallback: EditorServices = {
      l10n: (key, vars) => {
        // Look up the built-in en dict first (covers the CIE keys —
        // `a11y-cloud-editor-apply-*`, `crop-to-shape`, etc.); fall
        // back to the key itself if not found. Then apply `{{name}}`
        // interpolation. Matches `LocaleController.t` semantics for
        // the standalone scenario where no uploader is in the tree.
        const template = (enLocale as unknown as Record<string, string>)[key] ?? key;
        return formatL10n(template, vars);
      },
      proxyUrl: (url) => Promise.resolve(url),
      telemetry: NO_OP_TELEMETRY,
    };
    if (!ctrl) return fallback;
    return {
      l10n: (key, vars) => ctrl.locale.t(key, vars) ?? key,
      proxyUrl: async (url) => {
        const resolver = (
          ctrl.config.values as unknown as {
            secureDeliveryProxyUrlResolver?: (url: string) => Promise<string> | string;
          }
        ).secureDeliveryProxyUrlResolver;
        if (typeof resolver === 'function') {
          try {
            return await resolver(url);
          } catch (err) {
            console.warn('[v2/cie] secureDeliveryProxyUrlResolver threw', err);
          }
        }
        return url;
      },
      telemetry: NO_OP_TELEMETRY,
    };
  }

  // ─── apply / cancel / retry callbacks bound to the state controller ──────
  private _emitApply(transformations: Transformations): void {
    if (!transformations) return;
    const originalUrl = this._state.get('*originalUrl');
    if (!originalUrl) {
      console.warn('Original URL is null, cannot apply transformations');
      return;
    }
    const cdnUrlModifiers = createCdnUrlModifiers(transformationsToOperations(transformations), 'preview');
    const cdnUrl = createCdnUrl(originalUrl, cdnUrlModifiers);

    const eventData: ApplyResult = { originalUrl, cdnUrlModifiers, cdnUrl, transformations };
    this.dispatchEvent(
      new CustomEvent('apply', {
        detail: eventData,
        bubbles: true,
        composed: true,
      }),
    );
    this.remove();
  }

  private _emitCancel(): void {
    // Dispatch BEFORE removing the host — a `composed: true` event from
    // a detached element doesn't bubble into the host document.
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
    this.remove();
  }

  private _retryNetwork(): void {
    const images = this.querySelectorAll('img');
    for (const img of images) {
      const originalSrc = img.src;
      img.src = TRANSPARENT_PIXEL_SRC;
      img.src = originalSrc;
    }
    this._state.set('*networkProblems', false);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-cloud-image-editor-block': CloudImageEditorBlock;
  }
}

/** Minimal `{{key}}` interpolation used in the standalone l10n fallback. */
function formatL10n(key: string, vars?: Record<string, string | number>): string {
  if (!vars) return key;
  return key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => (name in vars ? String(vars[name]) : `{{${name}}}`));
}

void classNames;
void unsafeSVG;
