import { ContextProvider } from '@lit/context';
import { html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import svgIconsSprite from '../blocks/themes/uc-basic/svg-sprite';
import { LightDomMixin } from '../lit/LightDomMixin';
import { ExternalUploadSource, UploadSource } from '../utils/UploadSource';
import type { ActivityId } from './activity-ids';
import { uploaderContext } from './context';
import type { UploaderApi } from './UploaderApi';
import './uploader.css';
import type { PluginDefinition } from './controllers/PluginRegistryController';
import { UploaderController } from './controllers/UploaderController';
import type { UploaderEventKey, UploaderEventPayload } from './EventBus';
import { UploaderRegistry } from './UploaderRegistry';
import { bindConfigToElement, bindEventBusToElement } from './ui-adapters';

/**
 * Base v2 element. Provides the v2 architecture surface (controller,
 * api, plugin install, events, ctx-name registry) and renders the v1
 * solution-element subtree for unmigrated parts (drop-area, etc.). Each
 * preset subclass overrides `renderV1Tree()` to pick the solution tag.
 *
 * Config + plugins flow directly into `controller.config` /
 * `controller.plugins` — no `<uc-config>` sibling, no attribute
 * forwarding. The v1 elements that still mount inside `renderV1Tree`
 * fall back to their own defaults.
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: declaration merging with the interface below is intentional — it adds typed `addEventListener` overloads for v2 uploader events without breaking the class shape.
export class Uploader extends LightDomMixin(LitElement) {
  /**
   * v1-parity host attributes — `[uc-wgt-common]` for the theme's
   * global CSS variables. Preset subclasses extend with their own
   * scope attribute (e.g. `uc-file-uploader-regular`) by overriding
   * this list.
   */
  public static styleAttrs: string[] = ['uc-wgt-common'];

  /**
   * v1-compat — frozen copy of `ExternalUploadSource`. Consumer code
   * uses `LitUploaderBlock.extSrcList.DROPBOX` etc. The enum value is
   * preserved here so the same access pattern works on any preset.
   *
   * @deprecated Import `ExternalUploadSource` from the package directly.
   */
  public static readonly extSrcList = Object.freeze({ ...ExternalUploadSource });

  /**
   * v1-compat — frozen copy of `UploadSource`. See `extSrcList`.
   *
   * @deprecated Import `UploadSource` from the package directly.
   */
  public static readonly sourceTypes = Object.freeze({ ...UploadSource });

  @property({ attribute: 'ctx-name' })
  public ctxName: string | undefined;

  @property({ attribute: false })
  public plugins: PluginDefinition[] = [];

  public readonly controller = new UploaderController();
  public readonly api = this.controller.api;

  /**
   * v1-compat alias for `.api`. Returns the same `UploaderApi` facade.
   *
   * @deprecated Use `element.api` directly. Removed in next major version.
   */
  public getAPI(): UploaderApi {
    return this.controller.api;
  }

  /**
   * v1-compat — read-only view of the underlying upload collection. The
   * returned value is v2's `UploadCollectionController`, NOT v1's
   * `TypedCollection`; the two share `size` and `clearAll` semantics but
   * have different read APIs. Prefer `element.api.getItems()` and
   * `element.api.on('change', …)` in new code.
   *
   * @deprecated Use `element.api.getItems()` instead.
   */
  public get uploadCollection() {
    return this.controller.collection;
  }

  private _provider?: ContextProvider<typeof uploaderContext, this>;
  private _registered = false;
  private _teardown: Array<() => void> = [];
  private _installedPluginIds = new Set<string>();
  private _configInstalledPluginIds = new Set<string>();

  public override connectedCallback(): void {
    super.connectedCallback();
    const ctor = this.constructor as typeof Uploader;
    for (const attr of ctor.styleAttrs) {
      if (!this.hasAttribute(attr)) this.setAttribute(attr, '');
    }
    if (!this._provider) {
      this._provider = new ContextProvider(this, {
        context: uploaderContext,
        initialValue: this.controller,
      });
    }
    if (this.ctxName) this._registerCtxName();

    // Install the preset-specific routing strategy before plugins fire
    // any router.navigate() calls during install.
    this.controller.router.navigationStrategy = (to) => this.navigationSlotFor(to);

    this._teardown.push(bindConfigToElement(this, this.controller.config));
    this._teardown.push(bindEventBusToElement(this, this.controller.events));

    // Register this element as a clipboard-paste scope; the controller attaches
    // the window `paste` listener while connected and removes it on teardown.
    this._teardown.push(this.controller.clipboard.registerScope(this));
    // Watch `config.plugins` for changes — `<uc-config plugins>` writes
    // them through the controller, not via the `plugins` Lit property.
    // The shapes differ between v1 `UploaderPlugin` and v2 `PluginDefinition`;
    // the cast trusts the consumer-supplied object to satisfy v2's contract.
    this._teardown.push(
      this.controller.config.subscribe(() => {
        const fromConfig = this.controller.config.values.plugins;
        const next = Array.isArray(fromConfig) ? (fromConfig as unknown as PluginDefinition[]) : [];
        const nextIds = new Set(next.map((p) => p.id));
        // Only manage plugins that came in through config — `.plugins` Lit
        // property installs (default plugins) are owned by `_installPlugins`.
        for (const id of Array.from(this._configInstalledPluginIds)) {
          if (!nextIds.has(id)) {
            this.controller.plugins.uninstall(id);
            this._configInstalledPluginIds.delete(id);
            this._installedPluginIds.delete(id);
          }
        }
        for (const plugin of next) {
          if (!plugin.id) {
            console.warn(`[v2/plugins] Plugin is missing required "id" field. Skipping.`);
            continue;
          }
          if (this._installedPluginIds.has(plugin.id)) {
            console.warn(`[v2/plugins] Plugin "${plugin.id}" is a duplicate — already installed. Skipping.`);
            continue;
          }
          this.controller.install(plugin);
          this._installedPluginIds.add(plugin.id);
          this._configInstalledPluginIds.add(plugin.id);
        }
      }),
    );
    this._installPlugins();
    this._initActivity();
    // v1-compat: reflect tag as `data-testid` when `config.testMode` is on.
    const syncTestId = (): void => {
      const cfg = this.controller.config.values as { testMode?: boolean };
      if (cfg.testMode) {
        this.setAttribute('data-testid', this.tagName.toLowerCase());
      } else {
        this.removeAttribute('data-testid');
      }
    };
    this._teardown.push(this.controller.config.subscribe(syncTestId));
    syncTestId();
  }

  /**
   * Subclass-hook for the activity that should be active when the
   * uploader first appears with no router state. Returning `null` keeps
   * the modal closed (regular preset). Inline / minimal presets return
   * `start-from` so the picker is visible by default.
   */
  protected initialActivity(): ActivityId | null {
    return null;
  }

  /**
   * Subclass-hook: when navigating to `to`, should it land in the
   * background (inline) or foreground (modal) slot? See
   * `RouterController.navigationStrategy` for the per-preset semantics.
   * Default is background — appropriate for inline-style presets with
   * no modals.
   */
  protected navigationSlotFor(_to: ActivityId): 'background' | 'foreground' {
    return 'background';
  }

  /**
   * Inline / minimal presets auto-switch to `upload-list` once the
   * collection is non-empty, and bounce back to the initial activity
   * once it empties (unless `showEmptyList` is set). Matches v1's
   * `FileUploaderInline.initCallback` behavior.
   */
  private _initActivity(): void {
    const initial = this.initialActivity();
    if (initial === null) return;
    const { router, collection, config } = this.controller;
    // Use `setActivity` (not `navigate`) so the background slot updates
    // without auto-opening a modal — the trigger is visible from the
    // start, the modal stays closed until the user clicks.
    if (router.activity === null) router.setActivity(initial);

    const sync = (): void => {
      const hasFiles = collection.size > 0;
      const cfg = config.values as { showEmptyList?: boolean };
      if (hasFiles && router.activity === initial) {
        router.setActivity('upload-list');
        // Close any modal that was open — once files exist, the inline
        // upload-list is the relevant view (minimal/inline have no
        // upload-list modal).
        router.closeModal();
      } else if (!hasFiles && router.activity === 'upload-list' && !cfg.showEmptyList) {
        router.setActivity(initial);
      }
    };
    this._teardown.push(collection.subscribe(sync));
  }

  public override willUpdate(changed: Map<string, unknown>): void {
    super.willUpdate?.(changed as never);
    if (this.ctxName && !this._registered) this._registerCtxName();
    if (changed.has('plugins')) this._installPlugins();
  }

  private _installPlugins(): void {
    for (const plugin of this.plugins) {
      if (this._installedPluginIds.has(plugin.id)) continue;
      this.controller.install(plugin);
      this._installedPluginIds.add(plugin.id);
    }
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const fn of this._teardown) fn();
    this._teardown = [];
    setTimeout(() => {
      if (!this.isConnected && this.ctxName && this._registered) {
        for (const id of Array.from(this._installedPluginIds)) {
          this.controller.plugins.uninstall(id);
        }
        this._installedPluginIds.clear();
        this._configInstalledPluginIds.clear();
        UploaderRegistry.unregister(this.ctxName, this.controller);
        this._registered = false;
      }
    }, 0);
  }

  private _registerCtxName(): void {
    if (!this.ctxName) return;
    UploaderRegistry.register(this.ctxName, this.controller);
    this._registered = true;
  }

  public override render() {
    if (!this.ctxName) return html`${this.yield('')}`;
    // Inject the SVG icon sprite once so `<uc-icon>` references resolve.
    return html`${unsafeSVG(svgIconsSprite)}${this.renderLayout()}`;
  }

  /** Subclasses override to render the preset-specific layout. */
  protected renderLayout(): unknown {
    return nothing;
  }
}

type EventListenerMap = {
  [K in UploaderEventKey]: (e: CustomEvent<UploaderEventPayload[K]>) => void;
};

export interface Uploader extends LitElement {
  addEventListener<K extends keyof EventListenerMap>(
    type: K,
    listener: EventListenerMap[K],
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

if (!customElements.get('uc-uploader')) customElements.define('uc-uploader', Uploader);

declare global {
  interface HTMLElementTagNameMap {
    'uc-uploader': Uploader;
  }
}
