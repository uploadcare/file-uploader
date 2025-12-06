import { PubSub } from '@symbiotejs/symbiote';
import { LitElement } from 'lit';
import { blockCtx } from '../abstract/CTX';
import { A11y } from '../abstract/managers/a11y';
import { LocaleManager, localeStateKey } from '../abstract/managers/LocaleManager';
import { ModalManager } from '../abstract/managers/ModalManager';
import { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { sharedConfigKey } from '../abstract/sharedConfigKey';
import { initialConfig } from '../blocks/Config/initialConfig';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import type { ActivityType } from '../lit/LitActivityBlock';
import type { ConfigType } from '../types';
import { extractCdnUrlModifiers, extractFilename, extractUuid } from '../utils/cdn-utils';
import { getLocaleDirection } from '../utils/getLocaleDirection';
import { getPluralForm } from '../utils/getPluralForm';
import { applyTemplateData, getPluralObjects } from '../utils/template-utils';
import { WindowHeightTracker } from '../utils/WindowHeightTracker';
import { CssDataMixin } from './CssDataMixin';
import { LightDomMixin } from './LightDomMixin';
import { RegisterableElementMixin } from './RegisterableElementMixin';
import { SymbioteMixin } from './SymbioteCompatMixin';
import { TestModeController } from './TestModeController';

const LitBlockBase = RegisterableElementMixin(SymbioteMixin(CssDataMixin(LightDomMixin(LitElement))));

export class LitBlock extends LitBlockBase {
  private __cfgProxy!: ConfigType;

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

  public setOrAddState(prop: string, newVal: unknown): void {
    this.add$(
      {
        [prop]: newVal,
      },
      true,
    );
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
    if (!this.has('*blocksRegistry')) {
      this.add('*blocksRegistry', new Set());
    }

    const blocksRegistry = this.$['*blocksRegistry'];
    blocksRegistry.add(this);

    if (!this.has('*eventEmitter')) {
      this.add('*eventEmitter', new EventEmitter(this.debugPrint.bind(this)));
    }
    if (!this.has('*localeManager')) {
      this.add('*localeManager', new LocaleManager(this));
    }

    if (this.cfg.qualityInsights && !this.has('*telemetryManager')) {
      this.add('*telemetryManager', new TelemetryManager(this));
    }

    if (!this.has('*a11y')) {
      this.add('*a11y', new A11y());
    }

    if (!this.has('*modalManager')) {
      this.add('*modalManager', new ModalManager(this));
    }

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
  }

  public get testId(): string {
    const testId = window.customElements.getName(this.constructor as CustomElementConstructor) as string;
    return testId;
  }

  public get modalManager(): ModalManager | undefined {
    return this.has('*modalManager') ? (this.$['*modalManager'] as ModalManager) : undefined;
  }

  public get telemetryManager():
    | TelemetryManager
    | { sendEvent: () => void; sendEventCloudImageEditor: () => void; sendEventError: () => void } {
    if (!this.cfg.qualityInsights) {
      return {
        sendEvent: () => {},
        sendEventCloudImageEditor: () => {},
        sendEventError: () => {},
      };
    }

    return (this.has('*telemetryManager') && this.$['*telemetryManager']) as TelemetryManager;
  }

  public get localeManager(): LocaleManager | null {
    return this.has('*localeManager') ? (this.$['*localeManager'] as LocaleManager) : null;
  }

  public get a11y(): A11y | null {
    return this.has('*a11y') ? (this.$['*a11y'] as A11y) : null;
  }

  protected get blocksRegistry(): Set<LitBlock> {
    return this.$['*blocksRegistry'] as Set<LitBlock>;
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    WindowHeightTracker.unregisterClient(this);

    const blocksRegistry = this.blocksRegistry;
    blocksRegistry?.delete(this);

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
    PubSub.deleteCtx(this.ctxName);

    this.modalManager?.destroy();
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
    if (!this.__cfgProxy) {
      const proxyTarget = {} as ConfigType;
      this.__cfgProxy = new Proxy(proxyTarget, {
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
    return this.__cfgProxy;
  }

  public subConfigValue<T extends keyof ConfigType>(key: T, callback: (value: ConfigType[T]) => void): () => void {
    const sharedKey = sharedConfigKey(key);
    if (!this.has(sharedKey)) {
      this.add(sharedKey, initialConfig[key]);
    }
    return this.sub(sharedKey, callback);
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
