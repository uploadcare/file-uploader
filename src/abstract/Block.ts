import { BaseComponent, Data } from '@symbiotejs/symbiote';
import { initialConfig } from '../blocks/Config/initialConfig';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import type { ConfigType } from '../types';
import { extractCdnUrlModifiers, extractFilename, extractUuid } from '../utils/cdn-utils';
import { getLocaleDirection } from '../utils/getLocaleDirection';
import { getPluralForm } from '../utils/getPluralForm';
import { applyTemplateData, getPluralObjects } from '../utils/template-utils';
import { WindowHeightTracker } from '../utils/WindowHeightTracker';
import { waitForAttribute } from '../utils/waitForAttribute';
import type { ActivityType } from './ActivityBlock';
import { blockCtx } from './CTX';
import { l10nProcessor } from './l10nProcessor';
import { A11y } from './managers/a11y';
import { LocaleManager, localeStateKey } from './managers/LocaleManager';
import { ModalManager } from './managers/ModalManager';
import { TelemetryManager } from './managers/TelemetryManager';
import { sharedConfigKey } from './sharedConfigKey';
import { testModeProcessor } from './testModeProcessor';

const TAG_PREFIX = 'uc-';

export class Block extends BaseComponent<any> {
  private __cfgProxy?: any;
  protected l10nProcessorSubs: Map<string, Set<{ remove: () => void }>> = new Map();
  static StateConsumerScope: string | null = null;

  static styleAttrs: string[] = [];

  protected requireCtxName = false;

  activityType: ActivityType = null;

  override init$ = blockCtx();

  l10n(str: string, variables: Record<string, string | number> = {}): string {
    if (!str) {
      return '';
    }
    const template = this.$[localeStateKey(str)] || str;
    const pluralObjects = getPluralObjects(template);
    for (const pluralObject of pluralObjects) {
      variables[pluralObject.variable] = this.pluralize(
        pluralObject.pluralKey,
        Number(variables[pluralObject.countVariable]),
      );
    }
    const result = applyTemplateData(template, variables);
    return result;
  }

  private pluralize(key: string, count: number): string {
    const locale = this.l10n('locale-id') || 'en';
    const pluralForm = getPluralForm(locale, count);
    return this.l10n(`${key}__${pluralForm}`);
  }

  protected bindL10n(key: string, resolver: () => void): void {
    this.localeManager?.bindL10n(this, key, resolver);
  }

  constructor() {
    super();
    this.addTemplateProcessor(
      l10nProcessor as (fr: DocumentFragment | BaseComponent<any>, fnCtx: BaseComponent<any>) => void,
    );
    this.addTemplateProcessor(
      testModeProcessor as (fr: DocumentFragment | BaseComponent<any>, fnCtx: BaseComponent<any>) => void,
    );
  }

  emit(
    type: Parameters<EventEmitter['emit']>[0],
    payload?: Parameters<EventEmitter['emit']>[1],
    options?: Parameters<EventEmitter['emit']>[2],
  ): void {
    const eventEmitter = this.has('*eventEmitter') ? this.$['*eventEmitter'] : undefined;
    if (!eventEmitter) {
      return;
    }

    eventEmitter.emit(type, payload, options);

    this.telemetryManager.sendEvent({
      eventType: type,
      payload: typeof payload === 'function' ? payload() : (payload as any),
    });
  }

  hasBlockInCtx(callback: (block: Block) => boolean): boolean {
    for (const block of this.blocksRegistry) {
      if (callback(block)) {
        return true;
      }
    }
    return false;
  }

  setOrAddState(prop: string, newVal: any): void {
    this.add$(
      {
        [prop]: newVal,
      },
      true,
    );
  }

  override connectedCallback(): void {
    const styleAttrs = (this.constructor as any).styleAttrs as string[];
    styleAttrs.forEach((attr: string) => {
      this.setAttribute(attr, '');
    });

    if (this.hasAttribute('retpl')) {
      // @ts-expect-error TODO: fix this
      this.constructor['template'] = null;
      this.processInnerHtml = true;
    }
    if (this.requireCtxName) {
      waitForAttribute({
        element: this as unknown as HTMLElement,
        attribute: 'ctx-name',
        onSuccess: () => {
          // async wait for ctx-name attribute to be set, needed for Angular because it sets attributes after mount
          // TODO: should be moved to the symbiote core
          super.connectedCallback();
        },
        onTimeout: () => {
          console.error('Attribute `ctx-name` is required and it is not set.');
        },
      });
    } else {
      super.connectedCallback();
    }

    WindowHeightTracker.registerClient(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    WindowHeightTracker.unregisterClient(this);
  }

  override initCallback(): void {
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
    });

    this.subConfigValue('testMode', (testMode) => {
      if (!testMode || !this.testId) {
        this.removeAttribute('data-testid');
        return;
      }
      this.setAttribute('data-testid', this.testId);
    });
  }

  get testId(): string {
    const testId = window.customElements.getName(this.constructor as CustomElementConstructor) as string;
    return testId;
  }

  get modalManager(): ModalManager | undefined {
    return (this.has('*modalManager') && this.$['*modalManager']) as ModalManager | undefined;
  }

  get telemetryManager():
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

  protected get localeManager(): LocaleManager | null {
    return this.has('*localeManager') ? (this.$['*localeManager'] as LocaleManager) : null;
  }

  protected get a11y(): A11y | null {
    return this.has('*a11y') ? (this.$['*a11y'] as A11y) : null;
  }

  protected get blocksRegistry(): Set<Block> {
    return this.$['*blocksRegistry'] as Set<Block>;
  }

  override destroyCallback(): void {
    super.destroyCallback();

    const blocksRegistry = this.blocksRegistry;
    blocksRegistry?.delete(this);

    this.localeManager?.destroyL10nBindings(this);
    this.l10nProcessorSubs = new Map();

    // Destroy local context
    // TODO: this should be done inside symbiote
    Data.deleteCtx(this);

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
    Data.deleteCtx(this.ctxName);

    this.localeManager?.destroy();

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

  get cfg(): ConfigType {
    if (!this.__cfgProxy) {
      const o = Object.create(null);
      this.__cfgProxy = new Proxy(o, {
        set: (obj: any, key: string | symbol, value: any) => {
          if (typeof key !== 'string') {
            return false;
          }
          const sharedKey = sharedConfigKey(key as keyof ConfigType);
          if (!this.has(sharedKey)) {
            this.add(sharedKey, (initialConfig as any)[key as keyof typeof initialConfig]);
          }
          (this.$ as any)[sharedKey] = value;
          return true;
        },
        get: (_obj: never, key: keyof ConfigType) => {
          const sharedKey = sharedConfigKey(key);
          if (!this.has(sharedKey)) {
            this.add(sharedKey, initialConfig[key]);
          }
          return (this.$ as any)[sharedConfigKey(key)];
        },
      });
    }
    return this.__cfgProxy;
  }

  subConfigValue<T extends keyof ConfigType>(key: T, callback: (value: ConfigType[T]) => void): void {
    const sharedKey = sharedConfigKey(key);
    if (!this.has(sharedKey)) {
      this.add(sharedKey, initialConfig[key]);
    }
    this.sub(sharedKey, callback);
  }

  debugPrint(...args: unknown[]): void {
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

  static override reg(name?: string): void {
    if (!name) {
      super.reg();
      return;
    }
    if (name.startsWith(TAG_PREFIX)) {
      super.reg(name);
    }
  }
}

export { BaseComponent };
