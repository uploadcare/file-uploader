import { LitElement } from 'lit';
import { blockCtx } from '../abstract/CTX';
import { A11y } from '../abstract/managers/a11y';
import { LocaleManager, localeStateKey } from '../abstract/managers/LocaleManager';
import { ModalManager } from '../abstract/managers/ModalManager';
import { type ITelemetryManager, TelemetryManager } from '../abstract/managers/TelemetryManager';
import { sharedConfigKey } from '../abstract/sharedConfigKey';
import { initialConfig } from '../blocks/Config/initialConfig';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import type { ActivityType } from '../lit/LitActivityBlock';
import { PubSub } from '../lit/PubSubCompat';
import type { ConfigType } from '../types';
import { extractCdnUrlModifiers, extractFilename, extractUuid } from '../utils/cdn-utils';
import { getLocaleDirection } from '../utils/getLocaleDirection';
import { getPluralForm } from '../utils/getPluralForm';
import { applyTemplateData, getPluralObjects } from '../utils/template-utils';
import { WindowHeightTracker } from '../utils/WindowHeightTracker';
import { CssDataMixin } from './CssDataMixin';
import { LightDomMixin } from './LightDomMixin';
import { RegisterableElementMixin } from './RegisterableElementMixin';
import type { SharedState } from './SharedState';
import { SymbioteMixin } from './SymbioteCompatMixin';
import { TestModeController } from './TestModeController';

interface SharedContextInstance {
  destroy?(): void;
}

const LitBlockBase = RegisterableElementMixin(SymbioteMixin<SharedState>()(CssDataMixin(LightDomMixin(LitElement))));
export class LitBlock extends LitBlockBase {
  private _cfgProxy!: ConfigType;
  private _sharedContextInstances: Map<
    keyof SharedState,
    {
      persist: boolean;
      instance: SharedContextInstance;
    }
  > = new Map();

  public static styleAttrs: string[] = [];

  public activityType: ActivityType = null;

  public init$ = blockCtx();

  public constructor() {
    super();
    new TestModeController(this);
  }

  public l10n(str: string, variables: Record<string, string | number> = {}): string {
    if (!str) {
      return '';
    }
    const template = this.$[localeStateKey(str)] || str;
    const pluralObjects = getPluralObjects(template);
    for (const pluralObject of pluralObjects) {
      variables[pluralObject.variable] = this._pluralize(
        pluralObject.pluralKey,
        Number(variables[pluralObject.countVariable]),
      );
    }
    const result = applyTemplateData(template, variables);
    return result;
  }

  private _pluralize(key: string, count: number): string {
    const locale = this.l10n('locale-id') || 'en';
    const pluralForm = getPluralForm(locale, count);
    return this.l10n(`${key}__${pluralForm}`);
  }

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

  public setOrAddState<TKey extends keyof SharedState>(prop: TKey, newVal: SharedState[TKey]): void {
    this.add(prop, newVal, true);
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
    this.addSharedContextInstance('*blocksRegistry', () => new Set(), {
      persist: true,
    });
    this.addSharedContextInstance('*eventEmitter', () => new EventEmitter(this.debugPrint.bind(this)));
    this.addSharedContextInstance('*localeManager', () => new LocaleManager(this));
    this.addSharedContextInstance('*modalManager', () => new ModalManager(this));
    this.addSharedContextInstance('*a11y', () => new A11y(), {
      persist: true,
    });
    this.addSharedContextInstance('*telemetryManager', () => {
      if (this.cfg.qualityInsights) {
        return new TelemetryManager(this);
      }
      return {
        sendEvent: () => {},
        sendEventError: () => {},
        sendEventCloudImageEditor: () => {},
      } as ITelemetryManager;
    });

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
    return this.getSharedContextInstance('*modalManager', false);
  }

  public get telemetryManager(): ITelemetryManager {
    return this.getSharedContextInstance('*telemetryManager');
  }

  public get localeManager(): LocaleManager {
    return this.getSharedContextInstance('*localeManager');
  }

  public get a11y(): A11y {
    return this.getSharedContextInstance('*a11y');
  }

  public get blocksRegistry(): Set<LitBlock> {
    return this.getSharedContextInstance('*blocksRegistry');
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    WindowHeightTracker.unregisterClient(this);

    const blocksRegistry = this.blocksRegistry;
    blocksRegistry?.delete(this);

    this._destroySharedContextInstances();

    if (blocksRegistry?.size === 0) {
      setTimeout(() => {
        // Destroy global context after all blocks are destroyed and all callbacks are run
        this.destroyCtxCallback();
      }, 0);
    }
  }

  /**
   * Called when the last block is removed from the context. Note that inheritors must run their callback before that.
   */
  protected destroyCtxCallback(): void {
    this._destroySharedContextInstances(true);
    PubSub.deleteCtx(this.ctxName);
  }

  /**
   * Adds a shared context instance if it does not exist yet.
   * @param key The shared state key.
   * @param resolver The resolver function that creates the instance.
   * @param persist Whether to persist the instance in the context if the bound block is removed. It's usually needed for those instances that depends on the current block. Defaults to false.
   */
  protected addSharedContextInstance<TKey extends keyof SharedState>(
    key: TKey,
    resolver: () => SharedState[TKey],
    { persist = false } = {},
  ): void {
    if (this._sharedContextInstances.has(key)) {
      return;
    }
    if (!this.has(key)) {
      const managerInstance = resolver();
      this.add(key, managerInstance);
      this._sharedContextInstances.set(key, { persist, instance: managerInstance });
      return;
    }

    if (!this.$[key]) {
      const managerInstance = resolver();
      this.pub(key, managerInstance);
      this._sharedContextInstances.set(key, { persist, instance: managerInstance });
    }
  }

  private _destroySharedContextInstances(destroyPersisted = false): void {
    for (const [key, item] of this._sharedContextInstances.entries()) {
      const { persist, instance } = item;
      if (persist && !destroyPersisted) {
        continue;
      }
      instance?.destroy?.();
      this.pub(key as keyof SharedState, null as never);
      this._sharedContextInstances.delete(key);
    }
  }

  protected getSharedContextInstance<TKey extends keyof SharedState, TRequired extends boolean = true>(
    key: TKey,
    isRequired: TRequired = true as TRequired,
  ): TRequired extends true ? NonNullable<SharedState[TKey]> : SharedState[TKey] {
    if (this.has(key) && !!this.$[key]) {
      return this.$[key] as NonNullable<SharedState[TKey]>;
    }

    if (!isRequired) {
      return this.$[key] as SharedState[TKey];
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
    return this.sub(sharedKey as any, callback);
  }

  public debugPrint(...args: unknown[]): void {
    if (!this.cfg.debug) {
      return;
    }
    let consoleArgs = args;
    if (typeof args?.[0] === 'function') {
      const resolver = args[0] as () => unknown[];
      consoleArgs = resolver();
    }
    console.log(`[${this.ctxName}]`, ...consoleArgs);
  }
}
