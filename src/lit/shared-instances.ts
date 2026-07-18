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
  eventEmitter: '*eventEmitter',
  uploadCollection: '*uploadCollection',
  secureUploadsManager: '*secureUploadsManager',
  uploadController: '*uploadController',
  uploadEvents: '*uploadEvents',
  api: '*publicApi',
  validationManager: '*validationManager',
} satisfies Record<string, keyof SharedState>;

/**
 * The v1 shared-instance keys whose backing instance is now constructed
 * *and* destroyed by `UploaderController` (M9k), not by the DOM layer.
 * `LitBlock._destroySharedContextInstances` still pub-nulls these keys (so
 * `bag.when`/`ctx.sub` readers see the same teardown signal as before) but
 * must skip calling `.destroy()` on them directly — `UploaderController.destroy()`
 * owns that call, and it runs *after* the DOM layer's pub-null loop (via
 * `PubSub.deleteCtx`), so double-destroying here would tear them down early,
 * while the ctx (and any reader still using it) is still technically "up".
 *
 * `*uploadCollection` joins this set too (M9k Task 3): it was already
 * *constructed* by the controller (`controller.collection`, since Task 2),
 * but until now it was also `.destroy()`-ed here in the DOM loop AND again by
 * `UploaderController.destroy()` — a harmless-but-real double-destroy (the
 * collection's `destroy()` just re-clears already-empty collections the
 * second time). None of the sibling shared instances registered after it
 * (`*secureUploadsManager`, `*uploadController`, `*validationManager`,
 * `*uploadEvents`) read from the collection during their own `.destroy()`,
 * so deferring its real destroy to the controller (same as the other four)
 * is order-safe.
 *
 * `*a11y` and `*clipboard` join the set in M9l (Task 3): the same recipe —
 * `LitBlock` still pub-nulls both keys in `_destroySharedContextInstances`,
 * but `UploaderController.destroy()` now owns the actual `.destroy()` call
 * for both (see its destroy-order doc), since it constructs them too.
 *
 * `*secureUploadsManager`, `*uploadController`, `*validationManager`, and
 * `*uploadEvents` join the set in M9m (Task 2): `UploaderController.
 * attachUploaderScope()` now constructs and (in `destroy()`) tears down all
 * four, gated on an uploader actually being present in the scope.
 * `LitUploaderBlock`'s `_addSharedContextInstance` calls for these four keys
 * are re-exposers only (`() => this.sharedCtx.uploaderController().X`) — the
 * same recipe as the others above.
 *
 * `*pluginManager` joins the set in M-god step 8c: `ensurePluginManager` now
 * `bind`s + resolves `PluginController` on the per-ctx container (its
 * `*pluginManager` registration is a re-exposer of that container instance), so
 * the container owns its disposal (`container.dispose()` in reverse order). It
 * is skipped here for the same reason as the others — otherwise it would be
 * torn down twice.
 */
export const controllerOwnedInstanceKeys: ReadonlySet<keyof SharedState> = new Set([
  instanceKeyMap.eventEmitter,
  instanceKeyMap.localeManager,
  instanceKeyMap.telemetryManager,
  instanceKeyMap.router,
  instanceKeyMap.uploadCollection,
  instanceKeyMap.a11y,
  instanceKeyMap.clipboard,
  instanceKeyMap.pluginManager,
  instanceKeyMap.secureUploadsManager,
  instanceKeyMap.uploadController,
  instanceKeyMap.validationManager,
  instanceKeyMap.uploadEvents,
]);

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

/**
 * Ctx-scope equivalent of `LitBlock._addSharedContextInstance` (M9q Task 2).
 *
 * `_addSharedContextInstance` is a `LitBlock` instance method — it needs an
 * element to call `this.add`/`this.has`/`this.$` on. `ensureUploaderCtx` (the
 * `ChildBlock` self-bootstrap seam) has no element, only the ctx itself — but
 * `PubSub`'s `add`/`has`/`read` are the exact same primitives `this.add`/
 * `this.has`/`this.$[key]` write through to (see `ctx-lifecycle.ts`'s doc on
 * `*sharedContextInstances` being ctx-scoped, not element-instance-scoped), so
 * this helper reimplements the identical first-write-wins recipe directly
 * against a `PubSub<SharedState>` ctx, with no element/bag required.
 *
 * Registering into the SAME `*sharedContextInstances` map is what makes this
 * compose with teardown for free: `destroyCtx` (`ctx-lifecycle.ts`) already
 * pub-nulls every entry in that map and skips `.destroy()` for
 * `controllerOwnedInstanceKeys` members — it has no idea (and needs no idea)
 * whether an entry was registered by a `LitBlock` or by this helper.
 *
 * First-write-wins (via the `instances.has(key)` check) also means calling
 * this from `ensureUploaderCtx` on every ctx access, and later from a v1
 * `LitBlock.initCallback` sharing the same ctx, is inert after the first
 * call — both resolvers produce the exact same `controller.X` instance
 * anyway, so which one "wins" is irrelevant.
 */
export function addCtxSharedInstance<TKey extends keyof SharedInstancesState>(
  ctx: PubSub<SharedState>,
  key: TKey,
  resolver: (ctx: PubSub<SharedState>) => NonNullable<SharedInstancesState[TKey]>,
): void {
  const instancesKey = '*sharedContextInstances';
  let instances: Map<string, ISharedInstance> | undefined = ctx.has(instancesKey) ? ctx.read(instancesKey) : undefined;
  if (!instances) {
    instances = new Map<string, ISharedInstance>();
    ctx.add(instancesKey, instances, true);
  }
  if (instances.has(key)) {
    return;
  }
  if (!ctx.has(key) || !ctx.read(key)) {
    const instance = resolver(ctx);
    ctx.add(key, instance, true);
    instances.set(key, instance as ISharedInstance);
  }
}

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
      // `getCtx` itself may throw when no ctx exists at all (bare block,
      // post-teardown callback) — OrNull means never throwing, either way.
      try {
        return getSharedInstance(getCtx(), '*uploadCollection', false) ?? null;
      } catch {
        return null;
      }
    },
    get apiOrNull(): UploaderPublicApi | null {
      try {
        return getSharedInstance(getCtx(), '*publicApi', false) ?? null;
      } catch {
        return null;
      }
    },
    get routerOrNull(): RouterController | null {
      try {
        return getSharedInstance(getCtx(), '*router', false) ?? null;
      } catch {
        return null;
      }
    },
    get pluginManagerOrNull(): PluginController | null {
      // `*pluginManager` is absent in a config-only / plugin-less ctx (it is
      // constructed by `LitBlock`, and never registered by the ChildBlock
      // self-bootstrap seam). Read it without throwing for blocks that touch
      // custom-config paths but may run outside an uploader/plugin scope.
      try {
        return getSharedInstance(getCtx(), '*pluginManager', false) ?? null;
      } catch {
        return null;
      }
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
