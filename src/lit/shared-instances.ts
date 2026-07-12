import type { ConfigType, UploaderPublicApi } from '..';
import type { RouterController } from '../abstract/controllers/RouterController';
import type { SecureUploadsController } from '../abstract/controllers/SecureUploadsController';
import type { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import type { UploadController } from '../abstract/controllers/UploadController';
import type { UploadEventsController } from '../abstract/controllers/UploadEventsController';
import type { ValidationController } from '../abstract/controllers/ValidationController';
import type { A11y } from '../abstract/managers/a11y';
import type { LocaleManager } from '../abstract/managers/LocaleManager';
import type { PluginController } from '../abstract/managers/plugin';
import type { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { sharedConfigKey } from '../abstract/sharedConfigKey';
import { initialConfig } from '../blocks/Config/initialConfig';
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
          if (typeof key !== 'string') {
            return;
          }

          const sharedKey = sharedConfigKey(key);
          if (!this._sharedInstancesBag.ctx.has(sharedKey)) {
            return initialConfig[key];
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

const instanceKeyMap = {
  router: '*router',
  pluginManager: '*pluginManager',
  telemetryManager: '*telemetryManager',
  localeManager: '*localeManager',
  a11y: '*a11y',
  clipboard: '*clipboard',
  blocksRegistry: '*blocksRegistry',
  eventEmitter: '*eventEmitter',
  uploadCollection: '*uploadCollection',
  secureUploadsManager: '*secureUploadsManager',
  uploadController: '*uploadController',
  uploadEvents: '*uploadEvents',
  api: '*publicApi',
  validationManager: '*validationManager',
} satisfies Record<string, keyof SharedState>;

type InstanceTypeMap = {
  [key in keyof typeof instanceKeyMap]: SharedState[(typeof instanceKeyMap)[key]];
};

type InstanceName = keyof typeof instanceKeyMap;

export type SharedInstancesState = Pick<SharedState, (typeof instanceKeyMap)[keyof typeof instanceKeyMap]>;

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
    get router(): RouterController {
      return getSharedInstance(getCtx(), '*router');
    },
    get pluginManager(): PluginController {
      return getSharedInstance(getCtx(), '*pluginManager');
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
    get uploadCollection(): UploadCollectionController {
      return getSharedInstance(getCtx(), '*uploadCollection');
    },
    get secureUploadsManager(): SecureUploadsController {
      return getSharedInstance(getCtx(), '*secureUploadsManager');
    },
    get uploadController(): UploadController {
      return getSharedInstance(getCtx(), '*uploadController');
    },
    get uploadEvents(): UploadEventsController {
      return getSharedInstance(getCtx(), '*uploadEvents');
    },
    get api(): UploaderPublicApi {
      return getSharedInstance(getCtx(), '*publicApi');
    },
    get validationManager(): ValidationController {
      return getSharedInstance(getCtx(), '*validationManager');
    },

    /**
     * Null-tolerant reads for the uploader-scope instances (registered only
     * once an uploader block initializes the ctx, and pubbed `null` again at
     * teardown — `ctx.has()` alone reports stale keys as present). Use these
     * from blocks that may render outside an uploader scope.
     */
    get uploadCollectionOrNull(): UploadCollectionController | null {
      return getSharedInstance(getCtx(), '*uploadCollection', false) ?? null;
    },
    get apiOrNull(): UploaderPublicApi | null {
      return getSharedInstance(getCtx(), '*publicApi', false) ?? null;
    },

    when<TName extends InstanceName>(
      name: TName,
      callback: (instance: NonNullable<InstanceTypeMap[TName]>) => void,
    ): () => void {
      const stateKey = instanceKeyMap[name] as keyof SharedInstancesState;
      const ctx = getCtx();

      const existingInstance = ctx.has(stateKey) ? ctx.read(stateKey) : undefined;
      if (existingInstance) {
        callback(existingInstance as NonNullable<InstanceTypeMap[TName]>);
        return () => {};
      }

      let unsub: (() => void) | undefined;
      unsub = ctx.sub(stateKey, (instance) => {
        if (instance) {
          callback(instance as NonNullable<InstanceTypeMap[TName]>);
          unsub?.();
        }
      });

      return unsub;
    },

    wait<TName extends InstanceName>(name: TName): Promise<NonNullable<InstanceTypeMap[TName]>> {
      return new Promise((resolve) => {
        let unsub: (() => void) | undefined;
        unsub = this.when(name, (instance) => {
          resolve(instance);
          unsub?.();
        });
      });
    },
  };
};
