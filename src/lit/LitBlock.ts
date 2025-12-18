import { LitElement } from 'lit';
import { blockCtx } from '../abstract/CTX';
import { A11y } from '../abstract/managers/a11y';
import { LocaleManager, localeStateKey } from '../abstract/managers/LocaleManager';
import { ModalManager } from '../abstract/managers/ModalManager';
import { SecureUploadsManager } from '../abstract/managers/SecureUploadsManager';
import { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { ValidationManager } from '../abstract/managers/ValidationManager';
import { sharedConfigKey } from '../abstract/sharedConfigKey';
import { TypedCollection } from '../abstract/TypedCollection';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { initialUploadEntryData, type UploadEntryData } from '../abstract/uploadEntrySchema';
import { initialConfig } from '../blocks/Config/initialConfig';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import type { ActivityType } from '../lit/LitActivityBlock';
import { PubSub } from '../lit/PubSubCompat';
import type { ConfigType } from '../types';
import { extractCdnUrlModifiers, extractFilename, extractUuid } from '../utils/cdn-utils';
import { getLocaleDirection } from '../utils/getLocaleDirection';
import { applyTemplateData } from '../utils/template-utils';
import { WindowHeightTracker } from '../utils/WindowHeightTracker';
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
  protected _sharedContextInstances: Map<keyof SharedInstancesState, ISharedInstance> = new Map();

  public static styleAttrs: string[] = [];

  public activityType: ActivityType = null;

  public init$ = blockCtx();

  public constructor() {
    super();
    new TestModeController(this);
  }

  public l10n = createL10n(() => this.sharedCtx);
  public debugPrint = createDebugPrinter(() => this.sharedCtx);
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
    this._addSharedContextInstance('*eventEmitter', (sharedInstancesBag) => new EventEmitter(sharedInstancesBag));
    this._addSharedContextInstance('*localeManager', (sharedInstancesBag) => new LocaleManager(sharedInstancesBag));
    this._addSharedContextInstance('*modalManager', (sharedInstancesBag) => new ModalManager(sharedInstancesBag));
    this._addSharedContextInstance('*a11y', () => new A11y());
    this._addSharedContextInstance(
      '*telemetryManager',
      (sharedInstancesBag) => new TelemetryManager(sharedInstancesBag),
    );
    this._addSharedContextInstance('*uploadCollection', () => {
      return new TypedCollection<UploadEntryData>({
        initialValue: initialUploadEntryData,
        watchList: [
          'uploadProgress',
          'uploadError',
          'fileInfo',
          'errors',
          'cdnUrl',
          'isUploading',
          'isValidationPending',
        ],
      });
    });

    this._addSharedContextInstance(
      '*secureUploadsManager',
      (sharedInstancesBag) => new SecureUploadsManager(sharedInstancesBag),
    );
    this._addSharedContextInstance(
      '*validationManager',
      (sharedInstancesBag) => new ValidationManager(sharedInstancesBag),
    );
    this._addSharedContextInstance('*publicApi', (sharedInstancesBag) => new UploaderPublicApi(sharedInstancesBag));

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

  public get modalManager(): ModalManager | null {
    return this._getSharedContextInstance('*modalManager', false);
  }

  public get telemetryManager(): TelemetryManager {
    return this._getSharedContextInstance('*telemetryManager');
  }

  public get localeManager(): LocaleManager {
    return this._getSharedContextInstance('*localeManager');
  }

  public get a11y(): A11y {
    return this._getSharedContextInstance('*a11y');
  }

  public get blocksRegistry(): Set<LitBlock> {
    return this._getSharedContextInstance('*blocksRegistry');
  }

  public get eventEmitter(): EventEmitter {
    return this._getSharedContextInstance('*eventEmitter');
  }

  public get validationManager(): ValidationManager {
    return this._getSharedContextInstance('*validationManager');
  }

  public get api(): UploaderPublicApi {
    return this._getSharedContextInstance('*publicApi');
  }

  public get uploadCollection(): TypedCollection<UploadEntryData> {
    return this._getSharedContextInstance('*uploadCollection');
  }

  public get secureUploadsManager(): SecureUploadsManager {
    return this._getSharedContextInstance('*secureUploadsManager');
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    WindowHeightTracker.unregisterClient(this);

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
  protected destroyCtxCallback(): void {
    this._destroySharedContextInstances();
    PubSub.deleteCtx(this.ctxName);
  }

  /**
   * Adds a shared context instance if it does not exist yet.
   * @param key The shared state key.
   * @param resolver The resolver function that creates the instance.
   */
  private _addSharedContextInstance<TKey extends keyof SharedInstancesState>(
    key: TKey,
    resolver: (sharedInstancesBag: SharedInstancesBag) => NonNullable<SharedInstancesState[TKey]>,
  ): void {
    if (this._sharedContextInstances.has(key)) {
      return;
    }
    if (!this.has(key) || !this.$[key]) {
      const instance = resolver(this._sharedInstancesBag);
      this.add(key, instance, true);
      this._sharedContextInstances.set(key, instance as ISharedInstance);
      return;
    }
  }

  private _destroySharedContextInstances(): void {
    for (const [key, instance] of this._sharedContextInstances.entries()) {
      instance?.destroy?.();
      this.pub(key as keyof SharedState, null as never);
      this._sharedContextInstances.delete(key);
    }
  }

  private _getSharedContextInstance<TKey extends keyof SharedState, TRequired extends boolean = true>(
    key: TKey,
    isRequired: TRequired = true as TRequired,
  ): TRequired extends true ? NonNullable<SharedState[TKey]> : SharedState[TKey] {
    if (this.has(key) && !!this.$[key]) {
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
