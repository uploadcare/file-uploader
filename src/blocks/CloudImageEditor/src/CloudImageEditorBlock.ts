import { ContextConsumer, ContextProvider } from '@lit/context';
import { parseFileUrl, serializeFileUrl } from '@uploadcare/cdn-url';
import { html, LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { when } from 'lit/directives/when.js';
import {
  CloudImageEditorController,
  type EditorConfig,
  type EditorServices,
} from '../../../abstract/controllers/CloudImageEditorController';
import { logger } from '../../../abstract/logger';
import type { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { resolveSecureDeliveryProxyUrl } from '../../../abstract/secureDeliveryProxyUrl';
import { ctxNameContext } from '../../../lit/ctx-name-context';
import { LightDomMixin } from '../../../lit/LightDomMixin';
import { RegisterableElementMixin } from '../../../lit/RegisterableElementMixin';
import type { ConfigType, SecureDeliveryProxyUrlResolver } from '../../../types';
import { serializeCsv } from '../../../utils/comma-separated';
import { debounce } from '../../../utils/debounce.js';
import { TRANSPARENT_PIXEL_SRC } from '../../../utils/transparentPixelSrc';
import { subscribeUploaderConfigCompat } from './editor-config-compat';
import { cloudImageEditorContext } from './editor-context';
import { type EditorL10n, resolveEditorL10n } from './editor-locale';
import { classNames } from './lib/classNames.js';
import { editorAppliedUrl, editorImageInfoUrl } from './lib/editorUrls';
import { getClosestAspectRatio, parseCropPreset } from './lib/parseCropPreset.js';
import { parseTabs } from './lib/parseTabs.js';
import { operationsToTransformations } from './lib/transformationUtils.js';
import svgIconsSprite from './svg-sprite';
import { ALL_TABS, TabId } from './toolbar-constants.js';
import type { ApplyResult, CropPresetList, ImageSize, Transformations } from './types';

import './elements/presence-toggle/PresenceToggle';
import './elements/line-loader/LineLoaderUi';
import './elements/button/BtnUi';
import './EditorImageCropper';
import './EditorImageFader';
import './EditorToolbar';
import './EditorIcon';

type TabIdValue = (typeof TabId)[keyof typeof TabId];

const DEFAULT_TABS = serializeCsv([...ALL_TABS]);

const CloudImageEditorBlockBase = RegisterableElementMixin(LightDomMixin(LitElement));

export class CloudImageEditorBlock extends CloudImageEditorBlockBase {
  // Shared `cloud-image-editor` scope — the same scope descendant `EditorBlock`s
  // use via their inherited `_log`, so all editor output is one scope.
  private readonly _log = logger.scope('cloud-image-editor');

  public declare attributesMeta: ({ uuid: string } | { 'cdn-url': string }) &
    Partial<{
      tabs: string;
      'crop-preset': string;
      'cdn-cname': string;
      'secure-delivery-proxy': string;
      'cloud-image-editor-mask-href': string;
      secureDeliveryProxyUrlResolver: SecureDeliveryProxyUrlResolver;
      localeDefinition: Record<string, string>;
      'test-mode': boolean;
      // Optional: the standalone editor needs no ctx-name (config comes from its
      // own props); it's only used to find a sibling <uc-config> compat bridge.
      'ctx-name': string;
    }>;

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

  // Editor config surface, own-element-prop layer (see `EditorConfig` /
  // `_setupEditorController`) — takes precedence over the shared uploader ctx.
  @property({ attribute: 'cdn-cname' })
  public cdnCname?: string;

  @property({ attribute: 'secure-delivery-proxy' })
  public secureDeliveryProxy?: string;

  @property({ attribute: false })
  public secureDeliveryProxyUrlResolver?: SecureDeliveryProxyUrlResolver;

  @property({ attribute: 'cloud-image-editor-mask-href' })
  public maskHref?: string;

  @property({ attribute: false })
  public localeDefinition?: Record<string, string>;

  @property({
    attribute: 'test-mode',
    // Preserve `undefined` for an absent/removed attribute so an unset prop
    // falls through to the sibling `<uc-config>`/default per the config
    // precedence contract. Lit's stock Boolean converter maps a removed
    // attribute to `false`, which would pin a spurious override and shadow the
    // fallback. Present with any value but "false" → true.
    converter: {
      fromAttribute: (value: string | null): boolean | undefined => (value === null ? undefined : value !== 'false'),
    },
  })
  public testMode?: boolean;

  /** Own `ctx-name` attribute — wins over the inherited `ctxNameContext` value. */
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

  private _uploaderConfigCompat: Partial<EditorConfig> = {};

  private _telemetryManager: TelemetryManager | undefined;

  // Telemetry emitted before the compat bridge supplies a TelemetryManager
  // (e.g. the solution's INIT event in `initCallback`, which runs before the
  // async bridge resolves) is buffered and flushed once one arrives. Bounded so
  // a standalone editor — where telemetry never arrives — can't accumulate.
  private _pendingTelemetry: Array<(tm: TelemetryManager) => void> = [];

  private _emitTelemetry(fn: (tm: TelemetryManager) => void): void {
    if (this._telemetryManager) {
      fn(this._telemetryManager);
    } else if (this._pendingTelemetry.length < 25) {
      this._pendingTelemetry.push(fn);
    }
  }

  /** Interpolating l10n from a sibling `<uc-config>` (compat bridge); undefined until it resolves / when standalone. */
  private _compatL10n?: (key: string, variables?: Record<string, string | number>) => string;

  private readonly _defaultEditorL10n = resolveEditorL10n();

  private _localeDefinitionSource?: Record<string, string>;

  private _localeDefinitionL10n?: EditorL10n;

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: side-effecting @lit/context registration, resolves `_ctxNameFromContext` from an ancestor provider
  private readonly _ctxNameConsumer = new ContextConsumer(this, {
    context: ctxNameContext,
    subscribe: true,
    callback: (value) => {
      if (!value) {
        return;
      }
      this._ctxNameFromContext = value;
      this._setupEditor();
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

  private _configChangeUnsub: (() => void) | undefined;

  private readonly _debouncedShowLoader = debounce((show: boolean) => {
    this._showLoader = show;
  }, 300);

  /**
   * The image container, passed to `<uc-editor-toolbar>` as a plain Lit prop
   * (UI-layer plumbing, not controller state) so it can measure the rendered
   * width for image preloading. Read via `.value`: the container renders before
   * the init-gated toolbar, so the ref is populated by the time the toolbar's
   * prop binding evaluates.
   */
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
    this._pendingInitUpdate = this.updateComplete.then(() => {
      this._pendingInitUpdate = null;
      // Render the init-gated subtree (the cropper + toolbar). The cropper and
      // fader self-activate once they mount with their `imageSize` prop set for
      // the current tab, so they need no external kick here.
      this._isInitialized = true;
    });
  }

  private get _effectiveCtxName(): string | undefined {
    return this.ctxName || this._ctxNameFromContext || undefined;
  }

  protected get telemetry(): EditorServices['telemetry'] {
    return this._editorController.telemetry;
  }

  private _getLocaleDefinitionL10n(): EditorL10n | undefined {
    if (!this.localeDefinition) {
      this._localeDefinitionSource = undefined;
      this._localeDefinitionL10n = undefined;
      return undefined;
    }

    if (this._localeDefinitionSource !== this.localeDefinition) {
      this._localeDefinitionSource = this.localeDefinition;
      this._localeDefinitionL10n = resolveEditorL10n(this.localeDefinition);
    }

    return this._localeDefinitionL10n;
  }

  private readonly _resolveL10n: EditorL10n = (key, variables) => {
    return (
      this._getLocaleDefinitionL10n()?.(key, variables) ??
      this._compatL10n?.(key, variables) ??
      this._defaultEditorL10n(key, variables)
    );
  };

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
    this._setupEditor();
  }

  private _setupEditor(): void {
    if (!this.isConnected) {
      return;
    }
    // Controller + services are set up ONCE, independent of any ctx-name — a
    // fully standalone editor (no ctx-name, no `<uc-config>`) still needs its
    // own config/locale wired. The removable compat bridge is wired separately,
    // only when a ctx-name is available (now, or when an ancestor provides it).
    if (!this._editorInitialized) {
      this._editorInitialized = true;
      this._syncTabListFromProp();
      this._syncCropPresetState();
      this._setupEditorController();
      this.initCallback();
    }
    this._maybeWireConfigBridge();
  }

  /**
   * Wire the removable `<uc-config>` config/locale/telemetry compat bridge —
   * only when a ctx-name is available (skipped entirely for the standalone
   * editor). Idempotent: wires at most once.
   */
  private _maybeWireConfigBridge(): void {
    if (this._configChangeUnsub) {
      return;
    }
    const ctxName = this._effectiveCtxName;
    if (!ctxName) {
      return;
    }
    this._configChangeUnsub = subscribeUploaderConfigCompat(
      ctxName,
      (patch) => {
        this._uploaderConfigCompat = { ...this._uploaderConfigCompat, ...patch };
        // Re-sync `data-testid` too: a `<uc-config testMode>` sibling may
        // connect and set `testMode` after this element (documented composition
        // order), so the flag isn't known at first setup.
        this._syncTestId();
        this._editorController.notify();
      },
      (l10n) => {
        this._compatL10n = l10n;
        this._editorController.notify();
        this.requestUpdate();
      },
      (telemetryManager) => {
        this._telemetryManager = telemetryManager;
        // Flush any telemetry buffered before the manager arrived (e.g. INIT).
        const pending = this._pendingTelemetry;
        this._pendingTelemetry = [];
        for (const fn of pending) {
          fn(telemetryManager);
        }
      },
    );
  }

  /** Hook for subclasses (e.g. the `<uc-cloud-image-editor>` solution) — called once the editor is configured. */
  protected initCallback(): void {}

  /**
   * Wires the `CloudImageEditorController`'s injected services (l10n/config/
   * telemetry/proxy) and action handlers. Config and telemetry may be supplied
   * transitionally by a removable read-only uploader-ctx compat bridge.
   */
  private _setupEditorController(): void {
    this._editorController.setServices({
      // Standalone bundles only this editor's English subset; a sibling
      // `<uc-config>` locale is honored through the removable compat bridge
      // (`_compatL10n`). We intentionally do not load every uploader locale
      // into the standalone editor bundle. `localeDefinition` covers an
      // explicit standalone override.
      l10n: this._resolveL10n,
      // Precedence: this element's own prop (see `_ownEditorConfigValue`) →
      // the removable uploader-config compat bridge → the controller's
      // built-in default (`EditorConfig`'s defaults, reached via
      // `getConfigValue` when neither of the above supplied a value).
      getConfig: <K extends keyof ConfigType>(key: K): ConfigType[K] => {
        const editorConfigKey = CloudImageEditorBlock._toEditorConfigKey(key);
        // Own-prop tier: the explicit override the controller holds (present
        // only when the element's prop set it), so a set value — even falsy —
        // wins, and an unset prop falls through.
        const ownValue = editorConfigKey ? this._editorController.getOwnConfigValue(editorConfigKey) : undefined;
        if (ownValue !== undefined) {
          return ownValue as unknown as ConfigType[K];
        }
        const compatValue = editorConfigKey ? this._uploaderConfigCompat[editorConfigKey] : undefined;
        if (compatValue !== undefined) {
          return compatValue as unknown as ConfigType[K];
        }
        // Built-in default tier.
        return editorConfigKey
          ? (this._editorController.getConfigValue(editorConfigKey) as unknown as ConfigType[K])
          : (undefined as unknown as ConfigType[K]);
      },
      telemetry: {
        sendEvent: (event) =>
          this._emitTelemetry((tm) => tm.sendEvent(event as Parameters<TelemetryManager['sendEvent']>[0])),
        sendEventError: (err, context) =>
          this._emitTelemetry((tm) => tm.sendEventError(err, context as string | undefined)),
        sendEventCloudImageEditor: (e, tabId, options) =>
          this._emitTelemetry((tm) => tm.sendEventCloudImageEditor(e, tabId, options)),
      },
      proxyUrl: (url) => this.proxyUrl(url),
    });

    this._syncTestId();
  }

  /**
   * Mirror `data-testid` from the `testMode` config for e2e/`getByTestId`
   * locators — same contract as `ChildBlock._applyTestMode` / v1 `LitBlock`'s
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
      this._log.warn('Original URL is null, cannot apply transformations');
      return;
    }
    const sourceOperations = this._editorController.get('*sourceOperations');
    // Edited in place rather than rebuilt: an operation the editor cannot model
    // keeps its original position, which matters to the CDN for a few pairs
    // (`stretch` applies to a following resize) — enforced by `editorAppliedUrl`
    // composing the operation list once for both `cdnUrl` and `cdnUrlModifiers`.
    try {
      const { cdnUrl, cdnUrlModifiers } = editorAppliedUrl({ originalUrl, transformations, sourceOperations });

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
    } catch (err) {
      this._log.error('Failed to apply editor transformations', err);
      return;
    }
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
    return resolveSecureDeliveryProxyUrl(
      {
        secureDeliveryProxy: this._editorController.getConfig('secureDeliveryProxy'),
        secureDeliveryProxyUrlResolver: this._editorController.getConfig('secureDeliveryProxyUrlResolver'),
      },
      (error, context) => this._editorController.telemetry.sendEventError(error, context),
      url,
    );
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
          this._log.error(error.message);
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
    void this.initEditor();

    const hasInitialSource = Boolean(this.uuid || this.cdnUrl);
    const alreadyRequested = changedProperties.has('uuid') || changedProperties.has('cdnUrl');
    if (hasInitialSource && !alreadyRequested) {
      void this.updateImage();
    }
  }

  public override disconnectedCallback(): void {
    this._configChangeUnsub?.();
    this._configChangeUnsub = undefined;
    this._editorController.destroy();
    this._pendingTelemetry = [];

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
              <uc-editor-icon name="sad"></uc-editor-icon>
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
            <img src=${src} class=${this._imageClassName} @load=${this._handleImageLoad} @error=${this._handleImageError} />
            ${when(
              this._isInitialized,
              () => html`<uc-editor-image-cropper .imageSize=${this._imageSize}></uc-editor-image-cropper>`,
            )}
            <uc-editor-image-fader .imageSize=${this._imageSize}></uc-editor-image-fader>
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
                  .imageContainer=${this._imgContainerRef.value ?? null}
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

    if (
      changedProperties.has('cdnCname') ||
      changedProperties.has('secureDeliveryProxy') ||
      changedProperties.has('secureDeliveryProxyUrlResolver') ||
      changedProperties.has('maskHref') ||
      changedProperties.has('testMode')
    ) {
      this._syncEditorConfigFromProps();
      // Own-prop `testMode` may have just changed the resolved config — re-sync
      // `data-testid` (standalone has no compat-bridge callback to do this, and
      // `_setupEditorController`'s initial sync ran before the prop was applied).
      // Notify descendants that read config through the controller (`setConfig`
      // itself does not notify) so they re-render on a config-prop change.
      if (this._editorInitialized) {
        this._syncTestId();
        this._editorController.notify();
      }
    }

    if (changedProperties.has('localeDefinition')) {
      this._editorController.notify();
    }
  }

  /**
   * Own-element-prop layer of the editor config (see `EditorConfig`) — only
   * forwards props that are actually set, so an unset prop doesn't clobber
   * the ctx-fallback/default layers underneath with `undefined`.
   */
  private _syncEditorConfigFromProps(): void {
    // Pass every editor prop each time (undefined when unset). `setConfig`
    // removes the keys whose prop is undefined, so unsetting a prop restores
    // the ctx/default fallback rather than leaving a stale override. All these
    // props are optional with no initializer, so `undefined` means "not set on
    // the editor element" — including `testMode` (never a spurious `false`).
    this._editorController.setConfig({
      cdnCname: this.cdnCname,
      secureDeliveryProxy: this.secureDeliveryProxy,
      secureDeliveryProxyUrlResolver: this.secureDeliveryProxyUrlResolver,
      cloudImageEditorMaskHref: this.maskHref,
      testMode: this.testMode,
    });
  }

  /** Maps a `ConfigType` key onto its `EditorConfig` counterpart, if it's part of the editor's config surface. */
  private static _toEditorConfigKey<K extends keyof ConfigType>(key: K): keyof EditorConfig | undefined {
    switch (key) {
      case 'cdnCname':
      case 'secureDeliveryProxy':
      case 'secureDeliveryProxyUrlResolver':
      case 'cloudImageEditorMaskHref':
      case 'testMode':
      case 'debug':
        return key;
      default:
        return undefined;
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
      try {
        // Throws for anything that is not a single stored file; this lifecycle
        // path tolerates a missing crop, so it just leaves `closest` at null.
        const parsed = parseFileUrl(this.cdnUrl);
        const transformations = operationsToTransformations(parsed.operations) as Transformations;

        if (Array.isArray(transformations?.crop?.dimensions)) {
          const [w, h] = transformations.crop.dimensions;
          closest = getClosestAspectRatio(w, h, list, 0.1);
        }
      } catch (err) {
        this._log.debug('Failed to parse CDN URL while syncing the crop preset state', err);
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
      // `parseFileUrl` throws for anything that is not a single stored file
      // (a group or delivery-proxy URL); caught locally so a bad `cdn-url`
      // warns and opens the editor without transformations instead of
      // throwing into the `void this.updateImage()` callers.
      let parsed: ReturnType<typeof parseFileUrl>;
      try {
        parsed = parseFileUrl(cdnUrlValue);
      } catch (err) {
        this._log.warn('Failed to parse CDN URL, opening editor without transformations', err);
        // Still initialize before bailing: `_scheduleInitialization` is the only
        // thing that sets `_isInitialized`, and it gates the cropper and toolbar.
        // Returning past it left a fresh mount with an unusable shell — rendered
        // root, no controls — rather than an editor "without transformations".
        // Idempotent, so the already-initialized path is unaffected.
        this._scheduleInitialization();
        return;
      }
      const originalUrl = serializeFileUrl({ origin: parsed.origin, uuid: parsed.uuid });
      if (originalUrl === editorController.get('*originalUrl')) {
        return;
      }
      editorController.set('*originalUrl', originalUrl);
      editorController.set('*editorTransformations', operationsToTransformations(parsed.operations) as Transformations);
      editorController.set('*sourceOperations', parsed.operations);
    } else if (this.uuid) {
      const cdnCname = editorController.getConfig('cdnCname');
      const originalUrl = serializeFileUrl({ origin: new URL(cdnCname).origin, uuid: this.uuid as string });
      if (originalUrl === editorController.get('*originalUrl')) {
        return;
      }
      editorController.set('*originalUrl', originalUrl);
      if (Object.keys(editorController.get('*editorTransformations')).length > 0) {
        editorController.set('*editorTransformations', {});
      }
      if (editorController.get('*sourceOperations').length > 0) {
        editorController.set('*sourceOperations', []);
      }
    } else {
      throw new Error('No UUID nor CDN URL provided');
    }

    // Drop any in-progress live slider preview so it isn't reapplied to the new
    // image (the fader keys its preview off `*colorPreview`).
    if (editorController.get('*colorPreview')) {
      editorController.set('*colorPreview', null);
    }

    // Clear the size until the new image's info loads below. The cropper and
    // fader take `imageSize` as a prop and self-activate only once it's set, so
    // this keeps them from reactivating with the *previous* image's dimensions
    // (a null→value transition also re-triggers activation even when the new
    // size matches). Both also self-reset on the `*originalUrl` change above.
    this._imageSize = null;

    try {
      const originalUrlValue = editorController.get('*originalUrl') as string;
      const cdnUrl = await this.proxyUrl(
        editorImageInfoUrl(originalUrlValue, editorController.get('*sourceOperations')),
      );
      const json = (await fetch(cdnUrl).then((response) => response.json())) as { width: number; height: number };

      if (!this.isConnected) {
        return;
      }

      const { width, height } = json;
      this._imageSize = { width, height };
    } catch (err) {
      if (err) {
        editorController.telemetry.sendEventError(err, 'cloud editor image. Failed to load image info');
        this._log.error('Failed to load image info', err);
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
      const sourceOperations = editorController.get('*sourceOperations');
      const { cdnUrl, cdnUrlModifiers } = editorAppliedUrl({ originalUrl, transformations, sourceOperations });

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
