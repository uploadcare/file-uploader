import { EventEmitter } from '../../blocks/UploadCtxProvider/EventEmitter';
import type { ControllerContainer } from '../di/ControllerContainer';
import { EventBus, type UploaderEventKey, type UploaderEventPayload } from '../EventBus';
import { A11y } from '../managers/a11y';
import { LocaleManager } from '../managers/LocaleManager';
import { TelemetryManager } from '../managers/TelemetryManager';
import { AppInfo } from './AppInfo';
import { ClipboardController } from './ClipboardController';
import { ConfigController } from './ConfigController';
import { LocaleController } from './LocaleController';
import { RouterController } from './RouterController';
import { UploadCollectionController } from './UploadCollectionController';

// NOTE: the four upload-stack classes (`SecureUploadsController`,
// `UploadController`, `ValidationController`, `UploadEventsController`) are NOT
// imported here — not even type-only. They are owned by the per-ctx container
// and registered by the element-layer `registerUploadStack`/`ensureUploaderScope`
// (M-god step 5). `UploaderController` is constructed for EVERY ctx — including
// editor-only scopes that never upload — so any reference to those classes (each
// of which drags `@uploadcare/upload-client`) would leak the upload stack into
// the editor bundle. The editor path never calls `registerUploadStack`, so
// `container.get(SecureUploadsController)` is never reached from it.

/**
 * Root controller — one instance per uploader scope (keyed by `ctx-name` in
 * `UploaderRegistry`). Pure logic: it does NOT import from `lit` or touch the
 * DOM, so it is constructible and testable in isolation.
 *
 * This is the strangler engine that v1's `PubSub` facade delegates to. It
 * grows by one sub-controller per migration milestone (M1 `config`, M2
 * `locale`, M3 `collection`, …).
 *
 * - `events`: the typed event bus (wired to DOM events in a later milestone).
 * - `config`: source of truth for `*cfg/*` state — `PubSubCompat` routes the
 *   config namespace here.
 * - `locale`: source of truth for `*l10n/*` state — `PubSubCompat` routes the
 *   locale namespace here.
 * - `collection`: source of truth for the upload entries — the `*uploadCollection`
 *   shared instance resolves to this.
 *
 * The per-ctx DI `ControllerContainer` is injected at construction (M-god step
 * 3): it owns a growing set of controllers exposed here as delegating getters
 * resolving through the container (stable identity per ctx, disposed by
 * `container.dispose()` in reverse construction order). Step 3a moved `config`
 * and `locale`; step 3b moved `events`, `eventEmitter`, `localeManager`,
 * `a11y`, and the solution identity (`solutionName`/`setSolutionName`, now
 * owned by the container's `AppInfo`); step 3c moved `router` and
 * `telemetryManager` (the latter now an `EventBus` observer rather than a
 * mirror on this controller's `emit`). The constructor eagerly resolves
 * `config`/`router`/`telemetry` so they exist from birth (telemetry subscribes
 * to the bus before any event fires). Step 4 moved `collection` onto the
 * container too (a delegating getter; a leaf with no deps).
 *
 * Step 5 moved the upload stack (`SecureUploadsController`, `UploadController`,
 * `ValidationController`, `UploadEventsController`) onto the container as well:
 * they `@inject` their controller peers + a `UploadHostBridge` host-value token,
 * and the element layer registers them via `registerUploadStack`/
 * `ensureUploaderScope` — so this controller no longer references those classes
 * at all (keeping the upload stack out of the editor bundle) and no longer tears
 * them down (the container disposes them).
 *
 * `PluginController` stays constructed by the DOM layer (`LitBlock`) — it
 * genuinely needs the PubSub ctx (`*lazyPlugins`, arbitrary shared state) and
 * the `*publicApi` shared instance, neither of which the DOM-free controller
 * can reach without importing `PubSub` here, which would both create a circular
 * import (`PubSubCompat` already imports `UploaderController`) and break the
 * "abstract/ touches no DOM" boundary in spirit. See the M9k task report for
 * the full audit.
 *
 * Step 8b moved `clipboard` onto the container too (a delegating getter). It is
 * now `@inject`-based: config/router are injected controller peers, and its
 * add-file path reaches the uploader-scope public API through the container-
 * bound `UploadHostBridge` (`getApi()`) at paste time — which REPLACES the old
 * settable `api`/`setApi()` two-phase dance this class used to carry. (It goes
 * through the host bridge rather than `@inject`-ing `UploaderPublicApi` directly
 * so a value edge from this editor-bundled graph doesn't drag the public API
 * into the editor-alone bundle; see `ClipboardController`'s class doc.)
 * `clipboard`'s window listener still arms lazily on the first `registerScope`
 * (from `SolutionChildBlock.controllerReady`), unchanged; the container lazily
 * constructs it on that first `clipboard` access and disposes it with
 * everything else.
 */
export class UploaderController {
  private _destroyed = false;
  // The per-ctx DI container that owns this controller (M-god step 3). It also
  // owns `config`/`locale`/the upload stack now — the delegating getters below
  // resolve through it, and `container.dispose()` (not this class) tears them
  // down. Exposed via `container` so the element layer (`ensureUploaderScope`)
  // can register the upload stack against it (M-god step 5).
  private readonly _container: ControllerContainer;

  public constructor(container: ControllerContainer) {
    // Assigned FIRST — the eager resolutions below read `this.config`/etc.,
    // delegating getters resolving here.
    this._container = container;

    // Eagerly resolve the container-owned managers that must exist from birth
    // (M-god step 3c — parity with their former eager construction). The order
    // fixes reverse-insertion disposal and the observer's subscribe timing:
    //  - `config` first → disposed LAST (telemetry's `_unsubConfig` runs during
    //    teardown; the returned unsubscribe is a safe no-op even after config is
    //    disposed, but config outliving telemetry keeps intent clear);
    //  - `router` before `telemetry` (telemetry reads `router.currentActivity`);
    //  - `telemetry` last, so its `init()` subscribes to the bus BEFORE any
    //    event can fire — the observer then sees every event the old per-emit
    //    telemetry mirror used to (and, additionally, the direct
    //    `eventEmitter.emit` callers the mirror never reached).
    this._container.get(ConfigController);
    this._container.get(RouterController);
    this._container.get(TelemetryManager);
  }

  /**
   * The per-ctx DI container that owns this controller and its sibling
   * controllers. Exposed so the element layer (`ensureUploaderScope`) can
   * register the upload stack against it (`registerUploadStack`) and resolve the
   * upload-stack instances for their v1 `*`-key re-exposure. Removed when this
   * facade is dissolved (M-god step 8).
   */
  public get container(): ControllerContainer {
    return this._container;
  }

  /**
   * Pure-dispatch emit — matches v1 `LitBlock.emit`'s guard exactly. A silent
   * no-op once destroyed.
   *
   * M-god step 3c removed the telemetry mirror that used to live here: telemetry
   * is now an `EventBus` observer (`TelemetryManager.init()` subscribes to
   * `bus.onAny`), so every `eventEmitter.emit` — from here, from
   * `ChildBlock.emit`, or from a direct caller like `UploaderPublicApi.uploadAll`
   * — reaches telemetry via the bus, without any per-emit mirror.
   */
  public emit<T extends UploaderEventKey>(
    type: T,
    payload?: UploaderEventPayload[T] | (() => UploaderEventPayload[T]),
    options?: { debounce?: boolean | number },
  ): void {
    if (this._destroyed) {
      return;
    }

    this.eventEmitter.emit(type, payload, options);
  }

  /**
   * Config store — owned by the container, not this class. Resolved lazily on
   * every access (the container caches a single instance per ctx), so identity
   * is stable and disposal is the container's responsibility.
   */
  public get config(): ConfigController {
    return this._container.get(ConfigController);
  }

  /** Locale store — container-owned, same ownership model as `config`. */
  public get locale(): LocaleController {
    return this._container.get(LocaleController);
  }

  /**
   * Upload collection (source of truth for the entries; `*uploadCollection`
   * resolves here) — container-owned (M-god step 4). A leaf with no deps; the
   * container caches a single instance per ctx, so identity is stable across the
   * upload stack / `publicApi` / stateBridges, and `container.dispose()` (not
   * this class) tears it down.
   */
  public get collection(): UploadCollectionController {
    return this._container.get(UploadCollectionController);
  }

  /** Typed event bus — container-owned (M-god step 3b). */
  public get events(): EventBus {
    return this._container.get(EventBus);
  }

  /**
   * Pure-dispatch event facade over `events` — container-owned (M-god step 3b).
   * `container.get(EventEmitter)` is the same instance the `bag`/`*eventEmitter`
   * surface exposes.
   */
  public get eventEmitter(): EventEmitter {
    return this._container.get(EventEmitter);
  }

  /** Locale orchestration manager — container-owned (M-god step 3b). */
  public get localeManager(): LocaleManager {
    return this._container.get(LocaleManager);
  }

  /** Keyboard-UX (a11y) manager — container-owned (M-god step 3b). */
  public get a11y(): A11y {
    return this._container.get(A11y);
  }

  /** Dual-slot router — container-owned (M-god step 3c). */
  public get router(): RouterController {
    return this._container.get(RouterController);
  }

  /** Quality-insights telemetry (a bus observer) — container-owned (M-god step 3c). */
  public get telemetryManager(): TelemetryManager {
    return this._container.get(TelemetryManager);
  }

  /** Solution (preset) identity — owned by the container's `AppInfo` (M-god step 3b). */
  public get solutionName(): string | null {
    return this._container.get(AppInfo).solutionName;
  }

  /**
   * Register the solution (preset) owning this scope — delegates to the
   * container-owned `AppInfo`. Several solutions may share one `ctx-name` (a
   * supported composition — e.g. an uploader plus a standalone editor); the
   * most recently initialized one identifies the scope, matching v1's
   * `pub('*solution', …)` last-writer semantics.
   */
  public setSolutionName(name: string): void {
    this._container.get(AppInfo).setSolutionName(name);
  }

  /**
   * Window paste-to-upload handler — container-owned (M-god step 8b). A
   * delegating getter resolving through the container (stable identity per ctx),
   * constructed lazily on first access (typically `SolutionChildBlock.
   * controllerReady`'s `registerScope`, which is also where its window listener
   * arms — unchanged) and disposed by `container.dispose()`. Its add-file path
   * resolves the public API through the container (`@inject`), so this class no
   * longer needs the settable `api`/`setApi()` seam it used to carry.
   */
  public get clipboard(): ClipboardController {
    return this._container.get(ClipboardController);
  }

  public destroy(): void {
    this._destroyed = true;

    // Nothing is torn down here — the container owns
    // `config`/`locale`/`events`/`eventEmitter`/`localeManager`/`a11y`/`router`/
    // `telemetryManager`/`collection`, the whole upload stack (M-god step 5:
    // `SecureUploadsController`/`UploadController`/`ValidationController`/
    // `UploadEventsController`), AND `clipboard` (M-god step 8b), disposing them
    // all in reverse construction order. The upload stack is registered AFTER
    // this controller (which is resolved first, in `_resolveContainer`), so it
    // is disposed BEFORE this `destroy()` runs — `UploadEventsController.
    // unobserve()` detaches its collection observers while the collection is
    // still alive (the collection was registered even earlier, so it disposes
    // last of the group). Teardown emissions are already suppressed (this
    // `_destroyed` guard; `ChildBlock.emit`'s null-ctx guard once `deleteCtx`
    // removes the ctx), so nothing reaches the still-live bus during disposal.
  }
}
