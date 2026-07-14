import { solutionBlockCtx } from '../abstract/CTX';
import { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';
import { addCtxSharedInstance } from './shared-instances';

/**
 * The one controller-side entry point that creates a per-ctx nanostores map.
 *
 * Idempotent: if `ctxName` already has a map (created by this function, by a
 * v1 element's own `PubSub.registerCtx` call, or by a plain test harness),
 * that map is returned untouched — no re-seed, no second controller.
 *
 * On first creation it seeds the map with the full *plain* uploader/solution
 * state (`blockCtx` + `uploaderBlockCtx` + `solutionBlockCtx` from
 * `abstract/CTX.ts` — `*commonProgress`, `*uploadList`, `*collectionErrors`,
 * `*collectionState`, `*groupInfo`, `*uploadTrigger`, `*lazyPlugins`) and
 * nothing else instance-wise beyond the six controller-owned keys documented
 * below: `*pluginManager`/`*blocksRegistry`/the uploader-scope keys
 * (`*uploadCollection`, …) stay element-gated, registered by
 * `LitBlock`/`LitUploaderBlock` `initCallback` re-exposers, same as before
 * this seam existed. It then forces the ctx's `UploaderController` into
 * existence immediately, instead
 * of lazily on first `*cfg/*`/`*l10n/*` touch (`PubSubCompat`'s previous
 * sole creation path) — this is the whole point of the seam: the controller
 * now exists the moment the ctx does, even pre-any-element.
 *
 * A fresh seed object is built per call (not hoisted to a module constant):
 * `uploaderBlockCtx`'s `*uploadTrigger` is a `Set` instance, so a shared seed
 * object would leak that Set across unrelated ctxs.
 *
 * It also registers the six controller-owned ctx-scope re-exposer keys
 * (`*eventEmitter`, `*localeManager`, `*a11y`, `*router`, `*clipboard`,
 * `*telemetryManager`) and activates `LocaleManager` (M9q Task 2) — the same
 * work `LitBlock.initCallback` does, but reachable with no `LitBlock` in the
 * composition at all (a pure `ChildBlock` tree). `addCtxSharedInstance` is
 * first-write-wins, so a `LitBlock` sharing the same ctx later is a no-op for
 * these six keys (both resolvers produce the identical `controller.X`
 * instance). `*pluginManager`/`*blocksRegistry`/the uploader-scope keys
 * (`*publicApi`/`*uploadCollection`/upload stack) stay v1-element-gated, not
 * registered here.
 *
 * `SymbioteCompatMixin._initSharedContext` delegates map acquisition to this
 * function; it still runs its own per-key `add(key, value, this.ctxOwner)`
 * loop over the connecting element's OWN `init$` on top (v1 extras — e.g.
 * `Config`'s `*cfg/*` keys, `CloudImageEditorBlock`/`EditorImageCropper`'s
 * `ctxOwner`-rewritten keys) — that loop, and its rewrite semantics, are
 * unchanged by this seam.
 */
export function ensureUploaderCtx(ctxName: string): PubSub<SharedState> {
  // `solutionBlockCtx()` returns only the plain uploader/solution seed keys
  // (a small subset of `SharedState`, which also covers `*cfg/*`, `*l10n/*`,
  // and every controller-owned instance key) — the same "seed value typed as
  // the full shared-state shape" contract every v1 block's `init$` field
  // already relies on (e.g. `LitBlock.init$ = blockCtx()` for `TState`).
  const existing = PubSub.getCtx<SharedState>(ctxName);
  const ctx = existing ?? PubSub.registerCtx<SharedState>(solutionBlockCtx() as unknown as SharedState, ctxName);

  // Force the controller into existence on EVERY path, not just first
  // creation. A map can pre-exist without a controller — created by a v1
  // element's raw `PubSub.registerCtx`, a test harness, or a future ported
  // ctx-creator — and this function's contract is that the controller exists
  // the moment the ctx does (so `ChildBlock`s never wait forever on
  // `UploaderRegistry`). `uploaderController()` is idempotent: it returns the
  // registered controller or creates+registers one.
  const controller = ctx.uploaderController();

  // Re-expose the six controller-owned managers under their v1 shared-
  // instance keys — first-write-wins (see `addCtxSharedInstance`'s doc), so
  // this is a no-op on every subsequent call, and inert once/if a `LitBlock`
  // sharing this ctx runs its own (identical) `initCallback` registrations.
  addCtxSharedInstance(ctx, '*eventEmitter', () => controller.eventEmitter);
  addCtxSharedInstance(ctx, '*localeManager', () => controller.localeManager);
  addCtxSharedInstance(ctx, '*a11y', () => controller.a11y);
  addCtxSharedInstance(ctx, '*router', () => controller.router);
  addCtxSharedInstance(ctx, '*clipboard', () => controller.clipboard);
  addCtxSharedInstance(ctx, '*telemetryManager', () => controller.telemetryManager);

  // Run `LocaleManager`'s deferred construction-time work (seed the `en`
  // dictionary, subscribe to `localeName`/`localeDefinitionOverride`) here,
  // same as `LitBlock.initCallback` does for the v1 path. No `*pluginManager`
  // is registered by this v1-free seam, so pass `null` — `LocaleManager.
  // activate` tolerates a null plugin manager (seeds the dictionary + core
  // subscriptions unconditionally, just skips the plugin-locale coupling).
  // If a v1 `LitBlock` later joins this ctx and constructs a real
  // `*pluginManager`, its own `initCallback` calls `activate` again with it —
  // idempotent re-coupling, same recipe `LocaleManager.activate` already
  // guarantees for a second v1 block sharing a ctx.
  controller.localeManager.activate(ctx.has('*pluginManager') ? ctx.read('*pluginManager') : null);

  return ctx;
}
