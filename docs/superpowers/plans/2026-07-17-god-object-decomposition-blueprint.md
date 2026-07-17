# God-Object Decomposition — Implementation Blueprint (composable model)

**Companion to:** `docs/superpowers/specs/2026-07-17-god-object-decomposition-design.md`
**Date:** 2026-07-17 (rev. 2) · **Branch:** `feat/v2-god-object-decompose` → `feat/v2-migration`
**Status:** Blueprint — awaiting approval before step-1 implementation.

Authoritative build doc. Internals are **composed via experimental decorators +
mixins**: no god classes, no mixed responsibilities. All decorator/DI/signal
mechanics below were validated by a strict-TS + experimental-decorator spike.

---

## Verified foundations (from spike)

- `@inject`/`@signalState` are **experimental property decorators** — plain
  decorated fields (**no `accessor` keyword**), defining prototype getters/setters.
- `@inject` resolves **lazily on access** ⇒ mutual/circular controller references
  have **zero construction cycle**. Forward/circular refs **must** use a token
  **thunk** `@inject(() => Other)` (direct reference to a later/circular class is
  a TDZ error at decoration time).
- Container `get()` = `new Token()` → tag `instance[CONTAINER] = this` → cache →
  `init?.()`. Zero-arg constructors; cross-controller wiring is fields, not ctor
  args. `bind(Token, factory)` is **only** for host/boundary values.
- `dispose()` = reverse-insertion order; `Object.is` dedup on signal writes.
- **esbuild decorator determinism** — the root `tsconfig.json` is solution-style
  (`files:[]` + references), so esbuild's decorator mode for `src` files is
  ambiguous; existing Lit decorators are dual-mode and mask it, ours aren't.

---

## Step 1 — Foundation (decorators, container, mixins; no consumers yet)

**Modify** `package.json`: add `"@lit-labs/signals": "^0.3.0"`. Read its `.d.ts`
first; add a **canary test** asserting `signal`/`computed`/`SignalWatcher`/
`Signal.State` exist and that `SignalWatcher` is a plain mixin (no ECMA
decorators). Confirm `signal-polyfill` doesn't break `size-limit`.

**Modify** `vite.config.ts` **and** `vitest.config.ts`: add
```ts
esbuild: { tsconfigRaw: { compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false } } }
```
(merge with vitest's existing `esbuild.jsxInject`). This makes the runtime
transform deterministically experimental, matching `tsc`. **Validate with the
full e2e gate** — this touches every decorator in the codebase; Lit supports
both modes and this is its recommended mode, but prove it green before building on it.

**Create** `src/abstract/di/ControllerContainer.ts` (DOM-free):

```ts
export type Ctor<T> = new () => T;
export type Token<T> = Ctor<T> | (() => Ctor<T>);
export const CONTAINER = Symbol('uc.container');

const isThunk = <T>(t: Token<T>): t is () => Ctor<T> =>
  typeof t === 'function' && !(t as Ctor<T>).prototype;
export const resolveToken = <T>(t: Token<T>): Ctor<T> => (isThunk(t) ? t() : t);

export interface Initializable { init?(): void; }
export interface Destroyable { destroy?(): void; }

export class ControllerContainer {
  #instances = new Map<Ctor<unknown>, unknown>();
  #order: Ctor<unknown>[] = [];
  #resolving = new Set<Ctor<unknown>>();
  #consumers = new Set<unknown>();
  #boundValues = new Map<Ctor<unknown>, (c: ControllerContainer) => unknown>();

  public bind<T>(token: Token<T>, factory: (c: ControllerContainer) => T): void {
    const Ctrl = resolveToken(token);
    if (this.#instances.has(Ctrl)) throw new Error(`[uc] bind(${Ctrl.name}) after resolution`);
    this.#boundValues.set(Ctrl, factory as (c: ControllerContainer) => unknown);
  }

  public get<T>(token: Token<T>): T {
    const Ctrl = resolveToken(token);
    const cached = this.#instances.get(Ctrl);
    if (cached !== undefined) return cached as T;
    if (this.#resolving.has(Ctrl)) throw new Error(`[uc] controller cycle at ${Ctrl.name}`);
    this.#resolving.add(Ctrl);
    try {
      const boundFactory = this.#boundValues.get(Ctrl);
      const inst = (boundFactory ? boundFactory(this) : new Ctrl()) as T & { [CONTAINER]?: ControllerContainer };
      inst[CONTAINER] = this;                 // tag BEFORE init so @inject works in init()
      this.#instances.set(Ctrl, inst);        // cache BEFORE init so re-entrant get() is safe
      this.#order.push(Ctrl);
      (inst as Initializable).init?.();
      return inst;
    } finally { this.#resolving.delete(Ctrl); }
  }

  public has<T>(token: Token<T>): boolean { return this.#instances.has(resolveToken(token)); }
  public addConsumer(c: unknown): void { this.#consumers.add(c); }
  public removeConsumer(c: unknown): void { this.#consumers.delete(c); }
  public isUnreferenced(): boolean { return this.#consumers.size === 0; }

  public dispose(): void {
    for (let i = this.#order.length - 1; i >= 0; i--) {
      const inst = this.#instances.get(this.#order[i]!) as Destroyable;
      try { inst.destroy?.(); } catch (err) { console.warn(`[uc] ${this.#order[i]!.name}.destroy() threw`, err); }
    }
    this.#instances.clear(); this.#order = []; this.#boundValues.clear(); this.#consumers.clear();
  }
}
```

**Create** `src/abstract/di/inject.ts`:

```ts
import { CONTAINER, type ControllerContainer, type Token } from './ControllerContainer';

export function inject<T>(token: Token<T>) {
  return function (target: object, key: string): void {
    Object.defineProperty(target, key, {
      get(this: { [CONTAINER]?: ControllerContainer }): T {
        const c = this[CONTAINER];
        if (!c) throw new Error(`@inject on '${key}': instance not created by a container`);
        return c.get(token);
      },
      enumerable: false,
      configurable: true,
    });
  };
}
```

**Create** `src/abstract/di/signalState.ts`:

```ts
import { signal, type Signal } from '@lit-labs/signals';

export function signalState() {
  return function (target: object, key: string): void {
    const store = new WeakMap<object, Signal.State<unknown>>();
    const sig = (inst: object): Signal.State<unknown> => {
      let s = store.get(inst);
      if (!s) { s = signal<unknown>(undefined); store.set(inst, s); }
      return s;
    };
    Object.defineProperty(target, key, {
      get(this: object): unknown { return sig(this).get(); },
      set(this: object, v: unknown): void {
        const s = sig(this);
        if (Object.is(s.get(), v)) return;
        s.set(v);
      },
      enumerable: true,
      configurable: true,
    });
  };
}
```

Field initializers seed the signal via the setter (`useDefineForClassFields:false`
⇒ `this.field = init` runs in ctor, hitting the prototype setter) — spike-confirmed.

**Create** `src/abstract/di/mixins.ts`: `Disposable(Base)` (a `#disposers`
set + `addDisposer`/`destroy`), `Subscribable(Base)` (a `Listeners` +
`subscribe`/`notify` for coarse compat).

**Tests:** `@inject` (lazy, thunk forward-ref, missing-container throw,
container-tag); `@signalState` (seed-from-init, `Object.is` dedup, tracking under
a watcher); mixins; container (lazy singleton-per-ctx, `bind` override + bind-
after-resolve throw, dispose reverse-order + isolate-and-warn, cycle guard);
canary export test. **No behavior change** — nothing consumes these yet.

---

## Step 2 — Container bridge (keeps everything green)

Goal: introduce the per-ctx `ControllerContainer` as the *creation + ownership*
mechanism for the (still-monolithic) `UploaderController`, with **zero consumer
ripple**. `UploaderController` itself is UNCHANGED (still `deps ?? new`); nothing
is decomposed yet.

**Modify** `src/lit/PubSubCompat.ts`:
- `_controllers: Map<string, UploaderController>` → `Map<string, ControllerContainer>`.
- `_uploader()`: if no container for this ctx, create one, `container.bind(UploaderController, () => new UploaderController({ ...the exact deps built today... }))`, then `const ctrl = container.get(UploaderController)` and register **`ctrl`** (the `UploaderController`, as today) in `UploaderRegistry`; store the container. Return `ctrl`.
- `_config()`/`_locale()` return `_uploader().config`/`.locale` (unchanged shape).
- Teardown (`deleteCtx`): call `container.dispose()` (which calls `UploaderController.destroy()` — the single cached instance) instead of `controller.destroy()` directly; then unregister. Behavior identical.

**Do NOT change** `src/abstract/UploaderRegistry.ts`'s public types — it keeps
storing/yielding `UploaderController`, so `ChildBlock`/`whenAvailable` consumers
are untouched. (Retargeting the registry to `ControllerContainer` happens in
step 6, when block consumers migrate to `this.use()`.)

`bag`/`ctx.read('*X')`/`.X` all still work (UploaderController unchanged). **Zero
behavior change**; tests assert the container is the owner (dispose tears down the
controller) and per-ctx identity is preserved.

---

## Step 3 — Extract eager controllers (single-responsibility)

Each field becomes its own controller with `@inject` deps + `@signalState`
state + zero-arg ctor + optional `init()`. Wiring (all `@inject`, thunk where the
target is declared later/circular):

| Controller | `@inject` deps | `@signalState` | Notes |
|---|---|---|---|
| `ConfigController` | — | config values | |
| `LocaleController` | — | locale strings | |
| `EventBus` | — | — | pure bus |
| `EventEmitter` | `EventBus` | — | **pure dispatch** (no telemetry) |
| `TelemetryController` | `ConfigController`, `() => EventBus`, `() => AppInfo`, `() => RouterController` | — | **observer**: `init()` subscribes `bus.onAny` → `sendEvent`; reads solution/activity lazily |
| `RouterController` | `() => EventEmitter` | `currentActivity` | debounced MODAL_OPEN/CLOSE DOM-emit stays here |
| `A11y` | — | — | |
| `AppInfo` (new) | — | `solutionName` | |
| `LocaleManager` | `ConfigController`, `LocaleController` | — | `.activate(pluginManager)` stays a UI-layer post-construct call |
| `ClipboardController` | `ConfigController`, `() => RouterController`, `() => UploaderPublicApi` | — | replaces the `setApi()` two-phase dance |
| `PluginController` | `ConfigController` | `lazyPlugins` | **prereq:** ctx-coupled `watchPlugins` → read `ConfigController` directly (own cover-before-refactor sub-PR) |

**Telemetry as observer [removes the "augmented emit" god-method].**
`UploaderController.emit` today does bus-emit + un-debounced telemetry mirror.
Now `EventEmitter.emit` is pure; `TelemetryController.init()` does
`this.bus.onAny((type, payload) => this.sendEvent(type, payload))`. Semantics
preserved: bus fires on every emit (telemetry sees all, pre-debounce); the DOM
CustomEvent debounce stays in `EventBridgeController`/`RouterController`. Audit
`UploaderPublicApi.uploadAll`'s direct `eventEmitter.emit` — with telemetry now a
bus observer it will *also* be seen by telemetry; confirm that's desired parity
(likely yes) and note in the PR.

**Bridge:** as each field extracts, its `bag`/`*X` registration point delegates
to `container.get(X)`; `UploaderController.X` becomes a `container.get(X)`
delegating getter. `bag.X` getters stay pointed at `ctx.read('*X')`.

---

## Step 4 — Orphan-state ownership

**Create** `src/abstract/controllers/CollectionStateController.ts` — owns the
derived UI state as `@signalState` fields: `uploadList`, `commonProgress`,
`collectionState`, `collectionErrors`, `groupInfo`, `uploadTrigger`. Separate
from `UploadCollectionController` (raw entries + observer). Writers `@inject` it.

**Modify** `PluginController`: `@signalState() lazyPlugins` (from step 3).

**Modify** `src/lit/PubSubCompat.ts`: add literal-key routing branches (mirroring
`_cfgName`/`_l10nName`, reusing `_subDerived` so **per-key subscribe granularity
is preserved**) mapping `*uploadList`…`*uploadTrigger` →
`container.get(CollectionStateController)` fields and `*lazyPlugins` →
`PluginController`. The 9 `stateBridges` are untouched here (their `pub`/`read`
surface is unchanged; only routing changes). **Test:** a `*commonProgress` write
does not fire a `*uploadList` subscriber; `uploadTrigger: Set` dedup is by
reference — confirm call sites replace rather than mutate.

---

## Step 5 — Upload stack behind host-value binds

**Create** `src/abstract/controllers/registerUploadStack.ts` (DOM-free; imports
the 4 upload-stack classes **type-only**, receives concrete ctors + host hooks
as params): `bind`s the host-value tokens (upload-client SDK, `getFileHooks`,
`getOutputItem`, `onUploadError`, `debug`, …) and, since the 4 controllers use
`@inject` for their controller deps, just needs `container.get(UploadEventsController).observe()`
to trigger the subtree. **Modify** `src/lit/ensureUploaderScope.ts` (element-
layer call site, still injects the 4 ctors type-only) to call it. The 9
`stateBridges` become direct `container.get(CollectionStateController).<field> = …`
writes. Editor assembly never calls this ⇒ upload-client boundary preserved.

---

## Step 6 — Block base: `static uses` + `this.use()` + `SignalWatcher`

**Modify** `src/lit/ChildBlock.ts` (evolve in place; preserve ctx-name resolution
/ teardown machinery verbatim in shape):

```ts
import { SignalWatcher } from '@lit-labs/signals';
const ChildBlockBase = SignalWatcher(RegisterableElementMixin(LightDomMixin(LitElement)));

export abstract class ChildBlock extends ChildBlockBase {
  public static readonly uses: readonly Token<unknown>[] = [];
  private _container: ControllerContainer | null = null;

  protected use<T>(token: Token<T>): T {
    if (!this._container) throw new Error(`${this.tagName.toLowerCase()}: container not available yet`);
    return this._container.get(token);
  }
  // _adoptContainer(c): set _container, c.addConsumer(this), pre-warm `uses`
  //   (isolate-and-warn), controllerReady, requestUpdate.
  // _releaseContainer(): teardown _subs, c.removeConsumer(this), controllerReleased.
  // shouldUpdate: if (!this._container) return false;
  // disconnectedCallback → setTimeout(0) → teardown chain UNCHANGED in shape;
  //   predicate → c.isUnreferenced(); teardown → c.dispose() + drop registry entry.
}
```

`SignalWatcher` at the base wraps `performUpdate` (not `render()`), so fully-
overridden `render()`/`shouldUpdate()` in leaf blocks still auto-track — **verify
with a light-DOM spec** (external signal mutation re-renders an overridden
`render()`). `subConfigValue`/`subRouter`/`subActivity`/`trackSub` stay
`@deprecated` + functional; retire per-block once a `src`-wide grep is clean.

**Representative migration — `Copyright`:**
```ts
export class Copyright extends ChildBlock {
  public static override readonly uses = [ConfigController] as const;
  public override render() {
    return html`<a ?hidden=${!!this.use(ConfigController).removeCopyright} ...>Powered by Uploadcare</a>`;
  }
}
```
(`removeCopyright` is now a `@signalState` field read.) Blocks with genuine
imperative side-effects keep `sub*` until rewritten around `@lit-labs/signals`
`effect()` (out of scope; forward-reference in a comment). `static uses` is
documentation/pre-warm/lifecycle only — not the type source for `use()`. Migrate
the 29 `extends ChildBlock` files group-by-group, each a gated PR.

---

## Step 7 — Facade removal (`*cfg/*` / `*l10n/*` → direct reads)

Call sites (grep `sharedConfigKey(`, `'*cfg/`, `createL10n(`): `ChildBlock.ts`,
`l10n.ts`, `shared-instances.ts`, `PubSubCompat.ts`, `SourceListController.ts`,
`UploaderPublicApi.ts`, `buildPluginApi.ts`, `createDebugPrinter.ts`,
`LazyPluginLoader.ts` (+ editor, §Step 9). Most are a reference swap
(`ctx.read(sharedConfigKey(k))` → injected `this.config.<k>`). `createL10n`
signature: `(getCtx) → (getLocale: () => LocaleController)`. Once migrated, delete
the `_cfgName`/`_l10nName`/`_config()`/`_locale()` branches in `PubSubCompat`.

---

## Step 8 — Dissolve `UploaderController`

**`UploaderPublicApi`** rewrite (largest diff; cover to 100% first): drop
`extends SharedInstance(bag)`; make it a thin `@inject` facade
(`@inject ConfigController/LocaleController/UploadCollectionController/
CollectionStateController/EventEmitter/RouterController/(() => PluginController)`),
delegating only. `uploadAll`'s `ctx.pub('*uploadTrigger', …)` →
`this.collectionState.uploadTrigger = …`. Public repoints:
`UploadCtxProvider.getAPI()` → `this.use(UploaderPublicApi)`; `EventBridgeController`
→ `() => this.use(EventBus)`; `<uc-config>` → `this.use(ConfigController)`;
`solutionName` → `container.get(AppInfo)`. `ensureUploaderCtx` creates/registers a
container. **Delete `UploaderController.ts`.** Exit: clean grep for `\.uploader\.`
and `UploaderController`.

---

## Step 9 — Delete scaffolding + editor repoint

**Editor** `editor-config-compat.ts`: resolve `ConfigController`/`LocaleController`/
`TelemetryController` from the ctx container (`whenContainer(ctxName, …)`).
**Behavior change:** the new initial config patch always includes every
`EDITOR_CONFIG_KEY` (a signal always has a value) — update
`editor-config-compat.test.ts` to match (documented change, not a loosening).
Confirm editor bundle isolation via `size-limit` on
`web/uc-cloud-image-editor.min.js` (≤50 KB, ideally smaller).

**Delete** (grep-confirm zero callers; remove co-located tests): `PubSubCompat.ts`,
`shared-instances.ts`, `SharedState.ts`, the `UploaderRegistry` controller-map
role (read fully first — it may keep the ctx→container registry role), and the
`nanostores` dependency. Full green gate + `size-limit` (dropping nanostores
should be a measurable win). Inherently the **last** PR, gated on steps 2–8.

---

## Cross-cutting

- Every PR: full green gate; cover touched files to 100% additively first;
  Conventional Commit; one concern per PR.
- Freeze the `ControllerContainer` / `@inject` / consumer-lifecycle API in step 1
  — steps 3/6 build against it.
- Highest-risk items needing dedicated tests: esbuild decorator determinism
  (step 1, full e2e); telemetry-observer parity vs today's emit; dispose ordering
  (collection outlives upload stack); per-key subscribe granularity (step 4);
  `SignalWatcher` + light DOM + overridden `render()` (step 6).
