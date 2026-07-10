import { LitElement } from 'lit';
import { blockCtx } from '../abstract/CTX';
import { RouterController, type RouterControllerDeps } from '../abstract/controllers/RouterController';
import { type UploaderEventKey, type UploaderEventPayload, UploaderEventType } from '../abstract/EventBus';
import { ClipboardLayer } from '../abstract/features/ClipboardLayer';
import { A11y } from '../abstract/managers/a11y';
import { LocaleManager, localeStateKey } from '../abstract/managers/LocaleManager';
import { PluginController } from '../abstract/managers/plugin';
import { buildPluginApi } from '../abstract/managers/plugin/buildPluginApi';
import { LazyPluginLoader } from '../abstract/managers/plugin/LazyPluginLoader';
import { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { sharedConfigKey } from '../abstract/sharedConfigKey';
import { initialConfig } from '../blocks/Config/initialConfig';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import { PubSub } from '../lit/PubSubCompat';
import type { ConfigType } from '../types';
import { extractCdnUrlModifiers, extractFilename, extractUuid } from '../utils/cdn-utils';
import { getLocaleDirection } from '../utils/getLocaleDirection';
import { applyTemplateData } from '../utils/template-utils';
import { WindowHeightTracker } from '../utils/WindowHeightTracker';
import type { ActivityId } from './activity-constants';
import { CssDataMixin } from './CssDataMixin';
import { createDebugPrinter } from './createDebugPrinter';
import { LightDomMixin } from './LightDomMixin';
import { createL10n } from './l10n';
import { RegisterableElementMixin } from './RegisterableElementMixin';
import type { SharedState } from './SharedState';
import { SymbioteMixin } from './SymbioteCompatMixin';
import {
  createSharedInstancesBag,
  type ISharedInstance,
  type SharedInstancesBag,
  type SharedInstancesState,
} from './shared-instances';
import { TestModeController } from './TestModeController';

const LitBlockBase = RegisterableElementMixin(SymbioteMixin<SharedState>()(CssDataMixin(LightDomMixin(LitElement))));

export class LitBlock extends LitBlockBase {
  private _cfgProxy!: ConfigType;

  public static styleAttrs: string[] = [];

  public init$ = blockCtx();

  public constructor() {
    super();
    new TestModeController(this);
  }

  public l10n = createL10n(() => this.sharedCtx);
  public debugPrint = createDebugPrinter(() => this.sharedCtx, this.constructor.name);
  protected _sharedInstancesBag = createSharedInstancesBag(() => this.sharedCtx);

  public emit(
    type: Parameters<EventEmitter['emit']>[0],
    payload?: Parameters<EventEmitter['emit']>[1],
    options?: Parameters<EventEmitter['emit']>[2],
  ): void {
    const eventEmitter = this.has('*eventEmitter') ? this.$['*eventEmitter'] : undefined;
    if (!eventEmitter) {
      return;
    }

    eventEmitter.emit(type, payload, options);

    const resolvedPayload = typeof payload === 'function' ? payload() : payload;

    this.telemetryManager.sendEvent({
      eventType: type,
      payload: (resolvedPayload ?? undefined) as Record<string, unknown> | undefined,
    });
  }

  public hasBlockInCtx(callback: (block: LitBlock) => boolean): boolean {
    for (const block of this.blocksRegistry) {
      if (callback(block)) {
        return true;
      }
    }
    return false;
  }

  public override connectedCallback(): void {
    const styleAttrs = (this.constructor as typeof LitBlock).styleAttrs;
    styleAttrs.forEach((attr: string) => {
      this.setAttribute(attr, '');
    });

    super.connectedCallback();

    WindowHeightTracker.registerClient(this);
  }

  public override initCallback(): void {
    this._addSharedContextInstance('*blocksRegistry', () => new Set());
    this._addSharedContextInstance(
      '*pluginManager',
      (sharedInstancesBag) =>
        new PluginController({
          buildApi: (registry, pluginId, configSubscriptions) =>
            buildPluginApi(registry, sharedInstancesBag.ctx, sharedInstancesBag, pluginId, configSubscriptions),
          getUploaderApi: () => sharedInstancesBag.api,
          watchPlugins: (onCompute) => {
            const loader = new LazyPluginLoader(sharedInstancesBag.ctx, onCompute);
            return () => loader.destroy();
          },
          // Scope debug output to the controller (not the hosting block) so its
          // logs stay consistently prefixed, as v1's SharedInstance did.
          debug: createDebugPrinter(() => sharedInstancesBag.ctx, 'PluginController'),
        }),
    );
    this._addSharedContextInstance('*eventEmitter', (sharedInstancesBag) => new EventEmitter(sharedInstancesBag));
    this._addSharedContextInstance('*localeManager', (sharedInstancesBag) => new LocaleManager(sharedInstancesBag));
    this._addSharedContextInstance('*a11y', () => new A11y());
    this._addSharedContextInstance('*router', () => new RouterController({ emit: this._routerEmit }));
    this._addSharedContextInstance('*clipboard', (sharedInstancesBag) => new ClipboardLayer(sharedInstancesBag));
    this._addSharedContextInstance(
      '*telemetryManager',
      (sharedInstancesBag) => new TelemetryManager(sharedInstancesBag),
    );

    this.sub(localeStateKey('locale-id'), (localeId: string) => {
      const direction = getLocaleDirection(localeId);
      this.style.direction = direction === 'ltr' ? '' : direction;
      this.requestUpdate();
    });

    this.subConfigValue('testMode', (testMode) => {
      if (!testMode || !this.testId) {
        this.removeAttribute('data-testid');
        return;
      }
      this.setAttribute('data-testid', this.testId);
    });

    this.blocksRegistry.add(this);
  }

  public get testId(): string {
    const testId = window.customElements.getName(this.constructor as CustomElementConstructor) as string;
    return testId;
  }

  public get router(): RouterController {
    return this._getSharedContextInstance('*router');
  }

  /**
   * Telemetry-augmented emit, narrowed to the router's documented payloads and
   * matching v1's debounce behavior (modal events debounce; activity-change
   * fires immediately). Injected into the {@link RouterController}.
   */
  private _routerEmit: RouterControllerDeps['emit'] = (
    type: UploaderEventKey,
    payload: UploaderEventPayload[UploaderEventKey],
  ): void => {
    const debounce = type === UploaderEventType.MODAL_OPEN || type === UploaderEventType.MODAL_CLOSE;
    // `this.emit` already accepts the widened `(UploaderEventKey, payload)` union
    // that the field's `RouterEmit` type funnels down to, so no cast is needed —
    // and it must stay a bound method call (`this.emit`, not an extracted ref) so
    // it keeps its `this` when the router invokes it.
    this.emit(type, payload, debounce ? { debounce: true } : undefined);
  };

  /**
   * Subscribe to a value derived from router state: fires immediately with
   * the current value, then on every change (reference dedup). All the
   * `sub*` router helpers are one-liners over this. Auto-cleaned on
   * disconnect.
   */
  private _subRouterDerived<T>(select: () => T, cb: (value: T) => void): () => void {
    let last = select();
    cb(last);
    const unsub = this.router.subscribe(() => {
      const next = select();
      if (next !== last) {
        last = next;
        cb(next);
      }
    });
    this._routerUnsubs.add(unsub);
    return unsub;
  }

  /**
   * Subscribe to the effective current activity (foreground modal, else
   * background). Fires immediately with the current value, then on every
   * change. Replaces `this.sub('*currentActivity', cb)`. Auto-cleaned on
   * disconnect.
   */
  protected subActivity(cb: (activity: ActivityId | null) => void): () => void {
    return this._subRouterDerived(() => this.router.currentActivity, cb);
  }

  /** Subscribe to the current activity params. Fires immediately + on change. */
  protected subActivityParams(cb: (params: Readonly<Record<string, unknown>>) => void): () => void {
    return this._subRouterDerived(() => this.router.params, cb);
  }

  /**
   * Subscribe to *any* router change (slot or params). Fires immediately, then
   * on every notification — no value dedup. Use when a reader depends on a slot
   * the effective-activity dedup would hide (e.g. a modal opening on the id
   * that's already the background activity). Auto-cleaned on disconnect.
   */
  protected subRouter(cb: () => void): () => void {
    cb();
    const unsub = this.router.subscribe(cb);
    this._routerUnsubs.add(unsub);
    return unsub;
  }

  private _routerUnsubs = new Set<() => void>();

  public get telemetryManager(): TelemetryManager {
    return this._getSharedContextInstance('*telemetryManager');
  }

  public get localeManager(): LocaleManager {
    return this._getSharedContextInstance('*localeManager');
  }

  public get a11y(): A11y {
    return this._getSharedContextInstance('*a11y');
  }

  public get clipboardLayer(): ClipboardLayer {
    return this._getSharedContextInstance('*clipboard');
  }

  public get blocksRegistry(): Set<LitBlock> {
    return this._getSharedContextInstance('*blocksRegistry');
  }

  public get eventEmitter(): EventEmitter {
    return this._getSharedContextInstance('*eventEmitter');
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    WindowHeightTracker.unregisterClient(this);

    for (const unsub of this._routerUnsubs) unsub();
    this._routerUnsubs.clear();

    const blocksRegistry = this.blocksRegistry;
    blocksRegistry?.delete(this);

    if (blocksRegistry?.size === 0) {
      setTimeout(() => {
        if (this.isConnected || blocksRegistry?.size > 0) {
          return;
        }
        // Destroy global context after all blocks are destroyed and all callbacks are run
        this.destroyCtxCallback();
      }, 0);
    }
  }

  /**
   * Called when the last block is removed from the context. Note that inheritors must run their callback before that.
   */
  private destroyCtxCallback(): void {
    this._destroySharedContextInstances();
    PubSub.deleteCtx(this.ctxName);
  }

  private _getSharedContextInstances(): Map<string, ISharedInstance> {
    const key = '*sharedContextInstances';
    if (!this.has(key) || !this.$[key]) {
      const map = new Map<string, ISharedInstance>();
      this.add(key, map, true);
    }
    return this.$[key];
  }

  protected _addSharedContextInstance<TKey extends keyof SharedInstancesState>(
    key: TKey,
    resolver: (sharedInstancesBag: SharedInstancesBag) => NonNullable<SharedInstancesState[TKey]>,
  ): void {
    const instances = this._getSharedContextInstances();
    if (instances.has(key)) {
      return;
    }
    if (!this.has(key) || !this.$[key]) {
      const instance = resolver(this._sharedInstancesBag);
      this.add(key, instance, true);
      instances.set(key, instance as ISharedInstance);
      return;
    }
  }

  private _destroySharedContextInstances(): void {
    const instances = this._getSharedContextInstances();
    for (const [key, instance] of instances.entries()) {
      instance?.destroy?.();
      this.pub(key as keyof SharedState, null as never);
    }
    instances.clear();
  }

  protected _getSharedContextInstance<TKey extends keyof SharedState, TRequired extends boolean = true>(
    key: TKey,
    isRequired: TRequired = true as TRequired,
  ): TRequired extends true ? NonNullable<SharedState[TKey]> : SharedState[TKey] {
    if (this.has(key) && this.$[key]) {
      return this.$[key] as NonNullable<SharedState[TKey]>;
    }

    if (!isRequired) {
      return this.$[key] as TRequired extends true ? NonNullable<SharedState[TKey]> : SharedState[TKey];
    }

    throw new Error(`Unexpected error: context manager for key "${String(key)}" is not available`);
  }

  protected async proxyUrl(url: string): Promise<string> {
    if (this.cfg.secureDeliveryProxy && this.cfg.secureDeliveryProxyUrlResolver) {
      console.warn(
        'Both secureDeliveryProxy and secureDeliveryProxyUrlResolver are set. The secureDeliveryProxyUrlResolver will be used.',
      );
    }
    if (this.cfg.secureDeliveryProxyUrlResolver) {
      try {
        return await this.cfg.secureDeliveryProxyUrlResolver(url, {
          uuid: extractUuid(url),
          cdnUrlModifiers: extractCdnUrlModifiers(url),
          fileName: extractFilename(url),
        });
      } catch (err) {
        console.error('Failed to resolve secure delivery proxy URL. Falling back to the default URL.', err);
        this.telemetryManager.sendEventError(
          err,
          'secureDeliveryProxyUrlResolver. Failed to resolve secure delivery proxy URL. Falling back to the default URL.',
        );
        return url;
      }
    }
    if (this.cfg.secureDeliveryProxy) {
      return applyTemplateData(
        this.cfg.secureDeliveryProxy,
        { previewUrl: url },
        { transform: (value) => window.encodeURIComponent(value) },
      );
    }
    return url;
  }

  public get cfg(): ConfigType {
    if (!this._cfgProxy) {
      const proxyTarget = {} as ConfigType;
      this._cfgProxy = new Proxy(proxyTarget, {
        set: (_obj: ConfigType, key: string | symbol, value: unknown) => {
          if (typeof key !== 'string' || !(key in initialConfig)) {
            return false;
          }
          const typedKey = key as keyof ConfigType;
          const sharedKey = sharedConfigKey(typedKey);
          if (!this.has(sharedKey)) {
            this.add(sharedKey, initialConfig[typedKey]);
          }
          (this.$ as Record<string, unknown>)[sharedKey] = value;
          return true;
        },
        get: (_obj: ConfigType, key: keyof ConfigType) => {
          const sharedKey = sharedConfigKey(key);
          if (!this.has(sharedKey)) {
            this.add(sharedKey, initialConfig[key]);
          }
          return (this.$ as Record<string, unknown>)[sharedKey] as ConfigType[typeof key];
        },
      });
    }
    return this._cfgProxy;
  }

  public subConfigValue<T extends keyof ConfigType>(key: T, callback: (value: ConfigType[T]) => void): () => void {
    const sharedKey = sharedConfigKey(key);
    if (!this.has(sharedKey)) {
      this.add(sharedKey, initialConfig[key] as unknown as SharedState[typeof sharedKey]);
    }
    return this.sub(sharedKey as any, callback as any);
  }
}
