import { ContextProvider } from '@lit/context';
import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { when } from 'lit/directives/when.js';
import {
  CloudImageEditorController,
  type CloudImageEditorControllerState,
} from '../../../abstract/controllers/CloudImageEditorController';
import type { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { LitBlock } from '../../../lit/LitBlock';
import type { SharedState } from '../../../lit/SharedState';
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
import { createCloudImageEditorState } from './state.js';
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

/**
 * The cross-cutting state keys bridged bidirectionally between the shared
 * uploader ctx (`this.$`) and the `CloudImageEditorController` (M12 P1
 * scaffolding) — kept in sync while descendants are still reading `this.$`
 * directly. Must match `CloudImageEditorControllerState` exactly.
 */
const EDITOR_CONTROLLER_BRIDGE_KEYS = [
  '*originalUrl',
  '*loadingOperations',
  '*networkProblems',
  '*imageSize',
  '*editorTransformations',
  '*cropPresetList',
  '*currentAspectRatio',
  '*tabList',
  '*tabId',
  '*faderEl',
  '*cropperEl',
  '*imgContainerEl',
] as const satisfies readonly (keyof CloudImageEditorControllerState)[];

export class CloudImageEditorBlock extends LitBlock {
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

  private _pendingSizeWait: Promise<void> | null = null;

  /**
   * DOM-free editor controller (M12 P1 scaffolding) — created and provided
   * down the editor DOM tree so descendants can start consuming it in later
   * steps. Kept in sync with `this.$` via `_setupEditorControllerBridge`;
   * nothing reads from it yet, so this must not change observable behavior.
   */
  private readonly _editorController = new CloudImageEditorController();

  private readonly _editorControllerProvider = new ContextProvider(this, {
    context: cloudImageEditorContext,
    initialValue: this._editorController,
  });

  private _editorBridgeUnsubs: Array<() => void> = [];

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
      this.$['*networkProblems'] = false;
    }
  };

  private readonly _handleImageError = (): void => {
    this._debouncedShowLoader(false);
    this.$['*networkProblems'] = true;
  };

  private readonly _handleRetryNetwork = (): void => {
    const retry = this.$['*on.retryNetwork'] as (() => void) | undefined;
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

  public override init$ = {
    ...this.init$,
    ...createCloudImageEditorState(this),
  } as ReturnType<typeof createCloudImageEditorState>;

  public override initCallback(): void {
    super.initCallback();

    this._syncTabListFromProp();
    this._syncCropPresetState();

    this._setupEditorController();
  }

  /**
   * Wires the `CloudImageEditorController` (M12 P1 scaffolding): injects the
   * cross-cutting services + action handlers, then bridges the 12
   * cross-cutting state keys bidirectionally with `this.$` so the controller
   * stays a faithful mirror while descendants are still reading `this.$`
   * directly (unported). See `EDITOR_CONTROLLER_BRIDGE_KEYS`.
   *
   * Loop-safety: `StateController.set` and the shared-ctx pub/sub both dedupe
   * via value equality before notifying, so a value arriving from one side
   * and written back to the other is recognized as unchanged and the
   * propagation stops there — no infinite ping-pong.
   */
  private _setupEditorController(): void {
    this._editorController.setServices({
      l10n: (key, variables) => this.l10n(key, variables),
      getConfig: (key) => this.cfg[key],
      telemetry: {
        sendEvent: (event) => this.telemetryManager.sendEvent(event as Parameters<TelemetryManager['sendEvent']>[0]),
        sendEventError: (err, context) => this.telemetryManager.sendEventError(err, context as string | undefined),
      },
      proxyUrl: (url) => this.proxyUrl(url),
    });

    this._editorController.setHandlers({
      onApply: this.$['*on.apply'],
      onCancel: this.$['*on.cancel'],
      onRetryNetwork: this.$['*on.retryNetwork'],
    });

    // ctx -> controller: `sub`'s default `init = true` also seeds the
    // controller with the current value on first subscribe.
    for (const key of EDITOR_CONTROLLER_BRIDGE_KEYS) {
      this._editorBridgeUnsubs.push(this._bridgeKeyToController(key));
    }

    // controller -> ctx: coarse subscribe (fires on any controller state
    // change), write back only the keys that actually differ.
    this._editorBridgeUnsubs.push(
      this._editorController.subscribe(() => {
        for (const key of EDITOR_CONTROLLER_BRIDGE_KEYS) {
          this._bridgeKeyToCtx(key);
        }
      }),
    );
  }

  /**
   * ctx -> controller for a single bridge key. A real generic parameter (not
   * a union collapsed from a `for...of`) so TS can verify `SharedState[K]`
   * and `CloudImageEditorControllerState[K]` line up for the same `K`.
   */
  private _bridgeKeyToController<K extends (typeof EDITOR_CONTROLLER_BRIDGE_KEYS)[number]>(key: K): () => void {
    return this.sub(key, (value) => this._editorController.set(key, value));
  }

  /** controller -> ctx for a single bridge key, only if the value actually changed. */
  private _bridgeKeyToCtx<K extends (typeof EDITOR_CONTROLLER_BRIDGE_KEYS)[number]>(key: K): void {
    const controllerValue = this._editorController.get(key);
    if (!Object.is(controllerValue, this.$[key])) {
      // `CloudImageEditorControllerState` is a `Pick` of `CloudImageEditorState`, which `SharedState`
      // includes verbatim, so the value type for these 12 keys is identical on both sides — TS just
      // can't prove that correlation across two independently-declared interfaces through a shared
      // generic `K`. Narrow boundary cast, not a loosening of the state's real shape.
      this.$[key] = controllerValue as SharedState[K];
    }
  }

  private _assignSharedElements(): void {
    const faderEl = this._faderRef.value;
    if (faderEl) {
      this.$['*faderEl'] = faderEl;
    }

    const cropperEl = this._cropperRef.value;
    if (cropperEl) {
      this.$['*cropperEl'] = cropperEl;
    }

    const imgContainerEl = this._imgContainerRef.value;
    if (imgContainerEl) {
      this.$['*imgContainerEl'] = imgContainerEl;
    }

    const imgEl = this._imgRef.value;
    if (imgEl) {
      this.$['*imgEl'] = imgEl;
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

    for (const unsub of this._editorBridgeUnsubs) unsub();
    this._editorBridgeUnsubs = [];
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
    this.$['*tabList'] = parseTabs(tabsValue);
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

    this.$['*cropPresetList'] = list;
    this.$['*currentAspectRatio'] = closest ?? list?.[0] ?? null;
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
      if (Object.keys(this.$['*editorTransformations']).length > 0) {
        this.$['*editorTransformations'] = {};
      }
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

    this._scheduleInitialization();
  }

  public async initEditor(): Promise<void> {
    try {
      await this._waitForSize();
    } catch {
      return;
    }

    this.classList.add('uc-editor_ON');

    this.sub('*networkProblems', (networkProblems) => {
      const hasIssues = Boolean(networkProblems);
      this._hasNetworkProblems = hasIssues;
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

declare global {
  interface HTMLElementTagNameMap {
    'uc-cloud-image-editor-block': CloudImageEditorBlock;
  }
}
