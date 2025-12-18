import type { ConfigType, UploaderPublicApi } from '..';
import type { A11y } from '../abstract/managers/a11y';
import type { LocaleManager } from '../abstract/managers/LocaleManager';
import type { ModalManager } from '../abstract/managers/ModalManager';
import type { SecureUploadsManager } from '../abstract/managers/SecureUploadsManager';
import type { TelemetryManager } from '../abstract/managers/TelemetryManager';
import type { ValidationManager } from '../abstract/managers/ValidationManager';
import { sharedConfigKey } from '../abstract/sharedConfigKey';
import type { TypedCollection } from '../abstract/TypedCollection';
import type { UploadEntryData } from '../abstract/uploadEntrySchema';
import type { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import { createDebugPrinter } from './createDebugPrinter';
import type { LitBlock } from './LitBlock';
import type { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';

export interface ISharedInstance {
  destroy?(): void;
}

export class SharedInstance {
  protected _ctx: PubSub<SharedState>;
  protected _sharedInstancesBag: SharedInstancesBag;

  private _subscriptions: Set<() => void> = new Set();
  private _cfgProxy: ConfigType | null = null;
  protected _debugPrint = createDebugPrinter(() => this._sharedInstancesBag.ctx, this.constructor.name);

  public constructor(sharedInstancesBag: SharedInstancesBag) {
    this._sharedInstancesBag = sharedInstancesBag;
    this._ctx = sharedInstancesBag.ctx;
  }

  protected addSub(unsub: () => void): void {
    this._subscriptions.add(unsub);
  }

  protected get _cfg(): Readonly<ConfigType> {
    if (!this._cfgProxy) {
      const proxyTarget = {} as ConfigType;
      this._cfgProxy = new Proxy(proxyTarget, {
        set: () => {
          throw new Error('SharedInstance cfg proxy is read-only');
        },
        get: (_obj: ConfigType, key: keyof ConfigType) => {
          const sharedKey = sharedConfigKey(key);
          if (!this._sharedInstancesBag.ctx.has(sharedKey)) {
            return;
          }
          return this._sharedInstancesBag.ctx.read(sharedKey);
        },
      });
    }
    return this._cfgProxy;
  }

  public destroy(): void {
    for (const unsub of this._subscriptions) {
      try {
        unsub();
      } catch {
        // Ignore cleanup errors
      }
    }
    this._subscriptions.clear();
  }
}

export type SharedInstancesState = Pick<
  SharedState,
  | '*blocksRegistry'
  | '*eventEmitter'
  | '*localeManager'
  | '*telemetryManager'
  | '*a11y'
  | '*modalManager'
  | '*uploadCollection'
  | '*publicApi'
  | '*validationManager'
  | '*secureUploadsManager'
>;

export type SharedInstancesBag = ReturnType<typeof createSharedInstancesBag>;

export const getSharedInstance = <TKey extends keyof SharedInstancesState, TRequired extends boolean = true>(
  ctx: PubSub<SharedState>,
  key: TKey,
  isRequired: TRequired = true as TRequired,
): TRequired extends true ? NonNullable<SharedInstancesState[TKey]> : SharedInstancesState[TKey] => {
  const hasKey = ctx.has(key);
  const value = hasKey ? ctx.read(key) : null;

  if (hasKey && !!value) {
    return value as TRequired extends true ? NonNullable<SharedInstancesState[TKey]> : SharedInstancesState[TKey];
  }

  if (!isRequired) {
    return value as TRequired extends true ? NonNullable<SharedInstancesState[TKey]> : SharedInstancesState[TKey];
  }

  throw new Error(`Unexpected error: shared instance for key "${String(key)}" is not available`);
};

export const createSharedInstancesBag = (getCtx: () => PubSub<SharedState>) => {
  return {
    get ctx(): PubSub<SharedState> {
      return getCtx();
    },
    get modalManager(): ModalManager | null {
      return getSharedInstance(getCtx(), '*modalManager', false);
    },
    get telemetryManager(): TelemetryManager {
      return getSharedInstance(getCtx(), '*telemetryManager');
    },
    get localeManager(): LocaleManager {
      return getSharedInstance(getCtx(), '*localeManager');
    },
    get a11y(): A11y {
      return getSharedInstance(getCtx(), '*a11y');
    },
    get blocksRegistry(): Set<LitBlock> {
      return getSharedInstance(getCtx(), '*blocksRegistry');
    },
    get eventEmitter(): EventEmitter {
      return getSharedInstance(getCtx(), '*eventEmitter');
    },
    get uploadCollection(): TypedCollection<UploadEntryData> {
      return getSharedInstance(getCtx(), '*uploadCollection');
    },
    get secureUploadsManager(): SecureUploadsManager {
      return getSharedInstance(getCtx(), '*secureUploadsManager', false);
    },
    get api(): UploaderPublicApi {
      return getSharedInstance(getCtx(), '*publicApi');
    },
    get validationManager(): ValidationManager {
      return getSharedInstance(getCtx(), '*validationManager');
    },
  };
};
