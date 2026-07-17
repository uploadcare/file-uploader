# God-Object Decomposition — Implementation Blueprint

**Companion to:** `docs/superpowers/specs/2026-07-17-god-object-decomposition-design.md`
**Date:** 2026-07-17 · **Branch:** `feat/v2-god-object-decompose` (→ `feat/v2-migration`)
**Status:** Blueprint — awaiting approval before step-1 implementation.

This blueprint is the authoritative build document. Where it disagrees with the
spec, **it wins** — it was verified against the real constructors. Key
corrections to the spec are flagged **[CORRECTS SPEC]**.

---

## Correction 0 — `bind()` factories, not `static deps`, for most controllers **[CORRECTS SPEC]**

The spec assumed every controller takes peer **instances** positionally
(`static deps` + positional injection). Reading the real constructors: only
6 do. Everything else takes a **deps object of closures** over other
controllers' live state (e.g. `getActivity: () => router.currentActivity`).
That is deliberate — it's how the current code resolves the
`TelemetryManager ↔ RouterController` mutual need without a construction cycle.

So the container supports **both**:
- `static deps = [...]` + positional `new` — for the 6 leaf/simple controllers.
- `container.bind(Token, (c) => new Token({ ... c.get(X) ... }))` — for the rest,
  where cross-controller reads live inside **lazy closures** that call `c.get()`
  at *use* time, not at bind time. `container.get` is safe to call re-entrantly
  from inside a bind factory as long as it isn't a true construction-time cycle.

**Construction-order proof (the Telemetry/EventEmitter/Router triangle is a DAG):**
the eager edges are linear — `EventBus, ConfigController, AppInfo → TelemetryManager
→ EventEmitter → RouterController`. Router is only ever referenced inside closures
that run later (at `sendEvent`/emit time), never mid-resolution. Any first-entry
order terminates. **Test this** by resolving every eager controller in several
first-entry orders and asserting no cycle-throw + identical wiring.

---

## Step 1 — Signals foundation (behavior-preserving)

**Modify** `package.json`: add `"@lit-labs/signals": "^0.3.0"` to `dependencies`.
Before coding, read the installed `.d.ts` to pin exact exports
(`signal`, `computed`, `SignalWatcher`, `Signal.State`) — Labs package, shape
can drift. Add a **canary unit test** asserting those exports exist (fails loudly
on a breaking minor). Confirm `signal-polyfill` transitive dep doesn't break
`size-limit` budgets.

**Modify** `src/abstract/controllers/StateController.ts` — signal-backed internals,
**public API unchanged**:

```ts
import { signal, type Signal } from '@lit-labs/signals';
import { Listeners } from '../host-subscription';

export class StateController<TState extends object> {
  protected _state: TState;
  private _listeners = new Listeners();
  private _signals = new Map<keyof TState, Signal.State<TState[keyof TState]>>();

  public constructor(initial: TState) { this._state = initial; }

  private _sig<K extends keyof TState>(key: K): Signal.State<TState[K]> {
    let s = this._signals.get(key);
    if (!s) { s = signal(this._state[key]) as Signal.State<TState[keyof TState]>; this._signals.set(key, s); }
    return s as Signal.State<TState[K]>;
  }

  public get values(): Readonly<TState> { return this._state; }

  public get<K extends keyof TState>(key: K): TState[K] { return this._sig(key).get(); }

  public set<K extends keyof TState>(key: K, value: TState[K]): void {
    const sig = this._sig(key);
    if (Object.is(sig.get(), value)) return;   // dedup preserved exactly
    sig.set(value);
    this._state[key] = value;                  // kept in lockstep
    this._listeners.notify();                  // coarse compat surface unchanged
  }

  /** Seed a value bypassing set()'s dedup (default-seeding), keeping signal + _state in lockstep. */
  protected seed<K extends keyof TState>(key: K, value: TState[K]): void {
    this._state[key] = value;
    this._sig(key).set(value);
  }

  public subscribe(listener: () => void): () => void { return this._listeners.subscribe(listener); }
  public notify(): void { this._listeners.notify(); }
  public destroy(): void { this._listeners.clear(); this._signals.clear(); }
}
```

**Modify** `src/abstract/controllers/ConfigController.ts`: route `getCustom` →
`this.get(...)`, `setCustom` → `this.set(...)` (tightens `===` to `Object.is` — a
strict improvement, note in PR), `register()` default-seeding → `this.seed(...)`
(keep the `Object.hasOwn` gate + trailing `notify()`).

**Modify (in-scope)** `src/abstract/controllers/LocaleController.ts`: extend
`StateController<Record<string, string>>` instead of duplicating get/set/
subscribe/notify/destroy — step 7 needs it to expose signal reads exactly like
`ConfigController`.

**Checklist:** `grep -n "_state\[" src/abstract/controllers/CloudImageEditorController.ts`
and port any direct `_state` mutation to `get`/`set`/`seed`. The editor controller
must keep working unchanged.

**Tests:** signal-backed StateController (dedup, lockstep, subscribe fires on
change only); canary export test; ConfigController custom-key + register-seed
paths at 100% before the edit (cover-before-refactor).

---

## Step 2 — `ControllerContainer` + per-ctx registry

**Create** `src/abstract/ControllerContainer.ts` (DOM-free, no `lit`):

```ts
export interface ControllerCtor<T, D extends readonly unknown[] = readonly unknown[]> {
  new (...args: D): T;
  readonly deps?: { readonly [K in keyof D]: ControllerCtor<D[K]> };
}
export function deps<D extends readonly ControllerCtor<unknown>[]>(...ctors: D): D { return ctors; }

export class ControllerContainer {
  #instances = new Map<ControllerCtor<unknown>, unknown>();
  #bindings = new Map<ControllerCtor<unknown>, (c: ControllerContainer) => unknown>();
  #resolving = new Set<ControllerCtor<unknown>>();
  #insertionOrder: ControllerCtor<unknown>[] = [];
  #consumers = new Set<unknown>();

  public bind<T>(token: ControllerCtor<T>, factory: (c: ControllerContainer) => T): void {
    if (this.#instances.has(token)) throw new Error(`ControllerContainer: cannot bind ${token.name} after resolution`);
    this.#bindings.set(token, factory as (c: ControllerContainer) => unknown);
  }

  public get<T>(Ctrl: ControllerCtor<T>): T {
    const cached = this.#instances.get(Ctrl);
    if (cached !== undefined) return cached as T;
    if (this.#resolving.has(Ctrl)) throw new Error(`[uc] controller cycle at ${Ctrl.name}`);
    this.#resolving.add(Ctrl);
    try {
      const binding = this.#bindings.get(Ctrl);
      const instance = binding
        ? (binding(this) as T)
        : new Ctrl(...((Ctrl.deps ?? []).map((d) => this.get(d)) as never[]));
      this.#instances.set(Ctrl, instance);
      this.#insertionOrder.push(Ctrl);
      return instance;
    } finally { this.#resolving.delete(Ctrl); }
  }

  public has<T>(Ctrl: ControllerCtor<T>): boolean { return this.#instances.has(Ctrl); }

  public addConsumer(c: unknown): void { this.#consumers.add(c); }
  public removeConsumer(c: unknown): void { this.#consumers.delete(c); }
  public isUnreferenced(): boolean { return this.#consumers.size === 0; }

  public dispose(): void {
    for (let i = this.#insertionOrder.length - 1; i >= 0; i--) {
      const Ctrl = this.#insertionOrder[i]!;
      const inst = this.#instances.get(Ctrl) as { destroy?: () => void };
      try { inst.destroy?.(); } catch (err) { console.warn(`[uc] ${Ctrl.name}.destroy() threw during dispose`, err); }
    }
    this.#instances.clear(); this.#insertionOrder = []; this.#bindings.clear(); this.#consumers.clear();
  }
}
```

The internal cast in `get()` is the single legitimate erasure boundary
(heterogeneous ctor arities) — AGENTS.md #4 allows it.

**Modify** `src/abstract/UploaderRegistry.ts`: retarget the existing
`Map<string, UploaderController>` → `Map<string, ControllerContainer>` (do **not**
add a second map). `whenAvailable`'s callback becomes
`(c: ControllerContainer | null) => void`. `hasConsumers` is unchanged (it counts
`ChildBlock` watchers, orthogonal to what's watched) — but consumer-refcount now
also lives on the container itself (`addConsumer`/`isUnreferenced`); pick one as
the source of truth at implementation time and document it.

**Modify** `src/lit/PubSubCompat.ts`: `_uploader()` lazily creates+caches a
`ControllerContainer`, registers it, and returns `container.get(UploaderController)`
during the bridge window; `_config()`/`_locale()` return
`container.get(ConfigController)`/`get(LocaleController)`.

**Step-2 bridge (keeps everything green):** register one
`bind(UploaderController, (c) => new UploaderController({ events: c.get(EventBus), config: c.get(ConfigController), ... }))`
for already-container-managed fields, defaulting the rest inside
`UploaderController`'s own ctor exactly as today. `bag`/`ctx.read('*X')`/`.X`
getters all still work — the container is pure indirection at this point. **Zero
behavior change.** Tests target the container primitive in isolation (lazy
singleton-per-ctx, topo-resolve, cycle-throw, bind-override, **dispose order**).

---

## Step 3 — Extract eager controllers

Move each eager field to its own container-registered controller. Per-controller
resolution (verified against real ctors):

| Controller | `static deps` | `bind()` factory? | Notes |
|---|---|---|---|
| `ConfigController` | `[]` | no | |
| `LocaleController` | `[]` | no | |
| `EventBus` | `[]` | no | |
| `UploadCollectionController` | `[]` | no | owns orphan state (step 4) |
| `AppInfo` (**new**, tiny) | `[]` | no | `solutionName` signal |
| `LocaleManager` | `[ConfigController, LocaleController]` | no | `.activate(pluginManager)` stays a post-construct call from UI layer |
| `A11y` | `[]` | no | |
| `TelemetryManager` | — | **yes** | `[Config]` eager; `getSolution: () => c.get(AppInfo).solutionName`, `getActivity: () => c.get(RouterController).currentActivity` are lazy closures |
| `EventEmitter` | — | **yes** | widened ctor `(bus, telemetry)`; **absorbs `UploaderController.emit`** — see below |
| `RouterController` | — | **yes** | `emit: (t,p,o) => c.get(EventEmitter).emit(...)` (the *augmented* emit, not raw EventBus) |
| `ClipboardController` | — | **yes** | closures over `c.get(Config/Router/UploaderPublicApi)`; replaces the `setApi()` two-phase dance |
| `PluginController` | — | **yes** | **prerequisite:** its `watchPlugins` closure is ctx-coupled today — a cover-before-refactor sub-PR must repoint it to read `ConfigController` directly. Budget as its own sub-PR; do not let it be silent mid-PR scope creep |

**Augmented emit [CORRECTS SPEC].** `UploaderController.emit` does bus-emit +
un-debounced try/catch telemetry mirror + `_destroyed` no-op; three call sites
(`ChildBlock.emit`, Router's injected `emit`, upload-stack `deps.emit`) depend on
that exact combo. Fold it into `EventEmitter.emit` (widen ctor to take
`TelemetryManager`; `EventEmitter` owns its own `_destroyed`). Audit
`UploaderPublicApi.uploadAll`'s **direct** `bag.eventEmitter.emit` (which bypasses
telemetry today) — decide parity explicitly in the PR, no silent change either way.

**Bridge:** as each field extracts, `UploaderController.X` becomes a getter
delegating to `container.get(X)` (or `bag`/`*X` registration points at
`container.get(X)` — a one-line-per-key change in the registration code, not a
`shared-instances.ts` rewrite). `bag.X` getters stay pointed at `ctx.read('*X')`.

---

## Step 4 — Orphan-state ownership

Composed (not inherited) `StateController` on the owning controllers:

**`UploadCollectionController`** — add `public readonly shared = new StateController<CollectionSharedState>({...})`
holding `uploadList`, `commonProgress`, `collectionState`, `collectionErrors`,
`groupInfo`, `uploadTrigger`; call `this.shared.destroy()` in `destroy()`.

**`PluginController`** — add `public readonly shared = new StateController<{ lazyPlugins: LazyPluginEntry[] | null }>({ lazyPlugins: null })`.

**`src/lit/PubSubCompat.ts`** — add literal-key routing branches (mirroring the
`_cfgName`/`_l10nName` pattern), reusing the existing `_subDerived` helper so
**per-key subscribe granularity is preserved** (a `*commonProgress` write must NOT
fire a `*uploadList` subscriber):

```ts
const COLLECTION_KEYS = { '*uploadList':'uploadList','*commonProgress':'commonProgress',
  '*collectionState':'collectionState','*collectionErrors':'collectionErrors',
  '*groupInfo':'groupInfo','*uploadTrigger':'uploadTrigger' } as const;
// read → collection.shared.get(field); pub → .set(field, v);
// sub → _subDerived(() => shared.get(field), (l) => shared.subscribe(l), cb, init);
// '*lazyPlugins' → pluginManager.shared analogously.
```

**The 9 `stateBridges` closures are untouched here** — their call surface
(`pub`/`read` on `PubSub`) is unchanged; only routing changes internally. Their
direct-injection rewrite is step 5.

**Tests:** per-key granularity (change one field ⇒ only that key's subscriber
fires); `uploadTrigger: Set` dedup is by *reference* — confirm call sites replace
the Set rather than mutate in place.

---

## Step 5 — Upload stack behind container bindings

**Create** `src/abstract/controllers/UploadStackBindings.ts` (DOM-free; imports the
4 upload-stack classes **type-only**, receives concrete ctors as params — preserves
the `@uploadcare/upload-client` bundle boundary):
`registerUploadStackBindings(container, ctors, hostDeps)` binds SecureUploads /
Upload / Validation / UploadEvents, each factory pulling peers via `c.get(...)` and
the augmented `emit` via `c.get(EventEmitter)`. The 9 `stateBridges` become direct
`c.get(UploadCollectionController).shared.set(...)` writes (step 4 already landed
the signals).

**Modify** `src/lit/ensureUploaderScope.ts` (the registration call site — only
invoked from the element layer, still injects the 4 ctors type-only): replace
`ctrl.attachUploaderScope(...)` with `registerUploadStackBindings(...)` +
`container.get(UploadEventsController).observe()`. Idempotent via
`if (container.has(UploadEventsController)) return;`.

The editor assembly never calls `registerUploadStackBindings`, so
`container.get(SecureUploadsController)` is never reached from the editor path →
bundle isolation preserved by the same mechanism as today.

---

## Step 6 — Block base: `static uses` + `this.use()` + `SignalWatcher`

**Modify** `src/lit/ChildBlock.ts` (evolve in place — preserve all ctx-name
resolution / teardown machinery verbatim in shape):

```ts
import { SignalWatcher } from '@lit-labs/signals';
const ChildBlockBase = SignalWatcher(RegisterableElementMixin(LightDomMixin(LitElement)));

export abstract class ChildBlock extends ChildBlockBase {
  public static readonly uses: readonly ControllerCtor<unknown>[] = [];
  private _container: ControllerContainer | null = null;

  protected use<T>(Ctrl: ControllerCtor<T>): T {
    if (!this._container) throw new Error(`${this.tagName.toLowerCase()}: container not available yet — use() from controllerReady() or later`);
    return this._container.get(Ctrl);
  }
  // _adoptController → _adoptContainer(container): set _container, addConsumer(this),
  //   pre-warm each `uses` entry (isolate-and-warn), call controllerReady, requestUpdate.
  // _releaseController → _releaseContainer(): teardown _subs, removeConsumer, controllerReleased.
  // shouldUpdate gate: if (!this._container) return false;
  // disconnectedCallback → setTimeout(0) → teardown chain UNCHANGED in shape;
  //   predicate swaps to container.isUnreferenced(); destroyCtx → container.dispose().
}
```

`SignalWatcher` is applied at the base of the mixin chain (wraps `performUpdate`,
not `render()` — so fully-overridden `render()`/`shouldUpdate()` in leaf blocks
still auto-track). **Verify empirically** with a light-DOM spec that an external
signal mutation re-renders a fully-overridden `render()`.

Legacy `subscriptionsFor`/`subConfigValue`/`subRouter`/`subActivity`/`trackSub`
stay `@deprecated` and functional; retire per-block. Delete them only once a
`src/`-wide grep shows zero callers (tail of step 6 / step 9).

**Representative migration — `Copyright`:**
```ts
export class Copyright extends ChildBlock {
  public static override readonly uses = [ConfigController] as const;
  public override render() {
    const removeCopyright = this.use(ConfigController).get('removeCopyright');
    return html`<a ?hidden=${!!removeCopyright} ...>Powered by Uploadcare</a>`;
  }
}
```
Blocks with genuine imperative side-effects (not "render from a value") keep the
`sub*` helpers until rewritten around `@lit-labs/signals`' `effect()` (out of scope
here; leave a forward-reference comment).

`static uses` is documentation / pre-warm / lifecycle only — **not** the type
source for `use()` (per spec risk note); don't build a mapped union from it.

Migrate the 29 `extends ChildBlock` files group-by-group, each its own gated PR.

---

## Step 7 — Facade removal (`*cfg/*` / `*l10n/*` → direct reads)

Call sites (grep `sharedConfigKey(`, `'*cfg/`, `createL10n(`): `ChildBlock.ts`,
`l10n.ts`, `shared-instances.ts`, `PubSubCompat.ts`, `SourceListController.ts`,
`UploaderPublicApi.ts`, `buildPluginApi.ts`, `createDebugPrinter.ts`,
`LazyPluginLoader.ts`, + editor (§Step 9). Most are a pure reference swap
(`ctx.read(sharedConfigKey(k))` → `this._config.get(k)`), since consumers already
hold injected `ConfigController` refs by now.

`createL10n` signature change: `(getCtx: () => PubSub) → (getLocale: () => LocaleController)`,
reading `getLocale().get(str)`. `ChildBlock.l10n = createL10n(() => this.use(LocaleController))`.

Once all call sites migrate, delete the `_cfgName`/`_l10nName`/`_config()`/
`_locale()` branches in `PubSubCompat`. Note: `subConfigValue` already reads
`this.uploader.config` (not the `*cfg/` facade) — orthogonal to block migration.

---

## Step 8 — Dissolve `UploaderController`

Every field now has a home (`events→EventBus`, `config→ConfigController`,
`locale→LocaleController`, `collection→UploadCollectionController`,
`localeManager→LocaleManager`, `eventEmitter→EventEmitter`,
`telemetryManager→TelemetryManager`, `router→RouterController`, `a11y→A11y`,
`clipboard→ClipboardController`, `solutionName→AppInfo`, `api→UploaderPublicApi`,
upload stack→4 controllers, `emit()→EventEmitter.emit`).

**`UploaderPublicApi` rewrite (largest single diff — cover to 100% first).** Drop
`extends SharedInstance(bag)`; take an explicit deps object
`{ config, locale, collection, eventEmitter, router, getPluginManager, getOutputData }`.
Replace the `SharedInstance` cfg/l10n proxy with direct `ConfigController`/
`LocaleController` reads; `uploadAll`'s `ctx.pub('*uploadTrigger', ...)` →
`collection.shared.set('uploadTrigger', ...)`; `_pluginsReady`'s
`bag.wait('pluginManager')` stays a thunk until Plugin migrates, then collapses to
`container.get(PluginController)`. Constructed via `container.bind(UploaderPublicApi, ...)`.

Public surface repoints: `UploadCtxProvider.getAPI()` → `this.use(UploaderPublicApi)`;
`EventBridgeController` thunk → `() => container.get(EventBus)`; `<uc-config>` →
`this.use(ConfigController)`; `solutionName` → `container.get(AppInfo).setSolutionName`.
`ensureUploaderCtx` creates/registers a `ControllerContainer` (same idempotent
contract). **Delete `UploaderController.ts`.** Exit criterion: clean grep for
`\.uploader\.` and `UploaderController`.

---

## Step 9 — Delete scaffolding + editor repoint

**Editor repoint** `src/blocks/CloudImageEditor/src/editor-config-compat.ts`:
resolve `ConfigController`/`LocaleController`/`TelemetryManager` from the ctx
container (`whenContainer(ctxName, ...)`) instead of `PubSub.whenCtx` + `*cfg/`
routing. **Behavior change [CORRECTS SPEC]:** the old `readConfigPatch` only
emitted a key if set-in-store *or* differing-from-default; `config.get(key)` always
returns a value, so the new initial patch always includes every `EDITOR_CONFIG_KEY`.
This is a deliberate simplification — update `editor-config-compat.test.ts`
assertions to match (documented change, not a loosening). Confirm editor bundle
isolation via `size-limit` on `web/uc-cloud-image-editor.min.js` (≤50 KB, ideally
smaller).

**Delete** (after grep-confirming zero callers, remove co-located tests too):
`PubSubCompat.ts`, `shared-instances.ts`, `SharedState.ts`, the `UploaderRegistry`
controller-map role (read the file fully first — it may retain the ctx→container
registry role), and the `nanostores` dependency. Full green gate + `size-limit`
(dropping nanostores should be a measurable win — if not, a stray re-export exists).
This is inherently the **last** PR, gated on steps 2/3/5/8 all merged.

---

## Cross-cutting

- **Every PR:** full green gate (`tsc:app`, `tsc`, `build`, `test:specs`,
  `test:locales`, `test:e2e`, `lint`); cover touched files to 100% as an additive
  first step (AGENTS.md #1); Conventional Commit; one concern per PR.
- **Coordination point:** steps 3/6 depend on the exact `ControllerContainer`
  consumer-lifecycle API names from step 2 — freeze that interface in step 2.
- **Highest-risk items needing dedicated tests:** dispose ordering
  (collection outlives upload stack); Telemetry/Router DAG across entry orders;
  per-key subscribe granularity (step 4); SignalWatcher + light DOM +
  fully-overridden `render()` (step 6).
- **Blocking risk to surface early:** if `SignalWatcher` internally uses
  standard/ECMA decorators, that violates AGENTS.md ("don't switch decorators") —
  verify from its `.d.ts` in step 1 before committing to the approach.
