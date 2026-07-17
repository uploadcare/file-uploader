import { ContextConsumer, ContextProvider } from '@lit/context';
import { LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { UploaderController } from '../abstract/controllers/UploaderController';
import { resolveSecureDeliveryProxyUrl } from '../abstract/secureDeliveryProxyUrl';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import type { EventEmitter } from '../blocks/UploadCtxProvider/EventEmitter';
import type { ConfigType } from '../types';
import { WindowHeightTracker } from '../utils/WindowHeightTracker';
import type { ActivityId } from './activity-constants';
import { destroyCtx, isCtxUnreferenced } from './ctx-lifecycle';
import { ctxNameContext } from './ctx-name-context';
import { ensureUploaderCtx } from './ensureUploaderCtx';
import { LightDomMixin } from './LightDomMixin';
import { createL10n } from './l10n';
import { PubSub } from './PubSubCompat';
import { RegisterableElementMixin } from './RegisterableElementMixin';
import type { SharedState } from './SharedState';
import { createSharedInstancesBag, type SharedInstancesBag } from './shared-instances';
import { TestModeController } from './TestModeController';

const ChildBlockBase = RegisterableElementMixin(LightDomMixin(LitElement));

/**
 * Base class for blocks ported off `SymbioteCompatMixin` (M9). Resolves the
 * per-ctx `UploaderController` by ctx-name — from the element's own
 * `ctx-name` attribute or, when absent, from the nearest v1 ancestor's
 * `ctxNameContext` provider — via `UploaderRegistry.whenAvailable`, which
 * fires synchronously when a controller is already registered and again
 * across a remount, so subclasses re-adopt without losing bindings. If the
 * ctx dies while this block stays connected (the last v1 block elsewhere
 * disconnected and tore the ctx down), the registry notifies with `null` and
 * the block releases its controller — closing the render gate — rather than
 * outliving the ctx it was reading from.
 *
 * Subclasses read controllers directly: no `$` proxy, no `init$`, no
 * nanostores. Rendering is gated until a controller is adopted (matching
 * v1's `shouldUpdate` gate on ctx init); do controller-dependent setup in
 * `controllerReady`, never in `connectedCallback`.
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

  private _controller: UploaderController | null = null;
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

  protected get uploader(): UploaderController {
    if (!this._controller) {
      throw new Error(
        `${this.tagName.toLowerCase()}: UploaderController is not available yet. ` +
          'Read it in controllerReady() or use uploaderOrNull for guarded access.',
      );
    }
    return this._controller;
  }

  protected get uploaderOrNull(): UploaderController | null {
    return this._controller;
  }

  private _requireCtx(): PubSub<SharedState> {
    const ctxName = this.effectiveCtxName;
    const ctx = ctxName ? PubSub.getCtx<SharedState>(ctxName) : null;
    if (!ctx) {
      throw new Error(`${this.tagName.toLowerCase()}: shared context is not initialized yet.`);
    }
    return ctx;
  }

  /**
   * Shared v1 manager/controller instances for this ctx. Getters throw until
   * the instance registers — inside `controllerReady` prefer `bag.when(name,
   * cb)` (async-safe) over direct getters.
   */
  protected bag: SharedInstancesBag = createSharedInstancesBag(() => this._requireCtx());

  /**
   * Same contract as v1 `LitBlock.l10n` (`createL10n`): dictionary lookup with
   * key fallback, template variables, pluralization. Reads route through the
   * ctx's `*l10n/*` facade to `LocaleController`. Call at render time (the
   * render gate guarantees the ctx exists); blocks that render l10n text
   * should add `(l) => ctrl.locale.subscribe(l)` to `subscriptionsFor` so the
   * text re-renders when the dictionary loads or the locale switches.
   */
  public l10n = createL10n(() => this._requireCtx());

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
    const ctx = this.effectiveCtxName ? PubSub.getCtx<SharedState>(this.effectiveCtxName) : null;
    const eventEmitter = ctx?.has('*eventEmitter') ? ctx.read('*eventEmitter') : undefined;
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
    // initialized; here the gate is controller adoption.
    if (!this._controller) {
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
    // Scope switch (or ctx-name removed entirely): drop the current controller
    // right away so the render gate closes instead of serving the previous
    // scope's data while the new controller is still pending.
    this._releaseController();
    if (oldCtxName) {
      // This block may have been the ctx's only consumer (self-bootstrapped,
      // no v1 block ever attached) — check whether it's now orphaned.
      this._scheduleAbandonedCtxTeardown(oldCtxName);
    }
    if (!ctxName) {
      return;
    }
    // Self-bootstrap: a ChildBlock is a pure consumer, so with no v1 block
    // anywhere in the composition the ctx (and its controller) would never
    // come into existence and `whenAvailable` below would wait forever. Call
    // this unconditionally — a ctx map can exist without a controller (e.g. a
    // bare `PubSub.registerCtx`), and `whenAvailable` won't fire until a
    // controller is registered, so guarding on `PubSub.getCtx(ctxName)` alone
    // could still hang. `ensureUploaderCtx` is idempotent and (M9n) forces the
    // controller into existence on every path; if a v1 block or a sibling
    // ChildBlock already created the ctx (and its controller), this is a
    // no-op — the existing creator (and its seed) wins, unchanged.
    ensureUploaderCtx(ctxName);
    this._registryUnsub = UploaderRegistry.whenAvailable(ctxName, (ctrl) => {
      if (ctrl) {
        this._adoptController(ctrl);
      } else {
        this._releaseController();
      }
    });
  }

  private _adoptController(ctrl: UploaderController): void {
    if (this._controller === ctrl) return;
    this._releaseController();
    this._controller = ctrl;
    const rerender = () => this.requestUpdate();
    for (const subscribe of this.subscriptionsFor(ctrl)) {
      this._subs.push(subscribe(rerender));
    }
    this._subs.push(ctrl.config.subscribe(() => this._syncTestId(ctrl)));
    this._syncTestId(ctrl);
    try {
      this.controllerReady(ctrl);
    } catch (err) {
      // One block's adoption hook must not break the adoption cycle or escape
      // the registry callback as an unhandled error (isolate-and-warn, as in
      // teardown and EventBus fan-out).
      console.warn(`[uc] ${this.tagName.toLowerCase()}: controllerReady threw during adoption`, err);
    }
    this.requestUpdate();
  }

  private _releaseController(): void {
    const ctrl = this._controller;
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
    this._controller = null;
    if (ctrl) this.controllerReleased(ctrl);
  }

  private _syncTestId(ctrl: UploaderController): void {
    if (ctrl.config.get('testMode')) {
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
    const ctrl = this.uploaderOrNull;
    if (!ctrl) {
      return undefined;
    }
    const config = ctrl.config;
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

  /** Track a subscription for auto-teardown on controller release / disconnect. */
  protected trackSub(unsub: () => void): void {
    this._subs.push(unsub);
  }

  /**
   * Per-key config subscription: fires immediately with the current value,
   * then on every change of that key (`Object.is` dedup over the coarse
   * config notification). Same contract as v1 `LitBlock.subConfigValue`.
   * Call from `controllerReady` or later; auto-tracked.
   */
  protected subConfigValue<K extends keyof ConfigType>(key: K, callback: (value: ConfigType[K]) => void): () => void {
    const config = this.uploader.config;
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
   * or later (`bag.router` requires the ctx).
   */
  protected subRouter(callback: () => void): () => void {
    callback();
    const unsub = this.bag.router.subscribe(callback);
    this.trackSub(unsub);
    return unsub;
  }

  /**
   * Subscribe to the effective current activity (foreground modal, else
   * background). Fires immediately with the current value, then on change
   * (reference dedup). Auto-tracked.
   */
  protected subActivity(callback: (activity: ActivityId | null) => void): () => void {
    const router = this.bag.router;
    let last: ActivityId | null = router.currentActivity;
    callback(last);
    const unsub = router.subscribe(() => {
      const next: ActivityId | null = router.currentActivity;
      if (next !== last) {
        last = next;
        callback(next);
      }
    });
    this.trackSub(unsub);
    return unsub;
  }

  /**
   * Controller-change subscriptions that should trigger a re-render — return
   * `subscribe` functions (e.g. `(l) => ctrl.config.subscribe(l)`). Wired on
   * adoption, torn down on release.
   */
  protected subscriptionsFor(_ctrl: UploaderController): Array<(listener: () => void) => () => void> {
    return [];
  }

  /** Called after a controller is adopted (initial and on re-adoption). */
  protected controllerReady(_ctrl: UploaderController): void {}

  /** Called after the controller is released (disconnect or re-adoption). */
  protected controllerReleased(_ctrl: UploaderController): void {}

  /** Resolve a CDN url through the configured secure-delivery proxy, if any. */
  protected async proxyUrl(url: string): Promise<string> {
    return resolveSecureDeliveryProxyUrl(
      this.uploader.config.values,
      (error, context) => this.bag.telemetryManager.sendEventError(error, context),
      url,
    );
  }
}
