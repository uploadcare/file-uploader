import { ContextConsumer, ContextProvider } from '@lit/context';
import { SignalWatcher } from '@lit-labs/signals';
import { LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ConfigController } from '../abstract/controllers/ConfigController';
import { LocaleController } from '../abstract/controllers/LocaleController';
import { CONTAINER, type ControllerContainer, type Token } from '../abstract/di/ControllerContainer';
import { Disposables } from '../abstract/di/Disposables';
import { inject, injectOrNull } from '../abstract/di/inject';
import { logger } from '../abstract/logger';
import { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { resolveSecureDeliveryProxyUrl } from '../abstract/secureDeliveryProxyUrl';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import { WindowHeightTracker } from '../utils/WindowHeightTracker';
import { destroyCtx, isCtxUnreferenced } from './ctx-lifecycle';
import { ctxNameContext } from './ctx-name-context';
import { effect, registerHostEffects } from './effect';
import { ensureUploaderCtx } from './ensureUploaderCtx';
import { LightDomMixin } from './LightDomMixin';
import { createL10n } from './l10n';
import { RegisterableElementMixin } from './RegisterableElementMixin';
import { registerHostSubscriptions } from './subscription';

// `SignalWatcher` sits at the base of the mixin chain so it wraps
// `performUpdate` (not `render()`): a fully-overridden `render()`/`shouldUpdate()`
// in a leaf block still auto-tracks any `@lit-labs/signals` signal read during
// its update, and re-renders when that signal changes. A block that reads state
// imperatively (a `.get()` read that touches no signal) has nothing tracked, so
// its update cycle is behavior-identical — it only adds a per-element watcher no
// signal notifies.
const ChildBlockBase = SignalWatcher(RegisterableElementMixin(LightDomMixin(LitElement)));

/** A custom element has a hyphen in its tag name (the test-mode rewrite skips these). */
const isCustomElement = (el: Element): boolean => el.tagName?.includes('-') ?? false;

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
 * Subclasses declare the controllers they need as `@inject(Token)` /
 * `@injectOrNull(Token)` fields, resolved lazily off the adopted container:
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
  // is the resolution source for `@inject` fields, the render gate (adopted =
  // container present), and the consumer-refcount anchor for teardown
  // (`addConsumer`/`removeConsumer`/`isUnreferenced`).
  private _container: ControllerContainer | null = null;
  private _watchedCtxName: string | undefined = undefined;
  private _registryUnsub?: () => void;
  // Teardown engine for this block's adoption-scoped subscriptions (config test
  // sync, `@effect` / `@subscription` methods, and `addDisposer` teardowns).
  // Drained on controller release / disconnect. Uses this block's scoped logger
  // (thunked — `_log` initializes later) so an isolate-and-warn teardown throw
  // keeps the block tag + ctx-name context.
  private _disposables = new Disposables(() => this._log);
  private _ctxNameProvider: ContextProvider<{ __context__: string | undefined }> | undefined = undefined;

  public get testId(): string {
    return this.tagName.toLowerCase();
  }

  // Test-mode `data-testid` state (folded in from the former reactive
  // `TestModeController`): the inner non-custom `[data-testid]` elements this
  // host owns, and their original (unprefixed) values. Driven by `_applyTestMode`.
  private _testModeTracked = new Set<Element>();
  private _testModeOriginal = new Map<Element, string>();

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
   * Null-tolerant controller read: the resolved controller, or `null` when no
   * container is adopted (pre-adoption, or after `_releaseController` cleared it
   * during a teardown / not-yet-adopted race). The idiom for reads from a
   * callback that can outlive adoption — a trailing throttle/debounce tick, or a
   * router guard predicate invoked during a teardown-time navigation — where an
   * `@inject` field read would throw. Always-adopted reads use `@inject` fields
   * instead; this is only for the teardown-race sites.
   *
   * For the always-bound uploader-scope tokens read through it (`ConfigController`,
   * `UploaderPublicApi`, `UploadCollectionController`) a non-null container always
   * resolves the instance; a conditionally-bound token (e.g. an unbound
   * `PluginController`) would still throw from `get()` — that is the caller's
   * concern. A block only ever holds a live (never disposed) container in
   * `_container`: `_releaseController` nulls it under the same `removeConsumer`
   * that precedes disposal, so `get()` here never resurrects a controller on a
   * dead container.
   */
  protected useOrNull<T>(token: Token<T>): T | null {
    return this._container ? this._container.get(token) : null;
  }

  /**
   * This ctx's DI container once adopted. Throws if not adopted yet
   * (pre-adoption access is a bug — same contract as an `@inject` field read).
   * The non-null counterpart to `containerOrNull`, for the observer-registration reads that
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
   * The null-safe counterpart to `container`; use it as the teardown-race guard
   * before reading `@inject` fields from a callback that can outlive adoption (a
   * trailing throttle tick, a router guard predicate), or for null-tolerant reads
   * wired at construction time — before adoption — that must not throw when a
   * block is queried early.
   */
  protected get containerOrNull(): ControllerContainer | null {
    return this._container;
  }

  /** This ctx's `LocaleController`, resolved lazily off the adopted container. */
  @inject(LocaleController) private readonly _locale!: LocaleController;

  /**
   * This ctx's `EventEmitter`, or `null` when no container is adopted — a
   * teardown-time `emit()` (released container) resolves `null` and no-ops,
   * matching the v1 guard where a torn-down ctx had no emitter.
   */
  @injectOrNull(EventEmitter) private readonly _eventEmitter!: EventEmitter | null;

  /**
   * Same contract as v1 `LitBlock.l10n` (`createL10n`): dictionary lookup with
   * key fallback, template variables, pluralization. Reads directly from this
   * ctx's `LocaleController` (M-god step 7: off the `*l10n/*` PubSub facade).
   * Call at render time (the render gate guarantees the container is adopted, so
   * the `@inject` `_locale` read resolves). Lookups go through
   * `LocaleController.getTracked`, so an `l10n(key)` read inside
   * `render()`/`willUpdate()` auto-tracks that key under `SignalWatcher` and
   * re-renders the block when the dictionary loads or the locale switches — no
   * explicit subscription needed.
   */
  public l10n = createL10n(() => this._locale);

  /**
   * Per-ctx logger for this block. `error`/`warn`/`warnOnce` always print; the
   * gated verbose tier (`log`/`debug`) prints only when THIS ctx's `debug`
   * config is on — so debug output is per-ctx accurate and prefixed with the
   * block's tag. The `isVerbose` predicate reads the container lazily at log
   * time (null-safe: a pre-adoption call is a no-op).
   */
  protected readonly _log = logger.scope(this.tagName.toLowerCase().replace(/^uc-/, ''), {
    // Verbose tier prints only when THIS ctx's `debug` config is on; predicate +
    // ctx-name resolve lazily at log time (null-safe pre-adoption).
    isVerbose: () => this.useOrNull(ConfigController)?.get('debug') ?? false,
    ctxName: () => this.effectiveCtxName,
  });

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
    // `@injectOrNull`: a teardown-time emit (released container) resolves `null`
    // → no-op, matching the v1 guard where a torn-down ctx had no emitter.
    const eventEmitter = this._eventEmitter;
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
    // Drop the test-mode element refs (the `@effect` itself auto-disposes).
    this._testModeTracked.clear();
    this._testModeOriginal.clear();
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
    // (the same "no container" contract as the `container` getter, though the
    // thrown message differs); `render()` is gated on adoption, so reads there
    // are safe.
    (this as { [CONTAINER]?: ControllerContainer })[CONTAINER] = container;
    container.addConsumer(this);
    // Container-owned controllers are resolved lazily on first access through
    // each block's `@inject`/`@injectOrNull` fields (and via `container`/
    // `whenController` for the scope-bound ones), so there is no eager pre-warm
    // here — adoption only tags the container and wires the subscriptions below.
    // The HOST element's `data-testid` is synced synchronously at adoption (and
    // re-synced on config change) — NOT via `@effect`: e2e helpers query
    // `getByTestId('uc-…')` synchronously right after `page.render()`, before the
    // first post-render effect microtask, so the attribute must exist by the time
    // adoption returns. (The inner `[data-testid]` prefixing, which only applies
    // to already-rendered elements, is the `@effect` `_applyTestMode`.)
    this._disposables.add(container.get(ConfigController).subscribe(() => this._syncTestId(container)));
    this._syncTestId(container);
    try {
      this.controllerReady(container);
    } catch (err) {
      // One block's adoption hook must not break the adoption cycle or escape
      // the registry callback as an unhandled error (isolate-and-warn, as in
      // teardown and EventBus fan-out).
      this._log.warn(`${this.tagName.toLowerCase()}: controllerReady threw during adoption`, err);
    }
    // Wire this block's declarative reactive methods now that the container is
    // adopted (so their `getTracked` / controller reads resolve): `@effect`
    // (signal reactions; connected-guarded disposers — see `registerHostEffects`)
    // and `@subscription` (imperative subscribes returning a teardown). Both are
    // auto-disposed on release, so a block never tracks a disposer by hand.
    for (const dispose of registerHostEffects(this)) {
      this._disposables.add(dispose);
    }
    for (const teardown of registerHostSubscriptions(this)) {
      this._disposables.add(teardown);
    }
    this.requestUpdate();
  }

  private _releaseController(): void {
    const container = this._container;
    // Isolate-and-warn drain (a throwing teardown must not stop the rest) lives
    // in `Disposables.run()`.
    this._disposables.run();
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

  /** Mirror the ctx's `testMode` config onto the HOST element's own `data-testid`. */
  private _syncTestId(container: ControllerContainer): void {
    if (container.get(ConfigController).get('testMode')) {
      this.setAttribute('data-testid', this.tagName.toLowerCase());
    } else {
      this.removeAttribute('data-testid');
    }
  }

  /**
   * Prefix every inner non-custom `[data-testid]` this block owns with its
   * `testId` while the ctx's `testMode` config is on (folded in from the former
   * reactive `TestModeController` + its `trySubscribeTestMode` hook). This
   * `@effect` replaces the controller's manual subscribe/retry lifecycle: it
   * runs after every update (re-collecting newly rendered elements, as
   * `hostUpdated` did) and, because it reads `testMode` via `getTracked`, re-runs
   * when that signal flips — auto-disposed on release, so no hand-managed
   * subscribe/unsubscribe. (The HOST element's own `data-testid` is synced
   * separately at adoption — see `_syncTestId` — because e2e locators need it
   * synchronously, before the first post-render effect microtask.)
   */
  @effect()
  protected _applyTestMode(): void {
    // Runs post-adoption (effects wire at adoption), so the container is present;
    // stay null-tolerant for the teardown-race tick via `useOrNull`.
    const config = this.useOrNull(ConfigController);
    if (!config) {
      return;
    }
    const enabled = Boolean(config.getTracked('testMode'));

    this._collectTestModeElements();
    const prefix = this.testId || '';
    for (const el of this._testModeTracked) {
      const baseValue = this._testModeOriginal.get(el);
      if (!baseValue) {
        continue;
      }
      if (enabled) {
        el.setAttribute('data-testid', `${prefix}--${baseValue}`);
      } else {
        el.removeAttribute('data-testid');
      }
    }
  }

  /**
   * Collect the inner (non-custom-element) `[data-testid]` elements scoped to
   * this host, recording each one's original value, and drop any that are no
   * longer connected under this host. Ported verbatim from `TestModeController`.
   */
  private _collectTestModeElements(): void {
    const root = (this.renderRoot ?? this) as Element | DocumentFragment;
    if (!root) {
      return;
    }
    const hostTag = this.tagName?.toLowerCase();
    const candidates = Array.from(root.querySelectorAll('[data-testid]')).filter((el) => !isCustomElement(el));

    for (const el of candidates) {
      if (hostTag && el.closest(hostTag) !== this) {
        continue;
      }
      if (!this._testModeTracked.has(el)) {
        const attrValue = el.getAttribute('data-testid');
        if (!attrValue) {
          continue;
        }
        this._testModeTracked.add(el);
        this._testModeOriginal.set(el, attrValue);
      }
    }

    for (const el of Array.from(this._testModeTracked)) {
      if (!el.isConnected || (hostTag && el.closest(hostTag) !== this)) {
        this._testModeTracked.delete(el);
        this._testModeOriginal.delete(el);
      }
    }
  }

  /**
   * Register a teardown closure for auto-disposal on controller release /
   * disconnect (adds it to this block's `Disposables`).
   *
   * Prefer the declarative decorators — `@effect` (signal reactions) or
   * `@subscription` (imperative subscribes, returns its teardown) — which
   * register and dispose automatically. Reach for `addDisposer` only for a
   * teardown that isn't adoption-scoped-declarative: a subscription created
   * dynamically after adoption, or one that must be wired at a specific point in
   * `controllerReady` (ordering-sensitive), where a decorator can't express it.
   */
  protected addDisposer(unsub: () => void): void {
    this._disposables.add(unsub);
  }

  /** Called after the ctx's container is adopted (initial and on re-adoption). */
  protected controllerReady(_container: ControllerContainer): void {}

  /** Called after the container is released (disconnect or re-adoption). */
  protected controllerReleased(_container: ControllerContainer): void {}

  /** Resolve a CDN url through the configured secure-delivery proxy, if any. */
  protected async proxyUrl(url: string): Promise<string> {
    return resolveSecureDeliveryProxyUrl(
      this.container.get(ConfigController).values,
      (error, context) => this.container.get(TelemetryManager).sendEventError(error, context),
      url,
    );
  }
}
