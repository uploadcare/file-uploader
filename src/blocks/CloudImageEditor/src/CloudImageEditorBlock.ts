import { ContextConsumer, ContextProvider } from '@lit/context';
import { html, LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { when } from 'lit/directives/when.js';
import { CloudImageEditorController } from '../../../abstract/controllers/CloudImageEditorController';
import type { A11y } from '../../../abstract/managers/a11y';
import type { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { resolveSecureDeliveryProxyUrl } from '../../../abstract/secureDeliveryProxyUrl';
import { sharedConfigKey } from '../../../abstract/sharedConfigKey';
import { ensureUploaderCtx } from '../../../lit/ensureUploaderCtx';
import { LightDomMixin } from '../../../lit/LightDomMixin';
import { createL10n } from '../../../lit/l10n';
import type { PubSub } from '../../../lit/PubSubCompat';
import { RegisterableElementMixin } from '../../../lit/RegisterableElementMixin';
import type { SharedState } from '../../../lit/SharedState';
import { ctxNameContext } from '../../../lit/SymbioteCompatMixin';
import type { ConfigType } from '../../../types';
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
import { cloudImageEditorContext } from './editor-context';
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

type TabIdValue = (typeof TabId)[keyof typeof TabId];

const DEFAULT_TABS = serializeCsv([...ALL_TABS]);

const CloudImageEditorBlockBase = RegisterableElementMixin(LightDomMixin(LitElement));

export class CloudImageEditorBlock extends CloudImageEditorBlockBase {
  public declare attributesMeta: ({ uuid: string } | { 'cdn-url': string }) &
    Partial<{ tabs: string; 'crop-preset': string }> & {
      'ctx-name': string;
    };

  public static styleAttrs = ['uc-cloud-image-editor'];

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

  /** Own `ctx-name` attribute — mirrors `SymbioteCompatMixin`'s `_ctxNameAttr`. */
  @property({ type: String, attribute: 'ctx-name', reflect: true })
  public ctxName: string | null = null;

  @state()
  private _ctxNameFromContext: string | undefined;

  @state()
  private _hasNetworkProblems = false;

  @state()
  private _isInitialized = false;

  // Root-owned, single-child data passed to `<uc-editor-toolbar>` as plain Lit
  // props (not controller state — see the "State scoping principle").
  @state()
  private _imageSize: ImageSize | null = null;

  @state()
  private _cropPresetList: CropPresetList = [];

  @state()
  private _tabList: readonly TabIdValue[] = [...ALL_TABS];

  private _pendingInitUpdate: Promise<void> | null = null;

  private _pendingSizeWait: Promise<void> | null = null;

  private _editorInitialized = false;

  /**
   * Resolved shared uploader ctx (`ensureUploaderCtx`) — this root is the
   * editor's ctx owner (v1-parity: creates the ctx if it doesn't exist yet,
   * or joins an existing one, e.g. when embedded inside
   * `<uc-cloud-image-editor-activity>`).
   */
  private _ctx: PubSub<SharedState> | undefined;

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: side-effecting @lit/context registration, resolves `_ctxNameFromContext` from an ancestor provider
  private readonly _ctxNameConsumer = new ContextConsumer(this, {
    context: ctxNameContext,
    subscribe: true,
    callback: (value) => {
      if (!value) {
        return;
      }
      this._ctxNameFromContext = value;
      this._maybeInitializeCtx();
    },
  });

  /**
   * The DOM-free editor controller — OWNS the editor's cross-cutting state
   * (see `CloudImageEditorControllerState`). Created and provided down the
   * editor DOM tree so descendants (`EditorBlock`) can read/write it
   * directly; there is no more shared-ctx bridge (removed in M12 final —
   * previously `EDITOR_CONTROLLER_BRIDGE_KEYS`/`_setupEditorControllerBridge`
   * scaffolding).
   */
  private readonly _editorController = new CloudImageEditorController();

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: side-effecting @lit/context registration, never read after construction
  private readonly _editorControllerProvider = new ContextProvider(this, {
    context: cloudImageEditorContext,
    initialValue: this._editorController,
  });

  // Re-provide the resolved ctx-name down the editor tree so nested
  // `ChildBlock`s (`uc-icon`, ...) can adopt the shared uploader ctx and
  // render. `ChildBlock` does this for its own descendants; the editor root's
  // light base only *consumes* ctx-name, so without this the editor's icons
  // never adopt and render empty (no sprite `<use>`). Value set in
  // `_maybeInitializeCtx` once the effective ctx-name is known.
  private readonly _ctxNameProvider = new ContextProvider(this, {
    context: ctxNameContext,
    initialValue: undefined,
  });

  private _configChangeUnsub: (() => void) | undefined;
  private _localeChangeUnsub: (() => void) | undefined;

  private readonly _debouncedShowLoader = debounce((show: boolean) => {
    this._showLoader = show;
  }, 300);

  private readonly _imgRef = createRef<HTMLImageElement>();
  private readonly _cropperRef = createRef<EditorImageCropper>();
  private readonly _faderRef = createRef<EditorImageFader>();
  private readonly _imgContainerRef = createRef<HTMLDivElement>();

  private readonly _handleImageLoad = (): void => {
    this._debouncedShowLoader(false);

    if (this._imageSrc !== TRANSPARENT_PIXEL_SRC) {
      this._editorController.set('*networkProblems', false);
    }
  };

  private readonly _handleImageError = (): void => {
    this._debouncedShowLoader(false);
    this._editorController.set('*networkProblems', true);
  };

  private readonly _handleRetryNetwork = (): void => {
    this._retryNetworkImages();
  };

  /** Descendant apply/cancel intents arrive as bubbling `uc-internal:*` events (the controller holds no callbacks). */
  private readonly _onInternalApply = (e: CustomEvent<Transformations>): void => {
    this._handleApply(e.detail);
  };

  private readonly _onInternalCancel = (): void => {
    this._handleCancel();
  };

  private _scheduleInitialization(): void {
    if (this._isInitialized || this._pendingInitUpdate) {
      return;
    }
    this._pendingInitUpdate = this.updateComplete.then(async () => {
      this._pendingInitUpdate = null;
      this._isInitialized = true;
      // `_isInitialized` renders the init-gated subtree (the cropper + toolbar);
      // wait for that render to commit, then capture the now-live refs and
      // activate the viewer. `firstUpdated`/`updateImage` ran before this flip,
      // so `*cropperEl` was still null and its `activate()` no-oped — without
      // this the cropper renders but never gets its `<img>`/crop frame.
      await this.updateComplete;
      if (!this.isConnected) {
        return;
      }
      this._assignSharedElements();
      this._activateViewer();
    });
  }

  /**
   * (Re)activate the crop or fader viewer for the current tab, using the loaded
   * image size. No-op until the image size is known. Called after image info
   * loads (`updateImage`) and again once the init-gated cropper subtree has
   * rendered (`_scheduleInitialization`).
   */
  private _activateViewer(): void {
    const editorController = this._editorController;
    const imageSize = this._imageSize;
    if (!imageSize) {
      return;
    }
    if (editorController.get('*tabId') === TabId.CROP) {
      editorController.get('*cropperEl')?.activate(imageSize);
    } else {
      const originalUrl = editorController.get('*originalUrl');
      if (originalUrl) {
        editorController.get('*faderEl')?.activate({ url: originalUrl });
      }
    }
  }

  /** Resolved shared uploader ctx. Throws if the ctx-name hasn't resolved yet (see `_maybeInitializeCtx`). */
  protected get uploaderCtx(): PubSub<SharedState> {
    if (!this._ctx) {
      throw new Error('CloudImageEditorBlock: shared uploader ctx is not initialized yet (missing ctx-name).');
    }
    return this._ctx;
  }

  protected get telemetryManager(): TelemetryManager {
    return this.uploaderCtx.read('*telemetryManager');
  }

  protected get a11y(): A11y {
    return this.uploaderCtx.read('*a11y');
  }

  private get _effectiveCtxName(): string | undefined {
    return this.ctxName || this._ctxNameFromContext || undefined;
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    // Apply `styleAttrs` as bare attributes — the entire editor stylesheet is
    // scoped under `[uc-cloud-image-editor]` (incl. the `.uc-editor_ON`
    // visibility class), so without this the editor and every descendant
    // render unstyled/invisible. `ChildBlock` does this for the uploader
    // blocks; the editor's light base does not, so the root does it itself.
    for (const attr of (this.constructor as typeof CloudImageEditorBlock).styleAttrs) {
      if (!this.hasAttribute(attr)) this.setAttribute(attr, '');
    }
    this._maybeInitializeCtx();
  }

  private _maybeInitializeCtx(): void {
    if (this._editorInitialized) {
      return;
    }
    const ctxName = this._effectiveCtxName;
    if (!ctxName || !this.isConnected) {
      return;
    }
    this._editorInitialized = true;
    this._ctx = ensureUploaderCtx(ctxName);
    // Hand the ctx-name to descendant ChildBlocks (e.g. `uc-icon`) so they
    // adopt the same uploader ctx.
    this._ctxNameProvider.setValue(ctxName);

    this._syncTabListFromProp();
    this._syncCropPresetState();

    this._setupEditorController();
    this.initCallback();
  }

  /** Hook for subclasses (e.g. the `<uc-cloud-image-editor>` solution) — called once the shared ctx is resolved. */
  protected initCallback(): void {}

  /**
   * Wires the `CloudImageEditorController`'s injected services (l10n/config/
   * telemetry/proxy) and action handlers from the resolved shared ctx, then
   * subscribes to config/locale changes so descendants re-render on either
   * (replaces the old shared-ctx `subConfigValue`/locale-direction
   * reactivity `LitBlock` used to provide for free).
   */
  private _setupEditorController(): void {
    const ctx = this.uploaderCtx;

    this._editorController.setServices({
      l10n: createL10n(() => ctx),
      // `ctx.read(sharedConfigKey(key))` returns `SharedState[`*cfg/${K}`]`, which is
      // `ConfigType[K]` verbatim via `SharedConfigState`'s mapped type — TS can't
      // prove that identity through the generic `K` here; narrow boundary cast.
      getConfig: <K extends keyof ConfigType>(key: K): ConfigType[K] =>
        ctx.read(sharedConfigKey<K>(key)) as unknown as ConfigType[K],
      telemetry: {
        sendEvent: (event) => this.telemetryManager.sendEvent(event as Parameters<TelemetryManager['sendEvent']>[0]),
        sendEventError: (err, context) => this.telemetryManager.sendEventError(err, context as string | undefined),
        sendEventCloudImageEditor: (e, tabId, options) =>
          this.telemetryManager.sendEventCloudImageEditor(e, tabId, options),
      },
      proxyUrl: (url) => this.proxyUrl(url),
    });

    const uploaderController = ctx.uploaderController();
    this._syncTestId();
    this._configChangeUnsub = uploaderController.config.subscribe(() => {
      // Re-sync `data-testid` too: a standalone `<uc-config testMode>` sibling
      // may connect and set `testMode` after this element (documented
      // composition order), so the flag isn't known at first setup.
      this._syncTestId();
      this._editorController.notify();
    });
    this._localeChangeUnsub = uploaderController.locale.subscribe(() => this._editorController.notify());
  }

  /**
   * Mirror `data-testid` from the `testMode` config for e2e/`getByTestId`
   * locators — same contract as `ChildBlock._syncTestId` / v1 `LitBlock`'s
   * `subConfigValue('testMode', ...)`, reimplemented here since the root's
   * light base deliberately isn't `ChildBlock`.
   */
  private _syncTestId(): void {
    if (this._editorController.getConfig('testMode')) {
      this.setAttribute('data-testid', this.tagName.toLowerCase());
    } else {
      this.removeAttribute('data-testid');
    }
  }

  private _retryNetworkImages(): void {
    const images = this.querySelectorAll('img');
    for (const img of images) {
      const originalSrc = img.src;
      img.src = TRANSPARENT_PIXEL_SRC;
      img.src = originalSrc;
    }
    this._editorController.set('*networkProblems', false);
  }

  private _handleApply(transformations: Transformations): void {
    if (!transformations) {
      return;
    }
    const originalUrl = this._editorController.get('*originalUrl');
    if (!originalUrl) {
      console.warn('Original URL is null, cannot apply transformations');
      return;
    }
    const cdnUrlModifiers = createCdnUrlModifiers(transformationsToOperations(transformations), 'preview');
    const cdnUrl = createCdnUrl(originalUrl, cdnUrlModifiers);

    const eventData: ApplyResult = {
      originalUrl,
      cdnUrlModifiers,
      cdnUrl,
      transformations,
    };
    this.dispatchEvent(
      new CustomEvent<ApplyResult>('apply', {
        detail: eventData,
        bubbles: true,
        composed: true,
      }),
    );
    this.remove();
  }

  private _handleCancel(): void {
    // Dispatch before removing — once detached the element has no ancestor
    // path, so bubbling listeners on a container/document would miss `cancel`.
    this.dispatchEvent(
      new CustomEvent('cancel', {
        bubbles: true,
        composed: true,
      }),
    );
    this.remove();
  }

  /** Resolve a CDN url through the configured secure-delivery proxy, if any. */
  protected proxyUrl(url: string): Promise<string> {
    const ctx = this.uploaderCtx;
    return resolveSecureDeliveryProxyUrl(
      {
        secureDeliveryProxy: ctx.read(sharedConfigKey('secureDeliveryProxy')),
        secureDeliveryProxyUrlResolver: ctx.read(sharedConfigKey('secureDeliveryProxyUrlResolver')),
      },
      (error, context) => this.telemetryManager.sendEventError(error, context as string | undefined),
      url,
    );
  }

  private _assignSharedElements(): void {
    const faderEl = this._faderRef.value;
    if (faderEl) {
      this._editorController.set('*faderEl', faderEl);
    }

    const cropperEl = this._cropperRef.value;
    if (cropperEl) {
      this._editorController.set('*cropperEl', cropperEl);
    }

    const imgContainerEl = this._imgContainerRef.value;
    if (imgContainerEl) {
      this._editorController.set('*imgContainerEl', imgContainerEl);
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
    const tabId = this._editorController.get('*tabId');
    return classNames('uc-image', {
      'uc-image_hidden_to_cropper': tabId === TabId.CROP,
      'uc-image_hidden_effects': tabId !== TabId.CROP,
    });
  }

  /**
   * To proper work, we need non-zero size the element. So, we'll wait for it.
   */
  private _waitForSize(): Promise<void> {
    if (this._pendingSizeWait) {
      return this._pendingSizeWait;
    }

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
        if (this.isConnected) {
          console.error(error.message);
        }
        reject(error);
      };

      const resizeObserver = new ResizeObserver((entries) => {
        const [element] = entries;
        if (!element) {
          return;
        }
        if (element.contentRect.width > 0 && element.contentRect.height > 0) {
          resolveWait();
        }
      });

      const timeoutId = window.setTimeout(() => {
        rejectWait();
      }, TIMEOUT);

      if (hasNonZeroSize()) {
        resolveWait();
        return;
      }

      resizeObserver.observe(this);
    });

    return this._pendingSizeWait;
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

    this._configChangeUnsub?.();
    this._configChangeUnsub = undefined;
    this._localeChangeUnsub?.();
    this._localeChangeUnsub = undefined;
    this._editorController.destroy();

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
      <div
        class="uc-wrapper uc-wrapper_desktop"
        @uc-internal:apply=${this._onInternalApply}
        @uc-internal:cancel=${this._onInternalCancel}
      >
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
            ${when(
              this._isInitialized,
              () =>
                html`<uc-editor-toolbar
                  .cropPresetList=${this._cropPresetList}
                  .tabList=${this._tabList}
                  .imageSize=${this._imageSize}
                ></uc-editor-toolbar>`,
            )}
          </div>
        </div>
      </div>
    `;
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    // Derive the toolbar-prop state (`_tabList`/`_cropPresetList`) from the
    // reflected attributes in `willUpdate`, not `updated` — so the assignment
    // folds into the current render instead of scheduling a wasteful follow-up
    // (Lit "change-in-update").
    if (changedProperties.has('tabs')) {
      this._syncTabListFromProp();
    }

    if (changedProperties.has('cropPreset') || changedProperties.has('cdnUrl')) {
      this._syncCropPresetState();
    }
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has('uuid') && this.uuid) {
      void this.updateImage();
    }

    if (changedProperties.has('cdnUrl') && this.cdnUrl) {
      void this.updateImage();
    }
  }

  private _syncTabListFromProp(): void {
    const tabsValue = this.tabs || DEFAULT_TABS;
    this._tabList = parseTabs(tabsValue);
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

    this._cropPresetList = list;
    this._editorController.set('*currentAspectRatio', closest ?? list?.[0] ?? null);
  }

  public async updateImage(): Promise<void> {
    if (!this.isConnected) {
      return;
    }
    try {
      await this._waitForSize();
    } catch {
      return;
    }

    if (!this.isConnected) {
      return;
    }

    const editorController = this._editorController;

    if (this.cdnUrl) {
      const cdnUrlValue = this.cdnUrl as string;
      const uuid = extractUuid(cdnUrlValue);
      const originalUrl = createOriginalUrl(cdnUrlValue, uuid);
      if (originalUrl === editorController.get('*originalUrl')) {
        return;
      }
      editorController.set('*originalUrl', originalUrl);
      const operations = extractOperations(cdnUrlValue);
      const transformations = operationsToTransformations(operations) as Transformations;
      editorController.set('*editorTransformations', transformations);
    } else if (this.uuid) {
      const cdnCname = this.uploaderCtx.read(sharedConfigKey('cdnCname'));
      const originalUrl = createOriginalUrl(cdnCname, this.uuid as string);
      if (originalUrl === editorController.get('*originalUrl')) {
        return;
      }
      editorController.set('*originalUrl', originalUrl);
      if (Object.keys(editorController.get('*editorTransformations')).length > 0) {
        editorController.set('*editorTransformations', {});
      }
    } else {
      throw new Error('No UUID nor CDN URL provided');
    }

    if (editorController.get('*tabId') === TabId.CROP) {
      editorController.get('*cropperEl')?.deactivate({ reset: true });
    } else {
      editorController.get('*faderEl')?.deactivate();
    }

    try {
      const originalUrlValue = editorController.get('*originalUrl') as string;
      const cdnUrl = await this.proxyUrl(createCdnUrl(originalUrlValue, createCdnUrlModifiers('json')));
      const json = (await fetch(cdnUrl).then((response) => response.json())) as { width: number; height: number };

      if (!this.isConnected) {
        return;
      }

      const { width, height } = json;
      this._imageSize = { width, height };

      this._activateViewer();
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
    } catch {
      return;
    }

    if (!this.isConnected) {
      return;
    }

    this.classList.add('uc-editor_ON');

    const editorController = this._editorController;

    editorController.subscribe(() => {
      const networkProblems = Boolean(editorController.get('*networkProblems'));
      if (networkProblems !== this._hasNetworkProblems) {
        this._hasNetworkProblems = networkProblems;
      }
    });
    this._hasNetworkProblems = Boolean(editorController.get('*networkProblems'));

    let lastTransformations = editorController.get('*editorTransformations');
    editorController.subscribe(() => {
      const transformations = editorController.get('*editorTransformations');
      if (transformations === lastTransformations) {
        return;
      }
      lastTransformations = transformations;

      if (Object.keys(transformations).length === 0) {
        return;
      }
      const originalUrl = editorController.get('*originalUrl') as string;
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
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-cloud-image-editor-block': CloudImageEditorBlock;
  }
  interface HTMLElementEventMap {
    /** Internal apply/cancel intents dispatched by descendants (e.g. the toolbar), listened for by the root — replaces the former controller callbacks. */
    'uc-internal:apply': CustomEvent<Transformations>;
    'uc-internal:cancel': CustomEvent<void>;
  }
}
