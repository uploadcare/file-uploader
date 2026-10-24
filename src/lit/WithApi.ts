import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { inject } from '../abstract/di/inject';
import { EventBus } from '../abstract/EventBus';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { EventType } from '../blocks/UploadCtxProvider/EventEmitter';
import type { ApiHost } from './api-host-types';
import type { ChildBlock } from './ChildBlock';
import type { Constructor } from './Constructor';
import { ensureUploaderScope } from './ensureUploaderScope';
import { subscription, type Unsubscribe } from './subscription';

/**
 * Makes its `Base` block an **API / events host**: the surface that used to live
 * only on `<uc-upload-ctx-provider>` — attach the uploader scope, expose
 * `getAPI()` / `.api` / `.uploadCollection`, and re-dispatch the per-ctx
 * {@link EventBus} as DOM `CustomEvent`s on this element.
 *
 * Composable with {@link WithConfig}:
 *
 * ```ts
 * class UploadCtxProvider extends WithApi(ChildBlock) {}
 * class Uploader extends WithConfig(WithApi(ChildBlock)) {}
 * ```
 *
 * `controllerReady` calls `super` first so an outer mixin (e.g. WithConfig) can
 * still run its own adoption setup when this mixin is the inner one — and so
 * this mixin's `ensureUploaderScope` still runs when it is the outer one.
 */
export function WithApi<T extends abstract new (...args: any[]) => ChildBlock>(Base: T): T & Constructor<ApiHost> {
  abstract class WithApiClass extends Base {
    /** Documented event-type constants (same as former UploadCtxProvider.EventType). */
    public static EventType = EventType;

    // Always-bound after `ensureUploaderScope` — `@inject` throws pre-adoption,
    // matching the v1 getters / prior UploadCtxProvider contract.
    @inject(EventBus) private readonly _eventBus!: EventBus;
    @inject(UploadCollectionController) private readonly _uploadCollection!: UploadCollectionController;
    @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

    protected override controllerReady(container: ControllerContainer): void {
      super.controllerReady(container);
      // Idempotent attach so `getAPI()` works right after mount (v1 parity).
      ensureUploaderScope(container);
    }

    /**
     * Bridge the per-ctx {@link EventBus} to documented DOM `CustomEvent`s on
     * this host. `@subscription` wires at adoption and auto-disposes on release.
     */
    @subscription()
    protected _bridgeBusToDom(): Unsubscribe {
      return this._eventBus.onAny((type, payload) => {
        this.dispatchEvent(new CustomEvent(type, { detail: payload }));
      });
    }

    /** Same contract as v1 `LitUploaderBlock.getAPI()`. */
    public getAPI(): UploaderPublicApi {
      return this._api;
    }

    /** Same contract as v1 `LitUploaderBlock.get api()`. */
    public get api(): UploaderPublicApi {
      return this._api;
    }

    /** Same contract as v1 `LitUploaderBlock.get uploadCollection()`. */
    public get uploadCollection(): UploadCollectionController {
      return this._uploadCollection;
    }
  }

  return WithApiClass as unknown as T & Constructor<ApiHost>;
}
