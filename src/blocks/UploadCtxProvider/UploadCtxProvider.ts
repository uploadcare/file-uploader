import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import type { ControllerContainer } from '../../abstract/di/ControllerContainer';
import { inject } from '../../abstract/di/inject';
import { EventBus } from '../../abstract/EventBus';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ChildBlock } from '../../lit/ChildBlock';
import { ensureUploaderScope } from '../../lit/ensureUploaderScope';
import { subscription, type Unsubscribe } from '../../lit/subscription';
import { type EventPayload, EventType } from './EventEmitter';

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: This is intentional interface merging, used to add event listener types
export class UploadCtxProvider extends ChildBlock {
  public static override styleAttrs = ['uc-wgt-common'];
  public static EventType = EventType;

  // `EventBus` is always-bound → `@inject` field. `UploaderPublicApi` and
  // `UploadCollectionController` are exposed through the documented
  // `getAPI()`/`.api`/`.uploadCollection` getters; `@inject` throws pre-adoption
  // exactly as the v1 getters (and the prior `use()`) did.
  @inject(EventBus) private readonly _eventBus!: EventBus;
  @inject(UploadCollectionController) private readonly _uploadCollection!: UploadCollectionController;
  @inject(UploaderPublicApi) private readonly _api!: UploaderPublicApi;

  protected override controllerReady(container: ControllerContainer): void {
    this._attachUploaderScopeIfNeeded(container);
  }

  /**
   * Bridge the per-ctx {@link EventBus} to documented DOM `CustomEvent`s on this
   * `<uc-upload-ctx-provider>` element — the UI-coupled half of the event system
   * (the DOM-free controllers emit on the bus; this re-dispatches each event as
   * `new CustomEvent(type, { detail })`, exactly as v1's `EventEmitter._dispatch`
   * did). `@subscription` wires at adoption and auto-disposes on release, so the
   * subscription always tracks the current container's bus and re-adoption
   * rebinds it to the new bus rather than latching onto a released one — no
   * manual teardown-first dance. Debug-mode event logging is not done here:
   * `EventBus.emit` logs every event centrally (verbose-gated), covering events
   * regardless of any DOM bridge.
   */
  @subscription()
  protected _bridgeBusToDom(): Unsubscribe {
    return this._eventBus.onAny((type, payload) => {
      this.dispatchEvent(new CustomEvent(type, { detail: payload }));
    });
  }

  /**
   * `<uc-upload-ctx-provider>` must be able to attach the uploader scope
   * itself, synchronously, the moment it adopts its controller — because
   * `getAPI()`/`.api` are documented to work right after mount, and the
   * solution block's own attach (`LitUploaderBlock.initCallback`, and the
   * `<uc-drop-area>` inside its template) does not run until the solution's
   * first Lit render, a microtask later. The ctx + controller already exist by
   * adoption time (created by whichever block's `_initSharedContext` ran first
   * — typically `<uc-config>`), so this fills the still-missing upload scope.
   * In v1 `UploadCtxProvider` was itself a `LitUploaderBlock` and attached the
   * scope in its synchronous `initCallback`; this preserves that exact
   * guarantee on `ChildBlock`. All writes are guarded / idempotent
   * (first-write-wins + `attachUploaderScope`'s own gate), so this is a no-op
   * once a solution or a sibling provider has already attached.
   *
   * The `attachUploaderScope` deps come from the shared `buildUploaderScopeDeps`
   * (one source of truth with `LitUploaderBlock.initCallback`); only `emit` is
   * host-specific. The guarded/idempotent body itself lives in
   * `ensureUploaderScope` (`src/lit/ensureUploaderScope.ts`) — a free-function
   * seam shared with the ported `<uc-drop-area>`, which needs the identical
   * synchronous-attach guarantee.
   */
  private _attachUploaderScopeIfNeeded(container: ControllerContainer): void {
    ensureUploaderScope(
      container,
      // Same contract as `ChildBlock.emit`: pure EventEmitter dispatch (no
      // telemetry mirror — telemetry observes the bus independently via
      // `TelemetryManager.init()`), guarded for teardown races.
      (type, payload, options) => this.emit(type, payload, options),
    );
  }

  /**
   * Same contract as v1 `LitUploaderBlock.get uploadCollection()` — part of the
   * documented `<uc-upload-ctx-provider>` type surface (pinned by
   * `types/test/uc-upload-ctx-provider.test-d.tsx`). Resolved from the ctx's
   * container (M-god step 8d); throws pre-adoption via `use()`, exactly as the
   * v1 getter did before `initCallback` ran.
   */
  public get uploadCollection(): UploadCollectionController {
    return this._uploadCollection;
  }

  /**
   * Same contract as v1 `LitUploaderBlock.getAPI()` — returns the ctx's public
   * API. Resolved from the ctx's container (M-god step 8a); the same single
   * instance `*publicApi` exposes.
   */
  public getAPI(): UploaderPublicApi {
    return this._api;
  }

  /** Same contract as v1 `LitUploaderBlock.get api()` — throws pre-adoption via `use()`. */
  public get api(): UploaderPublicApi {
    return this._api;
  }
}

type EventListenerMap = {
  [K in (typeof EventType)[keyof typeof EventType]]: (e: CustomEvent<EventPayload[K]>) => void;
};

export interface UploadCtxProvider extends ChildBlock {
  addEventListener<T extends keyof EventListenerMap>(
    type: T,
    listener: EventListenerMap[T],
    options?: boolean | AddEventListenerOptions,
  ): void;
  // fallback overloads for compatibility with the DOM lib (lib.dom.d.ts)
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener<T extends keyof EventListenerMap>(
    type: T,
    listener: EventListenerMap[T],
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'uc-upload-ctx-provider': UploadCtxProvider;
  }
}
