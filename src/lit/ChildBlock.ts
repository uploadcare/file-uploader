import { ContextConsumer, ContextProvider } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import { LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ConfigController } from '../abstract/controllers/ConfigController';
import { LocaleController } from '../abstract/controllers/LocaleController';
import { RouterController } from '../abstract/controllers/RouterController';
import { CONTAINER, type ControllerContainer, type Token } from '../abstract/di/ControllerContainer';
import { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { resolveSecureDeliveryProxyUrl } from '../abstract/secureDeliveryProxyUrl';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import type { ConfigType } from '../types';
import { WindowHeightTracker } from '../utils/WindowHeightTracker';
import { destroyCtx, isCtxUnreferenced } from './ctx-lifecycle';
import { ctxNameContext } from './ctx-name-context';
import { ensureUploaderCtx } from './ensureUploaderCtx';
import { LightDomMixin } from './LightDomMixin';
import { createL10n } from './l10n';
import { RegisterableElementMixin } from './RegisterableElementMixin';
import { TestModeController } from './TestModeController';

// `SignalWatcher` sits at the base of the mixin chain so it wraps
// `performUpdate` (not `render()`): a fully-overridden `render()`/`shouldUpdate()`
// in a leaf block still auto-tracks any `@lit-labs/signals` signal read during
// its update, and re-renders when that signal changes. Blocks reading state
// imperatively (`subConfigValue`, which does not touch a signal) have nothing
// tracked, so their update cycle is behavior-identical — it only adds a
// per-element watcher no signal notifies.
const ChildBlockBase = SignalWatcher(RegisterableElementMixin(LightDomMixin(LitElement)));

/**
 * Base class for blocks ported off `SymbioteCompatMixin` (M9). Resolves the
 * per-ctx `ControllerContainer` by ctx-name — from the element's own
 * `ctx-name` attribute or, when absent, from the nearest v1 ancestor's
 * `ctxNameContext` provider — via `UploaderRegistry.whenAvailable`, which
 * fires synchronously when a container is already registered and again
 * across a remount, so subclasses re-adopt without losing bindings. If the
 * ctx dies while this block stays connected (the last consumer elsewhere
 * disconnected and tore the ctx down), the registry notifies with `null` and
 * the block releases its container — closing the render gate — rather than
 * outliving the ctx it was reading from.
 *
 * Subclasses read controllers directly off the container (`this.use(Token)`):
 * no `$` proxy, no per-ctx store. Rendering is gated until a container
 * is adopted (matching v1's `shouldUpdate` gate on ctx init); do
 * container-dependent setup in `controllerReady`, never in `connectedCallback`.
 * Note: while the render gate is closed Lit still clears its
 * changed-properties tracking, so pre-adoption property writes will not
 * appear in `changedProperties` at the first real render — read current
 * values instead of `changedProperties.has(...)` in `firstUpdated`.
 */
export abstract class ChildBlock extends ChildBlockBase {
  public static styleAttrs: string[] = [];

  @property({ attribute: 'ctx-name' })
  public ctxName: string | undefined = undefined;

  @state()
  private _inheritedCtxName: string | undefined = undefined;

  // This ctx's DI container, adopted from `UploaderRegistry.whenAvailable`. It
  // is the resolution source for `use()`, the render gate (adopted = container
  // present), and the consumer-refcount anchor for teardown
  // (`addConsumer`/`removeConsumer`/`isUnreferenced`).
  private _container: ControllerContainer | null = null;
  private _watchedCtxName: string | undefined = undefined;
  private _registryUnsub?: () => void;
  private _subs: Array<() => void> = [];
  private _ctxNameProvider: ContextProvider<{ __context__: string | undefined }> | undefined = undefined;

  public constructor() {
    super();
    new TestModeController(this);
  }

  public get testId(): string {
    return this.tagName.toLowerCase();
  }

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: `ContextConsumer` subscribes by side effect — the field keeps it alive for the host's lifetime.
  private _ctxNameConsumer = new ContextConsumer(this, {
    context: ctxNameContext,
    callback: (value) => {
      if (!value) return;
      this._inheritedCtxName = value;
      this._watchRegistry();
    },
    subscribe: true,
  });

  /** The element's own `ctx-name` attribute wins over the inherited context (v1 parity). */
  protected get effectiveCtxName(): string | undefined {
    return this.ctxName || this._inheritedCtxName;
  }

  /**
   * Resolve a single-responsibility controller from this ctx's DI container —
   * the v2 successor to the dissolved monolithic `UploaderController`. Read it at
   * render time (or in/after `controllerReady`); the render gate guarantees the
   * container is adopted by then. Reading a `@signalState`/`SignalMap`-backed
   * value off the returned controller (e.g. `ConfigController.getTracked`)
   * inside `render()` auto-tracks it via `SignalWatcher`.
   *
   * Throws if the container isn't adopted yet (pre-adoption access is a bug).
   */
  protected use<T>(token: Token<T>): T {
    if (!this._container) {
      throw new Error(
        `${this.tagName.toLowerCase()}: controller container is not available yet. ` +
          'Call use() in render() or controllerReady(), not connectedCallback().',
      );
    }
    return this._container.get(token);
  }

  /**
   * Null-tolerant `use()`. Returns `null` when no container is adopted
   * (pre-adoption, or after
   * `_releaseController` cleared it during a teardown / not-yet-adopted race),
   * instead of throwing. Use it from callbacks that can outlive adoption — a
   * trailing throttle/debounce tick, or a router guard predicate invoked during
   * a teardown-time navigation — where `use()` would throw.
   *
   * For the always-bound uploader-scope tokens read through it (`ConfigController`,
   * `UploaderPublicApi`, `UploadCollectionController`) a non-null container always
   * resolves the instance; a conditionally-bound token (e.g. an unbound
   * `PluginController`) would still throw from `get()` — that is the caller's
   * concern, matching `use()`. A block only ever holds a live (never disposed)
   * container in `_container`: `_releaseController` nulls it out under the same
   * `removeConsumer` that precedes disposal, so `get()` here never resurrects a
   * controller on a dead container.
   */
  protected useOrNull<T>(token: Token<T>): T | null {
    return this._container ? this._container.get(token) : null;
  }

  /**
   * This ctx's DI container once adopted. Throws if not adopted yet
   * (pre-adoption access is a bug — same contract as `use()`). The non-null
   * counterpart to `containerOrNull`, for the observer-registration reads that
   * run from `controllerReady` (where adoption is guaranteed) — e.g.
   * `this.container.whenController(UploadCollectionController, cb)`, the direct
   * successor to the `bag.when('uploadCollection', cb)` now-or-when-available
   * registration.
   */
  protected get container(): ControllerContainer {
    if (!this._container) {
      throw new Error(
        `${this.tagName.toLowerCase()}: controller container is not available yet. ` +
          'Read container in render() or controllerReady(), not connectedCallback().',
      );
    }
    return this._container;
  }

  /**
   * This ctx's DI container once adopted, else `null` (pre-adoption, or after
   * `_releaseController` cleared it during a teardown / not-yet-adopted race).
   * The null-safe counterpart to the `use()`/`useOrNull()` render-gate anchor,
   * for plumbing wired at construction time — before adoption — such as
   * `createDebugPrinter`, whose accessor must not throw when read early.
   */
  protected get containerOrNull(): ControllerContainer | null {
    return this._container;
  }

  /**
   * Same contract as v1 `LitBlock.l10n` (`createL10n`): dictionary lookup with
   * key fallback, template variables, pluralization. Reads directly from this
   * ctx's `LocaleController` (M-god step 7: off the `*l10n/*` PubSub facade).
   * Call at render time (the render gate guarantees the container is adopted, so
   * `use()` resolves); blocks that render l10n text should add
   * `(l) => ctrl.locale.subscribe(l)` to `subscriptionsFor` so the text
   * re-renders when the dictionary loads or the locale switches.
   */
  public l10n = createL10n(() => this.use(LocaleController));

  /**
   * Emit a documented uploader event — same contract as v1 `LitBlock.emit`.
   * Guarded for teardown: emissions can race ctx destruction (queued events),
   * so a missing emitter is a no-op.
   *
   * M-god step 3c removed the per-emit telemetry mirror that used to live here:
   * telemetry is now an `EventBus` observer (`TelemetryManager.init()`
   * subscribes to `bus.onAny`), and this `eventEmitter.emit` funnels into that
   * same bus — so keeping a mirror here would double-count every event this
   * path dispatches (buttons' `UPLOAD_CLICK`/`DONE_CLICK`, the upload stack's
   * `COMMON_UPLOAD_SUCCESS`/`GROUP_CREATED`/…). The teardown guard stays: a
   * suppressed emit reaches neither the bus nor, therefore, telemetry.
   */
  public emit(
    type: Parameters<EventEmitter['emit']>[0],
    payload?: Parameters<EventEmitter['emit']>[1],
    options?: Parameters<EventEmitter['emit']>[2],
  ): void {
    // Resolve the ctx's `EventEmitter` off this block's adopted container. A
    // teardown-time emit (released container) resolves `null` → no-op, matching
    // the v1 guard where a torn-down ctx had no emitter.
    const eventEmitter = this.useOrNull(EventEmitter);
    if (!eventEmitter) {
      return;
    }
    eventEmitter.emit(type, payload, options);
  }

  public override connectedCallback(): void {
    super.connectedCallback();
    for (const attr of (this.constructor as typeof ChildBlock).styleAttrs) {
      if (!this.hasAttribute(attr)) this.setAttribute(attr, '');
    }
    // Keep `--uploadcare-blocks-window-height` live (consumed by
    // `--uc-dialog-max-height`) — v1 registered this in `LitBlock.initCallback`.
    WindowHeightTracker.registerClient(this);
    this._watchRegistry();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    // Re-provide the effective ctx-name downward so v1 children nested under
    // a ported block keep resolving their ctx exactly as they would under a
    // v1 parent.
    const effective = this.effectiveCtxName;
    if (effective) {
      if (!this._ctxNameProvider) {
        this._ctxNameProvider = new ContextProvider(this, {
          context: ctxNameContext,
          initialValue: effective,
        });
      } else {
        this._ctxNameProvider.setValue(effective);
      }
    }
  }

  public override disconnectedCallback(): void {
    // Capture before releasing anything below — `effectiveCtxName` itself
    // doesn't depend on controller/watch state, but grabbing it up front
    // means the deferred check below is unambiguous about which ctx it's
    // asking about, even if the attribute changes before the timeout fires
    // (that reconnect path re-watches a possibly different name; this
    // deferred check is only about the ctx this disconnect was leaving).
    const ctxName = this.effectiveCtxName;
    WindowHeightTracker.unregisterClient(this);
    this._registryUnsub?.();
    this._registryUnsub = undefined;
    this._watchedCtxName = undefined;
    this._releaseController();
    super.disconnectedCallback();

    if (!ctxName) {
      return;
    }
    // Unified consumer-refcount teardown (M9o Task 3): this block was one of
    // possibly several things keeping the ctx alive (v1 `*blocksRegistry`
    // members, other `ChildBlock`s watching via `UploaderRegistry`). Defer
    // the check exactly like `LitBlock.disconnectedCallback` — same
    // `setTimeout(0)` + reconnect-guard shape — so a same-tick disconnect ->
    // reconnect (e.g. a DOM move) doesn't tear down a ctx this block is
    // about to re-watch.
    setTimeout(() => {
      if (this.isConnected) {
        return;
      }
      this._teardownCtxIfUnreferenced(ctxName);
    }, 0);
  }

  /**
   * Shared tail of both deferred teardown checks below (disconnect and
   * ctx-name switch): re-test `isCtxUnreferenced` at fire time — not at
   * schedule time — since another consumer may have shown up in between, and
   * only then run the single `destroyCtx` path.
   */
  private _teardownCtxIfUnreferenced(ctxName: string): void {
    if (!isCtxUnreferenced(ctxName)) {
      return;
    }
    destroyCtx(ctxName);
  }

  /**
   * Release-on-switch trigger (mirrors the disconnect trigger above): a
   * `ChildBlock` can self-bootstrap a ctx it's the only consumer of
   * (`ensureUploaderCtx` in `_watchRegistry`). If it's then reassigned to a
   * different `ctx-name` while staying connected, nothing else schedules a
   * teardown check for the ctx it just abandoned — it would otherwise leak
   * (controller + managers kept alive by a ctx nothing reads from anymore).
   * Same `setTimeout(0)` + guard shape as the disconnect path, except the
   * guard re-checks `_watchedCtxName` (rather than `isConnected`, which stays
   * true across a same-tick switch) so a switch back to `ctxName` before the
   * timeout fires — analogous to a disconnect/reconnect — cancels the check.
   */
  private _scheduleAbandonedCtxTeardown(ctxName: string): void {
    setTimeout(() => {
      if (this._watchedCtxName === ctxName) {
        return;
      }
      this._teardownCtxIfUnreferenced(ctxName);
    }, 0);
  }

  protected override shouldUpdate(changed: PropertyValues<this>): boolean {
    // ctx-name may arrive or change while the render gate below is still
    // closed (willUpdate never runs then) — react to it here, where Lit
    // calls in even for gated updates.
    if (changed.has('ctxName')) this._watchRegistry();
    // v1 parity: SymbioteCompatMixin gates rendering until the ctx is
    // initialized; here the gate is container adoption.
    if (!this._container) {
      return false;
    }
    return super.shouldUpdate(changed);
  }

  private _watchRegistry(): void {
    const ctxName = this.effectiveCtxName;
    if (!this.isConnected || ctxName === this._watchedCtxName) {
      return;
    }
    const oldCtxName = this._watchedCtxName;
    this._registryUnsub?.();
    this._registryUnsub = undefined;
    this._watchedCtxName = ctxName;
    // Scope switch (or ctx-name removed entirely): drop the current container
    // right away so the render gate closes instead of serving the previous
    // scope's data while the new container is still pending.
    this._releaseController();
    if (oldCtxName) {
      // This block may have been the ctx's only consumer (self-bootstrapped,
      // no v1 block ever attached) — check whether it's now orphaned.
      this._scheduleAbandonedCtxTeardown(oldCtxName);
    }
    if (!ctxName) {
      return;
    }
    // Self-bootstrap: a ChildBlock is a pure consumer, so with nothing else in
    // the composition creating the ctx, its `ControllerContainer` would never
    // come into existence and `whenAvailable` below would wait forever. Call
    // `ensureUploaderCtx` unconditionally — it is idempotent and creates (or
    // returns) the ctx's container on every path; if a sibling ChildBlock
    // already created it, this is a no-op — the existing container wins.
    ensureUploaderCtx(ctxName);
    this._registryUnsub = UploaderRegistry.whenAvailable(ctxName, (container) => {
      if (container) {
        this._adoptController(container);
      } else {
        this._releaseController();
      }
    });
  }

  private _adoptController(container: ControllerContainer): void {
    if (this._container === container) return;
    this._releaseController();
    // Anchor the consumer refcount on the container (M-god step 6a): this block
    // keeps its ctx alive by being a container consumer, not by holding a
    // `UploaderRegistry.whenAvailable` subscription. `addConsumer`/`removeConsumer`
    // run at adopt/release, which — because `whenAvailable` fires synchronously
    // once `ensureUploaderCtx` has forced the container into existence — is the
    // same instant the registry subscription used to be the refcount, preserving
    // exact teardown timing (`isCtxUnreferenced` reads `container.isUnreferenced()`).
    this._container = container;
    // Tag this element with the container so `@inject(Token)` fields on migrated
    // blocks resolve through the shared `inject.ts` getter (which reads
    // `this[CONTAINER]`) — the same mechanism controllers use. Only the adoption
    // path sets this (the container tags instances IT constructs, but a block is
    // created by the browser and merely adopts its container here). Cleared in
    // `_releaseController`, so pre-adoption / post-release `@inject` reads throw
    // (the same "no container" contract as `use()`, though the thrown message
    // differs); `render()` is gated on adoption, so reads there are safe.
    (this as { [CONTAINER]?: ControllerContainer })[CONTAINER] = container;
    container.addConsumer(this);
    // Container-owned controllers are resolved lazily on first access through
    // each block's `@inject` fields (and via `use()`/`whenController` for the
    // scope-bound ones), so there is no eager pre-warm here — adoption only tags
    // the container and wires the subscriptions below.
    const rerender = () => this.requestUpdate();
    for (const subscribe of this.subscriptionsFor(container)) {
      this._subs.push(subscribe(rerender));
    }
    this._subs.push(container.get(ConfigController).subscribe(() => this._syncTestId(container)));
    this._syncTestId(container);
    try {
      this.controllerReady(container);
    } catch (err) {
      // One block's adoption hook must not break the adoption cycle or escape
      // the registry callback as an unhandled error (isolate-and-warn, as in
      // teardown and EventBus fan-out).
      console.warn(`[uc] ${this.tagName.toLowerCase()}: controllerReady threw during adoption`, err);
    }
    this.requestUpdate();
  }

  private _releaseController(): void {
    const container = this._container;
    for (const unsub of this._subs) {
      try {
        unsub();
      } catch (err) {
        // Teardown must be isolated: one throwing unsubscriber must not
        // prevent the rest from running.
        console.warn(
          `[uc] ${this.tagName.toLowerCase()}: a subscription teardown threw during controller release`,
          err,
        );
      }
    }
    this._subs = [];
    // Drop the container refcount BEFORE the deferred teardown check fires: once
    // the last consumer is gone `container.isUnreferenced()` reports the ctx dead
    // and `_teardownCtxIfUnreferenced` disposes it (via `destroyCtx`). A disposed
    // container has already cleared its consumer set, so a late `removeConsumer`
    // here (e.g. a null-notify after teardown) is a harmless no-op.
    container?.removeConsumer(this);
    this._container = null;
    // Untag so a post-release `@inject` read throws (matching the `use()`
    // contract) rather than resolving through a container this block no longer
    // holds a consumer refcount on.
    (this as { [CONTAINER]?: ControllerContainer })[CONTAINER] = undefined;
    if (container) this.controllerReleased(container);
  }

  private _syncTestId(container: ControllerContainer): void {
    if (container.get(ConfigController).get('testMode')) {
      this.setAttribute('data-testid', this.tagName.toLowerCase());
    } else {
      this.removeAttribute('data-testid');
    }
  }

  /**
   * TestModeController hook — subscribe once a controller is adopted.
   * Subscribes directly on the controller's config (not via `subConfigValue`/
   * `trackSub`) so the `TestModeController`'s own `_unsubscribe` is the sole
   * owner of the teardown, rather than being released early by controller
   * re-adoption. This binds to the first adopted controller's config for the
   * host's lifetime, matching v1's single-ctx `LitBlock` lifetime; ctx swaps
   * mid-life are exotic and not covered here.
   */
  public trySubscribeTestMode(callback: (enabled: boolean) => void): (() => void) | undefined {
    const config = this.useOrNull(ConfigController);
    if (!config) {
      return undefined;
    }
    let last = config.get('testMode');
    callback(Boolean(last));
    return config.subscribe(() => {
      const next = config.get('testMode');
      if (!Object.is(next, last)) {
        last = next;
        callback(Boolean(next));
      }
    });
  }

  /**
   * Track a subscription for auto-teardown on controller release / disconnect.
   *
   * @deprecated Transitional v1 compat — a migrated block tracks reactive state
   * with signals (`SignalWatcher` auto-tracks + auto-disposes), not manual
   * subscriptions. Removed once every block is migrated.
   */
  protected trackSub(unsub: () => void): void {
    this._subs.push(unsub);
  }

  /**
   * Per-key config subscription: fires immediately with the current value,
   * then on every change of that key (`Object.is` dedup over the coarse
   * config notification). Same contract as v1 `LitBlock.subConfigValue`.
   * Call from `controllerReady` or later; auto-tracked.
   *
   * @deprecated Transitional v1 compat. A migrated block reads config
   * reactively in `render()` via `this.use(ConfigController).getTracked(key)`,
   * which `SignalWatcher` auto-tracks. Removed once every block is migrated.
   */
  protected subConfigValue<K extends keyof ConfigType>(key: K, callback: (value: ConfigType[K]) => void): () => void {
    const config = this.use(ConfigController);
    let last = config.get(key);
    callback(last);
    const unsub = config.subscribe(() => {
      const next = config.get(key);
      if (!Object.is(next, last)) {
        last = next;
        callback(next);
      }
    });
    this.trackSub(unsub);
    return unsub;
  }

  /**
   * Subscribe to *any* router change. Fires immediately, then on every
   * notification — no value dedup. Auto-tracked. Call from `controllerReady`
   * or later (the render gate guarantees the container is adopted, so `use()`
   * resolves).
   *
   * M-god step 9b-1: reads the `RouterController` off the container
   * (`use(RouterController)`) instead of `bag.router`. The `*router` shared
   * instance re-exposes this very container singleton, so this is the same
   * instance the `bag` getter returned — behavior-identical.
   *
   * @deprecated Transitional v1 compat — a migrated block reads router state
   * reactively via signals under `SignalWatcher`. Removed once every block is
   * migrated.
   */
  protected subRouter(callback: () => void): () => void {
    callback();
    const unsub = this.use(RouterController).subscribe(callback);
    this.trackSub(unsub);
    return unsub;
  }

  /**
   * Controller-change subscriptions that should trigger a re-render — return
   * `subscribe` functions (e.g. `(l) => container.get(LocaleController).subscribe(l)`).
   * Wired on adoption, torn down on release.
   */
  protected subscriptionsFor(_container: ControllerContainer): Array<(listener: () => void) => () => void> {
    return [];
  }

  /** Called after the ctx's container is adopted (initial and on re-adoption). */
  protected controllerReady(_container: ControllerContainer): void {}

  /** Called after the container is released (disconnect or re-adoption). */
  protected controllerReleased(_container: ControllerContainer): void {}

  /** Resolve a CDN url through the configured secure-delivery proxy, if any. */
  protected async proxyUrl(url: string): Promise<string> {
    return resolveSecureDeliveryProxyUrl(
      this.use(ConfigController).values,
      (error, context) => this.use(TelemetryManager).sendEventError(error, context),
      url,
    );
  }
}
