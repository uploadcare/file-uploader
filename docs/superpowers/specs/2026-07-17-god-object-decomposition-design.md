# God-Object Decomposition — Design Spec

**Date:** 2026-07-17
**Branch base:** `feat/v2-migration`
**Status:** Design — awaiting approval before implementation (via feature-dev).

## Goal

Dissolve the `UploaderController` "god object". Replace it with a **per-ctx
dependency-injection container** of small, single-purpose controllers that are
**created lazily and atomically by need** (a block gets only the controllers it
asks for; getting a controller builds only its dependency subtree). Dependencies
between controllers are **declared statically and injected via constructor**.
Reactive state moves to **`@lit-labs/signals`**; `nanostores`, the `*`-key
`SharedState` map, `PubSubCompat`, and the `shared-instances` bag are deleted.
Blocks **declare the controllers they use** (`static uses = [...]`). The
documented public API is preserved throughout.

## Why (the triplication)

Today one instance is reachable three ways, and the whole graph is built at once:

- **`UploaderController.X`** — the god object *owns* every instance: eager in the
  constructor (`UploaderController.ts:201–253`) for events/config/locale/collection
  /localeManager/eventEmitter/telemetry/router/a11y/clipboard, and lazily in
  `attachUploaderScope` (`:328–404`) for the upload stack
  (secureUploads/upload/validation/uploadEvents).
- **`ctx.read('*X')`** — `PubSubCompat._uploader()` lazily builds the controller on
  first config/locale/instance access and registers each instance into the
  nanostores map under a `*`-key.
- **`bag.X`** — `shared-instances` re-exposes those `*`-keys as lazy getters for
  `ChildBlock` (`shared-instances.ts:213–330`).

`StateController` (`StateController.ts`) is a hand-rolled `_state` + coarse
`Listeners` set — no per-key granularity, no computed values. Exactly what signals
replace.

Post-M11 (the v1 element layer is gone), the `*`-key re-exposure exists only to
feed the bag — the indirection has outlived its reason.

## State inventory (where every `*`-key goes)

Three buckets, from `SharedState.ts`:

1. **Re-exposed controller instances** — `*eventEmitter`, `*localeManager`,
   `*telemetryManager`, `*a11y`, `*router`, `*clipboard`, `*pluginManager`,
   `*uploadCollection`, `*publicApi`, `*validationManager`, `*secureUploadsManager`,
   `*uploadController`, `*uploadEvents`, `*sharedContextInstances`.
   → **Dissolve into the container.** Blocks resolve the controller directly.
2. **Config/locale facades** — `*cfg/${K}`, `*l10n/${K}`. → Already single-source
   over `ConfigController`/`LocaleController`; **read the controller's signals
   directly**, drop the facade routing.
3. **Genuine orphan UI/collection state** — `*uploadList`, `*commonProgress`,
   `*collectionState`, `*collectionErrors`, `*groupInfo`, `*uploadTrigger`
   (all collection-derived), and `*lazyPlugins`. These have **no controller owner
   today**. → Assign owners: the collection keys become **signals on
   `UploadCollectionController`**; `*lazyPlugins` becomes a signal on
   `PluginController`.

The 9 `stateBridges` (`UploaderController.ts:81–93`) are closures that write
bucket-3 keys (collection errors + upload-events state). They **disappear**: the
upload controllers write those signals directly through their injected
`UploadCollectionController`, not through bridge closures.

## End-state architecture

### 1. `ControllerContainer` (one per ctx-name)

- A `ctx-name → ControllerContainer` registry replaces `PubSubCompat._controllers`
  and `UploaderRegistry`'s controller map.
- `container.get(Ctrl)` → lazily constructs and caches a **singleton per ctx**.
- **Constructor-injection + static deps.** Each controller declares
  `static deps = [A, B] as const`; the container resolves the deps first
  (topological), constructs the subtree, and injects instances **positionally**.
  Getting a controller builds only its dep subtree — atomic by need.
- **Cycle detection:** the container tracks an in-progress resolution set and
  **throws** on a cycle. The current graph is a DAG (see §2), so this is a guard,
  not a routine path.
- **Upload-client import boundary preserved.** The upload-stack controllers must
  not be statically imported by the abstract/editor layer (they drag
  `@uploadcare/upload-client`). The container supports **binding overrides**:
  `container.bind(Token, factory)`. The uploader assembly (provider / drop-area
  bootstrap, i.e. today's `ensureUploaderScope`) registers concrete bindings for
  the upload-stack tokens; `container.get` uses a registered binding if present,
  else `new Ctrl(...deps)`. The editor assembly never registers them, so the
  editor bundle never pulls them.

```ts
type Ctor<T> = { new (...deps: never[]): T; deps?: readonly Ctor<unknown>[] };

class ControllerContainer {
  #instances = new Map<Ctor<unknown>, unknown>();
  #bindings = new Map<Ctor<unknown>, (c: ControllerContainer) => unknown>();
  #resolving = new Set<Ctor<unknown>>();

  bind<T>(token: Ctor<T>, factory: (c: ControllerContainer) => T): void { /* … */ }

  get<T>(Ctrl: Ctor<T>): T {
    const cached = this.#instances.get(Ctrl);
    if (cached) return cached as T;
    if (this.#resolving.has(Ctrl)) throw new Error(`Controller cycle at ${Ctrl.name}`);
    this.#resolving.add(Ctrl);
    const binding = this.#bindings.get(Ctrl);
    const deps = (Ctrl.deps ?? []).map((d) => this.get(d));
    const instance = binding ? binding(this) : new (Ctrl as new (...a: unknown[]) => T)(...deps);
    this.#resolving.delete(Ctrl);
    this.#instances.set(Ctrl, instance);
    return instance;
  }

  dispose(): void { /* destroy cached instances in reverse insertion order */ }
}
```

### 2. Controllers (the decomposition) and their dependency edges

Derived from the current wiring map. `[]` = no deps.

| Controller | Deps (`static deps`) | Owns (signals) |
|---|---|---|
| `ConfigController` | `[]` | config values |
| `LocaleController` | `[]` | locale strings |
| `EventBus` | `[]` | — |
| `UploadCollectionController` | `[]` | `uploadList`, `commonProgress`, `collectionState`, `collectionErrors`, `groupInfo`, `uploadTrigger` |
| `LocaleManager` | `[Config, Locale]` | — |
| `EventEmitter` | `[EventBus]` | — |
| `TelemetryManager` | `[Config, Router]` (solution via `AppInfo`) | — |
| `RouterController` | `[EventBus]` | `currentActivity` |
| `A11y` | `[]` | — |
| `ClipboardController` | `[Config, Router, PublicApi]` | — |
| `PluginController` | `[]` | `lazyPlugins` |
| `SecureUploadsController` | `[Config]` | — |
| `UploadController` | `[Config, Collection, SecureUploads]` | — |
| `ValidationController` | `[Config, Collection, PublicApi]` | — |
| `UploadEventsController` | `[Collection, Config, Validation, Upload, EventBus]` | — |
| `UploaderPublicApi` | `[Config, Collection, …]` | — |
| `AppInfo` (new, tiny) | `[]` | `solutionName` |

Notes:
- `solutionName` (currently `UploaderController.solutionName`) moves to a tiny
  `AppInfo` controller (a single signal), set by the solution element.
- `currentActivity` (router) and `solutionName` are what `TelemetryManager` reads
  via accessors today — it now takes `Router` + `AppInfo` as deps.
- `ClipboardController`/`ValidationController` depend on `UploaderPublicApi`, which
  depends on config/collection — a DAG (PublicApi does not depend back on them).
- The router's debounced MODAL_OPEN/CLOSE emit (`UploaderController.ts:219–224`)
  moves into `RouterController` itself (it already takes `EventBus`).

### 3. State via `@lit-labs/signals`

- Add `@lit-labs/signals@^0.3.0` (compatible with installed Lit 3.3.2).
- `StateController<T>` becomes **signal-backed**: each field a `signal()`, derived
  values `computed()`. Its public `get`/`set`/`subscribe`/`notify` stay as a thin
  compat surface during migration (so existing subscribers keep working), but the
  target read path for blocks is **direct signal access under `SignalWatcher`**.
- The block base mixes in `SignalWatcher(LitElement)` → automatic fine-grained
  tracking; manual `subscribe`/`trackSub` wiring is retired as blocks migrate.
- **Deleted at the end:** `nanostores` dependency, `SharedState.ts`,
  `PubSubCompat.ts`, `shared-instances.ts`, the `*`-key routing, and
  `UploaderRegistry`'s controller map (controller-availability becomes a signal /
  the container registry).

### 4. Block base — declared dependencies

- New base (evolving `ChildBlock`): `static uses = [ConfigController, UploadCollectionController] as const`.
- On connect the base attaches to the ctx container (self-bootstrapping the
  container if absent), **pre-warms** each `uses` entry, and registers the block as
  a **consumer** of the ctx.
- Blocks read a controller via a typed `this.use(ConfigController)` accessor
  (`= container.get(...)`, cache-hit after pre-warm). `static uses` documents the
  dependency set, drives pre-warm, and drives consumer-lifecycle bookkeeping.
- Render gating: container resolution is synchronous, so no async gate is needed
  once the ctx container exists (it exists as soon as any block in the ctx
  connects). During migration the existing `shouldUpdate` gate is preserved.
- **Lifecycle:** the container owns the consumer refcount (replacing
  `UploaderRegistry.hasConsumers` / `isCtxUnreferenced`). When the last consumer
  disconnects, the container `dispose()`s its controllers (reverse insertion order,
  matching today's reverse-teardown ordering constraint) and the registry entry is
  dropped. The `ChildBlock` teardown chain (`disconnectedCallback` →
  `setTimeout(0)` → teardown-if-unreferenced) is preserved in shape.

### 5. Public surface (backward-compat; `UploaderController` fully dissolved)

- **`<uc-config>`** → writes `this.use(ConfigController)` (today it writes
  `this.uploader.config` — same instance, one hop shorter).
- **`getAPI()`** on `UploadCtxProvider` → `this.use(UploaderPublicApi)`.
  `UploaderPublicApi` is constructed by the container (deps: config/collection/…)
  instead of taking the `bag`.
- **Events** → `EventBridgeController` points at `this.use(EventBus)` /
  `EventEmitter`; DOM dispatch on `<uc-upload-ctx-provider>` is unchanged.
- **`solutionName` / activity** → `AppInfo` / `RouterController`.
- **`attachUploaderScope` / `ensureUploaderScope` / `ensureUploaderCtx`** → become
  container bootstrap + upload-stack binding registration when an uploader element
  (provider / drop-area) is present.

### 6. Editor isolation (falls out)

`editor-config-compat.ts` repoints from `PubSub.whenCtx`/`*cfg/` routing to
resolving `ConfigController` from the ctx container (still now-or-when-created).
Because `UploaderController` no longer exists and the upload stack is behind
container bindings the editor never registers, the editor bundle cannot drag the
uploader graph — the bundle-isolation goal is achieved as a side effect, without
the fragile `sideEffects` tree-shaking approach previously rejected.

## Migration order (strangler; full green gate each PR)

Each step is a PR into `feat/v2-migration`, behavior-preserving, gate-green.
Per AGENTS.md "cover before you refactor," each step brings its touched files to
100% coverage as a purely-additive first move.

1. **Signals foundation.** Add `@lit-labs/signals`; make `StateController`
   signal-backed internally (public API unchanged). No behavior change.
2. **Container.** Introduce `ControllerContainer` + per-ctx registry. Have
   `PubSubCompat._uploader()` delegate to the container, which for now assembles a
   single `UploaderController` binding. Everything still works.
3. **Split eager fields.** Extract the eager controllers (localeManager, telemetry,
   router, a11y, clipboard, plugin — config/locale/events/collection are already
   standalone) into container-resolved controllers with `static deps`. During
   transition, the `bag` getters and `UploaderController.X` getters delegate to
   `container.get`.
4. **Own the orphan state.** Move bucket-3 `*`-keys onto signals of
   `UploadCollectionController` / `PluginController`; the nanostores map delegates
   to those signals during transition.
5. **Split the upload stack.** Turn the upload-stack into container bindings
   (preserving the type-only-import boundary). Replace the 9 `stateBridges` with
   direct signal writes through injected controllers.
6. **Block base.** Introduce `static uses` + `this.use()` + `SignalWatcher`;
   migrate blocks off `bag` / `this.uploader.*` group by group to direct container
   + signal reads.
7. **Drop the facades.** Repoint `*cfg/*` / `*l10n/*` reads to direct
   `ConfigController` / `LocaleController` signal reads.
8. **Dissolve the god object.** Move `getAPI` / events / `solutionName` onto
   container-resolved controllers; delete `UploaderController`.
9. **Delete the scaffolding.** Remove `PubSubCompat`, `shared-instances`,
   `SharedState`, the `UploaderRegistry` controller map, and the `nanostores`
   dependency. Repoint `editor-config-compat` to the container; confirm editor
   bundle isolation via `size-limit`.

## Testing

- Full green gate every PR: `tsc:app`, `tsc`, `build`, `test:specs`,
  `test:locales`, `test:e2e`, `lint`.
- New unit specs: container (lazy creation, per-ctx caching, topological resolve,
  cycle-throw, binding override, dispose order); signal-backed `StateController`;
  each extracted controller; block-base resolution + consumer lifecycle.
- Cover-before-refactor: touched files to 100% as an additive step before each
  behavioral change.

## Risks & mitigations

- **Large surface (~28 blocks + public API + editor).** Mitigated by the strangler
  order and the bag/`*`-key → container delegation bridge, keeping every step green.
- **`static uses` accessor typing.** Provide a typed `this.use(Ctrl)`; keep `uses`
  as documentation/pre-warm/lifecycle rather than the type source, to avoid brittle
  mapped-type gymnastics.
- **Signal ↔ coarse-subscribe interop during transition.** `StateController` keeps
  its `subscribe` surface until blocks move to `SignalWatcher`.
- **Upload-client import boundary.** Enforced by container bindings (no static
  imports in the abstract/editor layer); verified by `size-limit` on the editor
  bundle.
- **Editor↔uploader lifecycle coupling** (the deferred cleanup backlog) — stay
  scope-aware; do not entangle this refactor with those pre-existing bugs.

## Out of scope

- The deferred M10 single `<uc-uploader>` tag + presets.
- The editor↔uploader isolation cleanup backlog (root-lifecycle, updateImage
  dedup, etc.) beyond repointing `editor-config-compat`.
