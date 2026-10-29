import { ContextConsumer, ContextProvider } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import { parseFileUrl, serializeFileUrl } from '@uploadcare/cdn-url';
import { html, LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { when } from 'lit/directives/when.js';
import { isAbortError } from '../../../abstract/di/Lifetime';
import { logger } from '../../../abstract/logger';
import type { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { resolveSecureDeliveryProxyUrl } from '../../../abstract/secureDeliveryProxyUrl';
import { ctxNameContext } from '../../../lit/ctx-name-context';
import { LightDomMixin } from '../../../lit/LightDomMixin';
import { RegisterableElementMixin } from '../../../lit/RegisterableElementMixin';
import type { SecureDeliveryProxyUrlResolver } from '../../../types';
import { serializeCsv } from '../../../utils/comma-separated';
import { getClosestAspectRatio, parseCropPreset } from '../../../utils/crop/cropPreset';
import { TRANSPARENT_PIXEL_SRC } from '../../../utils/transparentPixelSrc';
import {
  CloudImageEditorController,
  DEFAULT_EDITOR_CONFIG,
  type EditorConfig,
  type EditorServices,
} from './CloudImageEditorController';
import { subscribeUploaderConfigCompat } from './editor-config-compat';
import { AdoptionLifetime, cloudImageEditorContext } from './editor-context';
import { type EditorL10n, resolveEditorL10n } from './editor-locale';
import { editorAppliedUrl, editorImageInfoUrl } from './lib/editorUrls';
import { parseTabs } from './lib/parseTabs.js';
import { operationsToTransformations } from './lib/transformationUtils.js';
import svgIconsSprite from './svg-sprite';
import { ALL_TABS, type TabId } from './toolbar-constants.js';
import type { ApplyResult, CropPresetList, ImageSize, Transformations } from './types';

import './elements/presence-toggle/PresenceToggle';
import './elements/button/BtnUi';
import './EditorImageCropper';
import './EditorImageFader';
import './EditorToolbar';
import './EditorIcon';

type TabIdValue = (typeof TabId)[keyof typeof TabId];

const DEFAULT_TABS = serializeCsv([...ALL_TABS]);

// `SignalWatcher` sits at the base of the mixin chain, as on `ChildBlock` and
// `EditorBlock`, so it wraps `performUpdate` (not `render()`): the root's
// `willUpdate`/`render`/`updated` auto-track the controller state and
// `l10n`/`getConfig` they read, and re-render when it changes.
const CloudImageEditorBlockBase = SignalWatcher(RegisterableElementMixin(LightDomMixin(LitElement)));

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
  private _isInitialized = false;

  // Root-owned, single-child data passed to `<uc-editor-toolbar>` as plain Lit
  // props (not controller state — see `EditorState`).
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
   * (see `EditorState`). Created and provided down the
   * editor DOM tree so descendants (`EditorBlock`) can read/write it
   * directly.
   */
  private readonly _editorController = new CloudImageEditorController();

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: side-effecting @lit/context registration, never read after construction
  private readonly _editorControllerProvider = new ContextProvider(this, {
    context: cloudImageEditorContext,
    initialValue: this._editorController,
  });

  private _configChangeUnsub: (() => void) | undefined;

  // One adoption per connection, ended first thing on disconnect (which also destroys the controller). The root is the
  // provider, not an `EditorBlock`, so it begins and ends its own.
  private readonly _lifetime = new AdoptionLifetime(this._log);

  /**
   * The image container, passed to `<uc-editor-toolbar>` as a plain Lit prop
   * (UI-layer plumbing, not controller state) so it can measure the rendered
   * width for image preloading. Read via `.value`: the container renders before
   * the init-gated toolbar, so the ref is populated by the time the toolbar's
   * prop binding evaluates.
   */
  private readonly _imgContainerRef = createRef<HTMLDivElement>();

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
    this._lifetime.begin();
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
    // Per connection: `disconnectedCallback` ends the lifetime and destroys the controller's listeners, so a
    // reconnected editor (a DOM move) must re-subscribe.
    this.initEditor();
    // The ended lifetime also aborted an image load still in flight, so a reconnect restarts one that hadn't finished.
    // Once `originalUrl` is set, `updateImage` treats the image as loaded, so only its info request is repeated.
    if (this.hasUpdated && !this._imageSize && (this.uuid || this.cdnUrl)) {
      this._lifetime.run(() => (this._editorController.originalUrl ? this._loadImageInfo() : this.updateImage()));
    }
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
        this._editorController.servicesChanged();
      },
      (l10n) => {
        this._compatL10n = l10n;
        this._editorController.servicesChanged();
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
   * telemetry/proxy). Config and telemetry may be supplied
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
      // Precedence: this element's own prop → the removable uploader-config
      // compat bridge → `DEFAULT_EDITOR_CONFIG`. A `null` falls through like
      // `undefined`.
      getConfig: (key) => {
        const own: Partial<EditorConfig> = {
          cdnCname: this.cdnCname,
          secureDeliveryProxy: this.secureDeliveryProxy,
          secureDeliveryProxyUrlResolver: this.secureDeliveryProxyUrlResolver,
          cloudImageEditorMaskHref: this.maskHref,
          testMode: this.testMode,
        };
        return own[key] ?? this._uploaderConfigCompat[key] ?? DEFAULT_EDITOR_CONFIG[key];
      },
      telemetry: {
        sendEvent: (event) =>
          this._emitTelemetry((tm) => tm.sendEvent(event as Parameters<TelemetryManager['sendEvent']>[0])),
        sendEventError: (err, context) =>
          this._emitTelemetry((tm) => tm.sendEventError(err, context as string | undefined)),
        sendActionEvent: (event, node, extra) => this._emitTelemetry((tm) => tm.sendActionEvent(event, node, extra)),
      },
      proxyUrl: (url) => this.proxyUrl(url),
    });

    this._syncTestId();
  }

  /**
   * Mirror `data-testid` from the `testMode` config for e2e/`getByTestId`
   * locators — same contract as `ChildBlock._applyTestMode`, reimplemented
   * here since the root's light base deliberately isn't `ChildBlock`.
   */
  private _syncTestId(): void {
    if (this._editorController.getConfig('testMode')) {
      this.setAttribute('data-testid', this.tagName.toLowerCase());
    } else {
      this.removeAttribute('data-testid');
    }
  }

  private readonly _handleRetryNetwork = (): void => {
    // The image info never arrived, so there is no image to reload yet: ask for it again.
    if (!this._imageSize) {
      this._lifetime.run(() => this._loadImageInfo());
      return;
    }
    const images = this.querySelectorAll('img');
    for (const img of images) {
      const originalSrc = img.src;
      img.src = TRANSPARENT_PIXEL_SRC;
      img.src = originalSrc;
    }
    this._editorController.networkProblems = false;
  };

  /** The `apply`/`change` event detail for `transformations`. */
  private _result(originalUrl: string, transformations: Transformations): ApplyResult {
    const sourceOperations = this._editorController.sourceOperations;
    // Edited in place rather than rebuilt: an operation the editor cannot model
    // keeps its original position, which matters to the CDN for a few pairs
    // (`stretch` applies to a following resize) — enforced by `editorAppliedUrl`
    // composing the operation list once for both `cdnUrl` and `cdnUrlModifiers`.
    const { cdnUrl, cdnUrlModifiers } = editorAppliedUrl({ originalUrl, transformations, sourceOperations });
    return { originalUrl, cdnUrlModifiers, cdnUrl, transformations };
  }

  /** Descendant apply/cancel intents arrive as bubbling `uc-internal:*` events (the controller holds no callbacks). */
  private readonly _handleApply = ({ detail: transformations }: CustomEvent<Transformations>): void => {
    const originalUrl = this._editorController.originalUrl;
    if (!originalUrl) {
      this._log.warn('Original URL is null, cannot apply transformations');
      return;
    }
    try {
      this.dispatchEvent(
        new CustomEvent<ApplyResult>('apply', {
          detail: this._result(originalUrl, transformations),
          bubbles: true,
          composed: true,
        }),
      );
    } catch (err) {
      this._log.error('Failed to apply editor transformations', err);
      return;
    }
    this.remove();
  };

  private readonly _handleCancel = (): void => {
    // Dispatch before removing — once detached the element has no ancestor
    // path, so bubbling listeners on a container/document would miss `cancel`.
    this.dispatchEvent(
      new CustomEvent('cancel', {
        bubbles: true,
        composed: true,
      }),
    );
    this.remove();
  };

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

  /**
   * To proper work, we need non-zero size the element. So, we'll wait for it.
   */
  private _waitForSize(): Promise<void> {
    if (this._pendingSizeWait) {
      return this._pendingSizeWait;
    }
    const { width, height } = this.getBoundingClientRect();
    if (width > 0 && height > 0) {
      return Promise.resolve();
    }

    const TIMEOUT = 3000;
    this._pendingSizeWait = new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeoutId);
        resizeObserver.disconnect();
        this._pendingSizeWait = null;
      };

      const resolveWait = () => {
        cleanup();
        resolve();
      };

      const rejectWait = () => {
        const error = new Error('[cloud-image-editor] timeout waiting for non-zero container size');
        cleanup();
        if (!this._lifetime.signal.aborted) {
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

      resizeObserver.observe(this);
    });

    return this._pendingSizeWait;
  }

  public override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);

    const hasInitialSource = Boolean(this.uuid || this.cdnUrl);
    const alreadyRequested = changedProperties.has('uuid') || changedProperties.has('cdnUrl');
    if (hasInitialSource && !alreadyRequested) {
      this._lifetime.run(() => this.updateImage());
    }
  }

  public override disconnectedCallback(): void {
    this._lifetime.end();
    this._configChangeUnsub?.();
    this._configChangeUnsub = undefined;
    // What the bridge handed over belongs to the ctx this editor leaves, which may be disposed before it reconnects:
    // drop it, so a reconnect buffers telemetry and falls back to the default locale until the next ctx supplies its own.
    this._telemetryManager = undefined;
    this._compatL10n = undefined;
    this._editorController.destroy();
    this._pendingTelemetry = [];

    super.disconnectedCallback();
  }

  public override render() {
    return html`
      ${unsafeSVG(svgIconsSprite)}
      <div
        class="uc-wrapper uc-wrapper_desktop"
        @uc-internal:apply=${this._handleApply}
        @uc-internal:cancel=${this._handleCancel}
      >
        <uc-presence-toggle class="uc-network_problems_splash" .visible=${this._editorController.networkProblems}>
          <div class="uc-network_problems_content">
            <div class="uc-network_problems_icon">
              <uc-editor-icon name="sad"></uc-editor-icon>
            </div>
            <div class="uc-network_problems_text">${this._editorController.l10n('network-error')}</div>
          </div>
          <div class="uc-network_problems_footer">
            <uc-btn-ui theme="primary" .text=${this._editorController.l10n('retry')} @click=${this._handleRetryNetwork}></uc-btn-ui>
          </div>
        </uc-presence-toggle>
        <div class="uc-viewport">
          <div class="uc-image_container" ${ref(this._imgContainerRef)}>
            ${when(
              this._isInitialized,
              () => html`<uc-editor-image-cropper .imageSize=${this._imageSize}></uc-editor-image-cropper>`,
            )}
            <uc-editor-image-fader .imageSize=${this._imageSize}></uc-editor-image-fader>
          </div>
        </div>
        <div class="uc-toolbar">
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
      // Own-prop `testMode` may have just changed the resolved config — re-sync
      // `data-testid` (standalone has no compat-bridge callback to do this, and
      // `_setupEditorController`'s initial sync ran before the prop was applied).
      // Notify descendants that read config through the controller so they
      // re-render on a config-prop change.
      if (this._editorInitialized) {
        this._syncTestId();
        this._editorController.servicesChanged();
      }
    }

    if (changedProperties.has('localeDefinition')) {
      this._editorController.servicesChanged();
    }
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if ((changedProperties.has('uuid') && this.uuid) || (changedProperties.has('cdnUrl') && this.cdnUrl)) {
      this._lifetime.run(() => this.updateImage());
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
        const transformations = operationsToTransformations(parsed.operations);

        if (Array.isArray(transformations.crop?.dimensions)) {
          const [w, h] = transformations.crop.dimensions;
          closest = getClosestAspectRatio(w, h, list, 0.1);
        }
      } catch (err) {
        this._log.debug('Failed to parse CDN URL while syncing the crop preset state', err);
      }
    }

    this._cropPresetList = list;
    this._editorController.currentAspectRatio = closest ?? list?.[0] ?? null;
  }

  public async updateImage(): Promise<void> {
    // `updated` can still run once after disconnect.
    if (this._lifetime.signal.aborted) {
      return;
    }
    try {
      await this._lifetime.guard(this._waitForSize());
    } catch (error) {
      if (isAbortError(error)) throw error;
      // The size wait timed out; `_waitForSize` has logged it.
      return;
    }

    const editorController = this._editorController;

    if (this.cdnUrl) {
      const cdnUrlValue = this.cdnUrl as string;
      // `parseFileUrl` throws for anything that is not a single stored file
      // (a group or delivery-proxy URL); caught locally so a bad `cdn-url`
      // warns and opens the editor without transformations instead of
      // throwing into the `_lifetime.run(() => this.updateImage())` callers.
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
      const originalUrl = serializeFileUrl({ cdnBase: parsed.cdnBase, uuid: parsed.uuid });
      if (originalUrl === editorController.originalUrl) {
        return;
      }
      editorController.originalUrl = originalUrl;
      editorController.editorTransformations = operationsToTransformations(parsed.operations);
      editorController.sourceOperations = parsed.operations;
    } else if (this.uuid) {
      const cdnCname = editorController.getConfig('cdnCname');
      const originalUrl = serializeFileUrl({ cdnBase: new URL(cdnCname).origin, uuid: this.uuid as string });
      if (originalUrl === editorController.originalUrl) {
        return;
      }
      editorController.originalUrl = originalUrl;
      if (Object.keys(editorController.editorTransformations).length > 0) {
        editorController.editorTransformations = {};
      }
      if (editorController.sourceOperations.length > 0) {
        editorController.sourceOperations = [];
      }
    } else {
      throw new Error('No UUID nor CDN URL provided');
    }

    await this._loadImageInfo();
  }

  /** Loads the size of the image `originalUrl` names, then initializes. Retry runs it again after a network error. */
  private async _loadImageInfo(): Promise<void> {
    const editorController = this._editorController;

    // Drop any in-progress live slider preview so it isn't reapplied to the new
    // image (the fader keys its preview off `colorPreview`).
    if (editorController.colorPreview) {
      editorController.colorPreview = null;
    }

    // Clear the size until the new image's info loads below. The cropper and
    // fader take `imageSize` as a prop and self-activate only once it's set, so
    // this keeps them from reactivating with the *previous* image's dimensions
    // (a null→value transition also re-triggers activation even when the new
    // size matches). Both also self-reset on the `originalUrl` change above.
    this._imageSize = null;
    // The flag describes the latest load only: a new image (or a retry) starts without it.
    editorController.networkProblems = false;

    try {
      const originalUrlValue = editorController.originalUrl as string;
      const cdnUrl = await this._lifetime.guard(
        this.proxyUrl(editorImageInfoUrl(originalUrlValue, editorController.sourceOperations)),
      );
      const json = (await this._lifetime.guard(
        fetch(cdnUrl, { signal: this._lifetime.signal }).then((response) => {
          if (!response.ok) {
            throw new Error(`Image info request failed with status ${response.status}`);
          }
          return response.json();
        }),
      )) as { width: number; height: number };

      // The image changed while this request was in flight: its own `updateImage` sets the size and initializes.
      if (editorController.originalUrl !== originalUrlValue) {
        return;
      }
      const { width, height } = json;
      this._imageSize = { width, height };
    } catch (err) {
      // Disconnected mid-request: nothing left to initialize.
      if (isAbortError(err)) {
        return;
      }
      editorController.telemetry.sendEventError(err, 'cloud editor image. Failed to load image info');
      this._log.error('Failed to load image info', err);
      // `fetch` rejects with a TypeError only when the request never got an answer; offer a retry for that. An
      // error status (a missing file, say) won't go away on retry.
      if (err instanceof TypeError) {
        editorController.networkProblems = true;
      }
    }

    this._scheduleInitialization();
  }

  // No size needed here, only for loading an image (`updateImage` waits for one): a container that never gets a size
  // still emits `change`.
  public initEditor(): void {
    this.classList.add('uc-editor_ON');

    const editorController = this._editorController;

    editorController.observe('editorTransformations', (transformations) => {
      if (Object.keys(transformations).length === 0) {
        return;
      }
      this.dispatchEvent(
        new CustomEvent<ApplyResult>('change', {
          detail: this._result(editorController.originalUrl as string, transformations),
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
    /** Internal apply/cancel intents dispatched by descendants (e.g. the toolbar), listened for by the root. */
    'uc-internal:apply': CustomEvent<Transformations>;
    'uc-internal:cancel': CustomEvent<void>;
  }
}
