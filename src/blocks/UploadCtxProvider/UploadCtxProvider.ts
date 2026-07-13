import type { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import type { UploaderController } from '../../abstract/controllers/UploaderController';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { buildUploaderScopeDeps } from '../../lit/buildUploaderScopeDeps';
import { ChildBlock } from '../../lit/ChildBlock';
import { createDebugPrinter } from '../../lit/createDebugPrinter';
import { EventBridgeController } from '../../lit/EventBridgeController';
import { type EventPayload, EventType } from './EventEmitter';

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: This is intentional interface merging, used to add event listener types
export class UploadCtxProvider extends ChildBlock {
  public static override styleAttrs = ['uc-wgt-common'];
  public static EventType = EventType;

  /** Same contract as v1 `LitBlock.debugPrint` (`createDebugPrinter`), scoped to this ctx. */
  private _debugPrint = createDebugPrinter(() => this.bag.ctx, this.constructor.name);

  private _eventBridge: EventBridgeController | null = null;

  protected override controllerReady(ctrl: UploaderController): void {
    // Re-adoption (release-while-connected followed by re-adopt) would otherwise
    // stack a new EventBridgeController per adoption without ever removing the
    // previous one's subscription — tear down the old instance first (mirrors
    // the SourceListController pattern in SourceList.ts).
    this._teardownEventBridge();

    this._attachUploaderScopeIfNeeded(ctrl);

    // Bridge the per-ctx EventBus to documented DOM CustomEvents on this
    // element. Recreated on every adoption (matching the teardown above) so
    // its internal subscription is rebound to the *new* controller's bus
    // rather than staying latched onto a released one.
    this._eventBridge = new EventBridgeController(
      this,
      () => this.uploader.events,
      (...args) => this._debugPrint(...args),
    );
  }

  protected override controllerReleased(): void {
    this._teardownEventBridge();
  }

  private _teardownEventBridge(): void {
    if (!this._eventBridge) {
      return;
    }
    this._eventBridge.hostDisconnected();
    this.removeController(this._eventBridge);
    this._eventBridge = null;
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
   * (one source of truth with `LitUploaderBlock.initCallback`); only `debug`
   * and `emit` are host-specific.
   */
  private _attachUploaderScopeIfNeeded(ctrl: UploaderController): void {
    const ctx = this.bag.ctx;

    if (!ctx.has('*uploadCollection')) {
      ctx.add('*uploadCollection', ctrl.collection, true);
    }

    if (!ctx.has('*publicApi')) {
      const api = new UploaderPublicApi(this.bag);
      ctrl.setApi(api);
      ctx.add('*publicApi', api, true);
    }

    ctrl.attachUploaderScope(
      buildUploaderScopeDeps(
        this.bag,
        (...args) => this._debugPrint(...args),
        // Same contract as `ChildBlock.emit`: EventEmitter dispatch + telemetry
        // mirror, guarded for teardown races.
        (type, payload, options) => this.emit(type, payload, options),
      ),
    );

    // Re-expose the controller-owned instances under their v1 shared-instance
    // keys (readers like `FileItem.bag.uploadController` expect them there).
    if (!ctx.has('*secureUploadsManager')) {
      ctx.add('*secureUploadsManager', ctrl.secureUploadsManager, true);
    }
    if (!ctx.has('*uploadController')) {
      ctx.add('*uploadController', ctrl.uploadController, true);
    }
    if (!ctx.has('*validationManager')) {
      ctx.add('*validationManager', ctrl.validationManager, true);
    }
    if (!ctx.has('*uploadEvents')) {
      ctx.add('*uploadEvents', ctrl.uploadEvents, true);
    }
  }

  /**
   * Same contract as v1 `LitUploaderBlock.get uploadCollection()` — part of the
   * documented `<uc-upload-ctx-provider>` type surface (pinned by
   * `types/test/uc-upload-ctx-provider.test-d.tsx`). Throws pre-adoption via
   * `bag`, exactly as the v1 getter did before `initCallback` ran.
   */
  public get uploadCollection(): UploadCollectionController {
    return this.bag.uploadCollection;
  }

  /** Same contract as v1 `LitUploaderBlock.getAPI()` — returns the ctx's public API. */
  public getAPI(): UploaderPublicApi {
    return this.bag.api;
  }

  /** Same contract as v1 `LitUploaderBlock.get api()` — throws pre-adoption via `bag`. */
  public get api(): UploaderPublicApi {
    return this.bag.api;
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
