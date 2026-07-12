import { ContextConsumer, ContextProvider } from '@lit/context';
import { LitElement, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { UploaderController } from '../abstract/controllers/UploaderController';
import { resolveSecureDeliveryProxyUrl } from '../abstract/secureDeliveryProxyUrl';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import type { ConfigType } from '../types';
import type { ActivityId } from './activity-constants';
import { LightDomMixin } from './LightDomMixin';
import { createL10n } from './l10n';
import { PubSub } from './PubSubCompat';
import { RegisterableElementMixin } from './RegisterableElementMixin';
import type { SharedState } from './SharedState';
import { ctxNameContext } from './SymbioteCompatMixin';
import { createSharedInstancesBag, type SharedInstancesBag } from './shared-instances';
import { TestModeController } from './TestModeController';

const ChildBlockBase = RegisterableElementMixin(LightDomMixin(LitElement));

/**
 * Base class for blocks ported off `SymbioteCompatMixin` (M9). Resolves the
 * per-ctx `UploaderController` by ctx-name — from the element's own
 * `ctx-name` attribute or, when absent, from the nearest v1 ancestor's
 * `ctxNameContext` provider — via `UploaderRegistry.whenAvailable`, which
 * fires synchronously when a controller is already registered and again
 * across a remount, so subclasses re-adopt without losing bindings.
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

  public override connectedCallback(): void {
    super.connectedCallback();
    for (const attr of (this.constructor as typeof ChildBlock).styleAttrs) {
      if (!this.hasAttribute(attr)) this.setAttribute(attr, '');
    }
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
    this._registryUnsub?.();
    this._registryUnsub = undefined;
    this._watchedCtxName = undefined;
    this._releaseController();
    super.disconnectedCallback();
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
    this._registryUnsub?.();
    this._registryUnsub = undefined;
    this._watchedCtxName = ctxName;
    // Scope switch (or ctx-name removed entirely): drop the current controller
    // right away so the render gate closes instead of serving the previous
    // scope's data while the new controller is still pending.
    this._releaseController();
    if (!ctxName) {
      return;
    }
    this._registryUnsub = UploaderRegistry.whenAvailable(ctxName, (ctrl) => this._adoptController(ctrl));
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
