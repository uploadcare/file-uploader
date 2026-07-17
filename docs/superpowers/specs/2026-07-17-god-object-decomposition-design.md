# God-Object Decomposition — Design Spec

**Date:** 2026-07-17 (rev. 2 — composable model)
**Branch base:** `feat/v2-migration`
**Status:** Design — awaiting approval before implementation (via feature-dev).

## Goal

Dissolve the `UploaderController` "god object". Replace it with **small,
single-responsibility controllers** that are **composed via decorators and
mixins** — no god classes, no mixed responsibilities. A per-ctx container
creates each controller **lazily and atomically by need**; controllers declare
their dependencies as **`@inject` lazy fields** and their reactive state as
**`@signalState` fields** (backed by `@lit-labs/signals`). `nanostores`, the
`*`-key `SharedState` map, `PubSubCompat`, and the `shared-instances` bag are
deleted. Blocks **declare the controllers they use** (`static uses`). The
documented public API is preserved throughout.

## Why (the triplication)

One instance is reachable three ways today, and the whole graph is built at
once: `UploaderController.X` (owns it), `ctx.read('*X')` (nanostores re-exposure,
a v1 strangler bridge), `bag.X` (`shared-instances` getters). `StateController`
is a hand-rolled `_state` + coarse `Listeners` — no per-key granularity, no
composability. Post-M11 the `*`-key re-exposure exists only to feed the bag.

## Composable primitives

These are **experimental** property decorators (`experimentalDecorators: true`,
`useDefineForClassFields: false` — per AGENTS.md; **not** ECMA/standard
decorators, **no `accessor` keyword**). Validated by spike under strict TS.

### `@inject` — lazy dependency fields

```ts
class TelemetryController {
  @inject(ConfigController) private config!: ConfigController;      // plain field, no `accessor`
  @inject(() => RouterController) private router!: RouterController; // thunk for forward/circular refs
}
```

- Defines a **prototype getter** that resolves the token from the owning
  container **on access** (not at construction). Construction never touches a
  dependency — so mutual references (`Router ↔ Telemetry`) have **zero
  construction cycle** (proven in spike). This **eliminates** the earlier
  `static deps`-vs-`bind()`-factory split.
- Accepts a **token thunk** `() => Ctor` for forward/circular references — a
  direct class reference to a later-declared/circular class hits the TDZ at
  decoration time (spike-confirmed). Thunk is the default idiom for
  controller-to-controller injection.
- The container **tags each instance** it builds (`instance[CONTAINER] = this`)
  so `@inject` getters can resolve. Test mocks set the tag or use a real
  container.

### `@signalState` — reactive fields

```ts
class ConfigController {
  @signalState() theme = 'light'; // signal-backed; no base class
}
```

- Defines a prototype getter/setter backed by a per-instance
  `@lit-labs/signals` signal. Reads auto-track under `SignalWatcher`; writes
  dedup with `Object.is`. **No `StateController` base class** — reactivity
  composes per field. For controllers with a fixed set of reactive fields
  (`RouterController.currentActivity`, `AppInfo.solutionName`,
  `CollectionStateController`'s six fields, `PluginController.lazyPlugins`).

### `SignalMap` — reactive dynamic keyspace

For controllers whose state is a **dynamic key bag**, not fixed fields
(`ConfigController` = ~55 `ConfigType` keys + runtime-registered custom keys;
`LocaleController` = arbitrary locale strings), per-field `@signalState` does not
fit. They **compose** (has-a) a small `SignalMap<T>` utility: a lazily-populated
`Map<keyof T, Signal.State>` with `get`/`set`(`Object.is` dedup)/`subscribe`
(coarse, reused `Listeners`)/`values`/`seed`/`destroy`. This is the signal-backed
equivalent of the old `StateController` internals, but as a composable utility a
controller *owns*, not a base class it extends. `set` fires the coarse `subscribe`
listeners so the existing `*cfg/`/`*l10n/` routing keeps working during migration.

### Mixins — cross-cutting behavior

- `Disposable(Base)` — collects disposers, runs them in `destroy()`.
- `Subscribable(Base)` — the coarse `subscribe()` compat surface needed while
  blocks migrate from imperative subscription to `SignalWatcher` reads;
  retired once no consumer needs it.

Controllers compose only what they need. Zero-arg constructors (deps are
`@inject` fields); post-construct wiring goes in an optional `init()` the
container calls after tagging + caching.

## End-state architecture

### 1. `ControllerContainer` (one per ctx-name)

- A `ctx-name → ControllerContainer` registry replaces `PubSubCompat._controllers`
  and `UploaderRegistry`'s controller map.
- `container.get(Token)` — lazily `new Token()`, tags it (`[CONTAINER] = this`),
  caches, then calls `init?.()`; returns the cached singleton per ctx.
- `container.bind(Token, factory)` — **only for host/boundary values**: the
  `@uploadcare/upload-client` SDK, DOM/host callbacks (`getFileHooks`,
  `getOutputItem`, `onUploadError`, `debug`, etc.). Internal controller wiring
  never uses `bind` — it's all `@inject`. The **editor assembly never binds the
  upload-client/upload-stack value tokens**, so the editor bundle can't pull
  them in — bundle isolation falls out (supersedes the dropped tree-shake "B").
- `dispose()` — destroys cached instances in **reverse insertion order**
  (topological construction ⇒ insertion order is a valid reverse-teardown order
  for free; matches today's hand-written reverse teardown). Isolate-and-warn per
  instance.
- Cycle guard: `get` tracks an in-progress set and throws on a true
  construction cycle (with zero-arg ctors + lazy `@inject`, real construction
  cycles cannot arise from injection — the guard covers `init()` misuse).

### 2. Controllers (single-responsibility units)

Every field currently on `UploaderController` becomes its own controller, wired
by `@inject`, state via `@signalState`:

`ConfigController`, `LocaleController`, `EventBus`, `EventEmitter` (pure
dispatch), `RouterController` (owns `currentActivity`), `A11y`,
`ClipboardController`, `LocaleManager`, `TelemetryController`,
`PluginController` (owns `lazyPlugins`), `AppInfo` (owns `solutionName`),
`UploadCollectionController` (raw entries + observer), `CollectionStateController`
(**new** — owns the derived UI state: `uploadList`, `commonProgress`,
`collectionState`, `collectionErrors`, `groupInfo`, `uploadTrigger`),
`SecureUploadsController`, `UploadController`, `ValidationController`,
`UploadEventsController`, `UploaderPublicApi` (thin delegating facade).

Two responsibility splits that kill the remaining "god" smells:
- **Telemetry is an `EventBus` observer**, not folded into `emit`. It `@inject`s
  the bus and, in `init()`, subscribes to `bus.onAny` and forwards to
  `sendEvent`. `EventEmitter` stays **pure dispatch**. Timing is preserved:
  the bus fires on every emit; the DOM-bridge debounce stays at the bridge
  layer; telemetry listens pre-debounce (matches today).
- **`CollectionStateController` is split from `UploadCollectionController`** —
  derived UI state vs. raw entries/observer are two responsibilities, two units.

### 3. State via `@lit-labs/signals`

Add `@lit-labs/signals@^0.3.0` (compatible with installed Lit 3.3.2). Reactive
state is `@signalState` fields on the owning controller. Blocks mix in
`SignalWatcher` and read fields directly. The three `*`-key buckets get real
owners: instances dissolve into the container; config/locale facades read the
controller; orphan UI state lives on `CollectionStateController`/`PluginController`.
Deleted at the end: `nanostores`, `SharedState`, `PubSubCompat`,
`shared-instances`, the `*`-key routing, `UploaderRegistry`'s controller map.

### 4. Block base — declared dependencies

- Evolve `ChildBlock`: `static uses = [ConfigController] as const` (documents +
  pre-warms + drives consumer lifecycle), typed `this.use(Token)` accessor
  (`= container.get(...)`), `SignalWatcher(RegisterableElementMixin(LightDomMixin(LitElement)))`
  base for automatic fine-grained tracking.
- Lifecycle: the container owns the consumer refcount; last consumer out →
  `dispose()`. The existing `disconnectedCallback → setTimeout(0) → teardown`
  chain keeps its shape; only the predicate/teardown target swaps to the
  container.

### 5. Public surface (backward-compat; `UploaderController` fully dissolved)

`<uc-config>` → `this.use(ConfigController)`; `getAPI()` → `this.use(UploaderPublicApi)`;
events → `EventBridgeController` reads `this.use(EventBus)`; `solutionName` →
`AppInfo`; `attachUploaderScope`/`ensureUploaderScope`/`ensureUploaderCtx` →
container bootstrap + host-value `bind`s. `UploaderController.ts` is deleted.

### 6. Editor isolation (falls out)

`editor-config-compat.ts` resolves `ConfigController` from the ctx container.
The editor never binds upload-stack value tokens ⇒ the upload-client stays out
of the editor bundle; verified by `size-limit`.

## Migration order (strangler; full green gate each PR)

1. **Foundation.** Add `@lit-labs/signals`; make `esbuild` decorator handling
   deterministic (`tsconfigRaw.experimentalDecorators` in vite/vitest — see
   risks); ship `@inject`, `@signalState`, `Disposable`/`Subscribable`,
   `ControllerContainer` (+ per-ctx registry) with full unit tests. No behavior
   change (nothing consumes them yet).
2. **Container bridge.** `PubSubCompat._uploader()` creates/caches a container;
   for now it `bind`s a single `UploaderController` facade so `bag`/`*X`/`.X` all
   still work. Zero behavior change.
3. **Extract eager controllers.** Move config/locale/events/collection/
   localeManager/router/a11y/clipboard/telemetry/appInfo/plugin to `@inject`+
   `@signalState` controllers; telemetry becomes a bus observer; split
   `CollectionStateController`. `bag`/`*X` registration points delegate to
   `container.get`. (Plugin's ctx-coupled `watchPlugins` is a cover-before-
   refactor sub-step.)
4. **Own the orphan state.** Orphan `*`-keys route to
   `CollectionStateController`/`PluginController` signals; nanostores map
   delegates during transition (per-key granularity preserved).
5. **Upload stack.** Upload-stack controllers via `@inject` + host-value `bind`s
   registered by the uploader assembly (preserving the upload-client boundary);
   the 9 `stateBridges` become direct signal writes.
6. **Block base.** `static uses` + `this.use()` + `SignalWatcher`; migrate blocks
   off `bag`/`this.uploader.*` group by group.
7. **Drop facades.** `*cfg/*`/`*l10n/*` → direct controller reads;
   `createL10n(() => LocaleController)`.
8. **Dissolve.** Rewrite `UploaderPublicApi` as a thin `@inject` facade; repoint
   `getAPI`/events/`solutionName`; delete `UploaderController`.
9. **Delete scaffolding.** Remove `PubSubCompat`, `shared-instances`,
   `SharedState`, the registry controller-map role, `nanostores`; repoint
   `editor-config-compat`; confirm editor bundle isolation via `size-limit`.

## Testing

Full green gate every PR (`tsc:app`, `tsc`, `build`, `test:specs`,
`test:locales`, `test:e2e`, `lint`). Cover-before-refactor to 100% (AGENTS.md
#1). New unit tests: `@inject` (lazy, thunk/forward-ref, container-tag,
missing-container throw), `@signalState` (seed, dedup, tracking),
`Disposable`/`Subscribable`, container (lazy singleton, bind override, dispose
order, cycle guard), each extracted controller, telemetry-observer wiring, block
base resolution + consumer lifecycle.

## Risks & mitigations

- **Decorator toolchain determinism (step-1 blocker).** esbuild's decorator mode
  for `src` files is ambiguous under the solution-style root tsconfig; existing
  Lit decorators are dual-mode and can't disambiguate. Our `@inject`/
  `@signalState` are experimental-only. Set `esbuild.tsconfigRaw.compilerOptions`
  `{ experimentalDecorators: true, useDefineForClassFields: false }` in
  `vite.config.ts` + `vitest.config.ts`; validate with the **full e2e gate**
  (flipping the runtime transform could affect existing Lit decorators — Lit
  supports both, and experimental+`useDefineForClassFields:false` is its
  recommended mode, but prove it).
- **`SignalWatcher` internals.** Confirm from its `.d.ts` it's a plain mixin (no
  ECMA decorators) before adopting.
- **`signal-polyfill` bundle weight** — verify `size-limit` budgets survive.
- **Large surface (~28 blocks + public API + editor)** — mitigated by strangler
  order + bag/`*`-key → container delegation bridge.
- **Upload-client boundary** — enforced by host-value `bind`s the editor never
  registers; verified by `size-limit`.

## Out of scope

Deferred M10 (`<uc-uploader>` tag + presets); the editor↔uploader lifecycle
cleanup backlog beyond repointing `editor-config-compat`.
