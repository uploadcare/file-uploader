import type { ActivityId } from '../abstract/activity-constants';
import { RouterController } from '../abstract/controllers/RouterController';
import { UploadCollectionController } from '../abstract/controllers/UploadCollectionController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { inject } from '../abstract/di/inject';
import { EventBus, UploaderEventType } from '../abstract/EventBus';
import { EventType } from '../abstract/EventEmitter';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
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

    // Always-bound after `ensureUploaderScope` — `@inject` throws pre-adoption.
    @inject(EventBus) private readonly _eventBus!: EventBus;
    @inject(UploadCollectionController) private readonly _uploadCollection!: UploadCollectionController;
    @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;
    @inject(RouterController) private readonly _router!: RouterController;
    // The activity this host's listeners last heard about through `activity-change`.
    private _reportedActivity: ActivityId | null = null;

    protected override controllerReady(container: ControllerContainer): void {
      super.controllerReady(container);
      // Idempotent attach so `getAPI()` works right after mount.
      ensureUploaderScope(container);
    }

    /**
     * Bridge the per-ctx {@link EventBus} to documented DOM `CustomEvent`s on
     * this host. `@subscription` wires at adoption and auto-disposes on release.
     * @internal
     */
    @subscription()
    protected _bridgeBusToDom(): Unsubscribe[] {
      // Catch up on an activity set before this host joined the ctx: inline and minimal seed their start screen as
      // soon as they mount, which can be before the provider does, and v1 reported it to the provider's listeners. A
      // same-tick DOM move re-adopts with nothing missed, so it reports nothing again.
      const current = this._router.currentActivity;
      if (current !== this._reportedActivity) {
        this._reportedActivity = current;
        this.dispatchEvent(new CustomEvent(UploaderEventType.ACTIVITY_CHANGE, { detail: { activity: current } }));
      }
      return [
        this._eventBus.on(UploaderEventType.ACTIVITY_CHANGE, ({ activity }) => {
          this._reportedActivity = activity;
        }),
        this._eventBus.onAny((type, payload) => {
          this.dispatchEvent(new CustomEvent(type, { detail: payload }));
        }),
      ];
    }

    /** This ctx's public API. */
    public getAPI(): UploaderPublicApi {
      return this._api;
    }

    /** This ctx's public API, as a property. */
    public get api(): UploaderPublicApi {
      return this._api;
    }

    /** This ctx's upload collection. */
    public get uploadCollection(): UploadCollectionController {
      return this._uploadCollection;
    }
  }

  return WithApiClass as unknown as T & Constructor<ApiHost>;
}
