# AGENTS.md

Guidance for AI coding agents (Claude Code, Copilot, Cursor, etc.) working in
this repository. Humans: see also [`CONTRIBUTING.md`](./CONTRIBUTING.md) and
[`README.md`](./README.md). This file is the single source of truth for agent
conventions; tool-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`)
just point here.

---

## What this is

`@uploadcare/file-uploader` — a framework-agnostic **Web Components** file
upload widget (works with React/Vue/Angular/Svelte/plain HTML, no adapters).
Built on **Lit**, with state managed through per-ctx dependency-injected
controllers (a `ControllerContainer` + `@inject`) backed by **`@lit-labs/signals`**.
Ships as ESM library (`dist/`) and bundled browser builds (`web/`).

The public API is documented in a **separate repo**, `fern-docs`
(`~/workspace/fern-docs/fern/pages/file-uploader/*`). That documented surface is
a contract — see [Do not break](#do-not-break).

---

## Setup

```bash
npm ci                      # install deps
npx playwright install chromium   # one-time: required for e2e (browser tests)
```

---

## Build, test, and the green gate

> [!IMPORTANT]
> **Run a full `npm run build` before `test:specs` and `test:e2e`.** Those
> suites consume the built `dist/` + `web/` artifacts and self-resolve the
> package via its `package.json` `exports` (which point at `dist/index.ssr.js`,
> produced by the separate `build:ssr-stubs` step). Running only `build:lib`
> leaves the package unresolvable and the npm-surface / e2e tests fail with
> confusing errors. `dist/` and `web/` are gitignored.

| Command | What it does |
|---------|--------------|
| `npm run tsc:app` | App typecheck (`tsconfig.app.json`, `noEmit`). Fast first check. |
| `npm run build` | `svg-sprites → lib → ssr-stubs → jsx:types`, then `attw` + `publint` + `size-limit`. **Prereq for specs/e2e.** |
| `npm run test:specs` | Vitest **specs** project (happy-dom). Colocated `**/*.test.{ts,js}` + `specs/npm/*.test.ts`. |
| `npm run test:e2e` | Vitest **e2e** project — real Chromium via `@vitest/browser-playwright`. Needs playwright + built `web/`. |
| `npm run test:e2e:dev` | Same, headed, for debugging. |
| `npm run test:locales` | Validates locale dictionaries. |
| `npm run lint` | `biome lint` + `eslint` + `stylelint` + `lit-analyzer --strict`. |
| `npm run lint:js:fix` / `lint:css:fix` | Autofix. |

**The green gate (run all before declaring work done / opening a PR):**

```bash
npm run tsc:app && \
npm run build && \
npm run test:types && \
npm run tsc && \
npm run test:specs && \
npm run test:locales && \
npm run test:e2e && \
npm run lint
```

`test:types` (tsd against `dist/index.d.ts`) and the full `tsc` (all four
projects, not just `tsc:app`) both run in CI and both need the build output, so
they belong after `build`. `tsc:app` alone will not catch a type error that only
`tsconfig.test.json` / `tsconfig.e2e-test.json` / `tsconfig.node.json` sees, and
neither will catch what `tsd` sees: tsd type-checks the **published** `.d.ts`
under its own compiler options, so a public type that only resolves under
`bundler` module resolution passes every `tsc` project and still fails CI.

Pre-commit (husky + lint-staged) runs `biome check --write` on staged
`*.{ts,js,cjs,tsx}`. The husky "DEPRECATED" warning on commit is benign.

### e2e network
The e2e suite talks to `@uploadcare/api-emulator`, run inside the page by
`tests/utils/emulator.browser.ts` and reset before every test, so a run needs no
API access and answers the same way every time. The e2e project therefore has
`retry: 0`: a flake fails the gate. End a negative wait on a sentinel that does
happen, not on a sleep. `E2E_NET=live` runs against the real API instead (with
`retry: 1`); tests that read or steer the emulator skip there via
`it.skipIf(isLive)`.

### e2e camera
Chromium's fake capture device is shared by every page in the browser, and a file recording from it while another
opens the camera leaves the second without video frames. So the files that open the camera are listed in
`CAMERA_E2E` (`vitest.config.ts`) and run one at a time in the `e2e-camera` project, after the rest; `test:e2e` runs
both. A new e2e file that opens the camera goes on that list, and a hand run of one uses `--project e2e-camera`.

---

## Code conventions

- **TypeScript + Lit.** Custom-element tags are prefixed `uc-`.
- **TS experimental decorators** (`@state()`, `@property()`); `tsconfig.app.json`
  sets `experimentalDecorators: true`, `useDefineForClassFields: false`,
  `target: esnext`. Don't switch to standard/ECMA decorators.
- **Formatting = Biome.** Single quotes, space indent, line width 120. Let
  `biome` format; don't hand-format against it.
- **Domain-based file names** (`UploadCollectionController.ts`,
  `fetch-profile.ts`) over technical-role names (`utils.ts`, `types.ts`).
- **Light DOM** rendering (`LightDomMixin`) — components render into their own
  light DOM, not shadow DOM. CSS theming relies on this.
- **Conventional Commits** (lerna `conventionalCommits` drives releases):
  `feat:`, `fix:`, `chore:`, `docs:`, `refactor:` … Scope when useful
  (`fix(thumb): …`). This determines the changelog and version bump.

---

## Repository layout

Single package on `main` (root `package.json` = `@uploadcare/file-uploader`,
**no** workspaces; canonical source is root `src/`).

> [!NOTE]
> A `packages/` directory may appear in the working tree — it is **untracked
> stray cruft** from a `feat/monorepo` checkout (0 tracked files). Ignore it;
> it is safe to `rm -rf packages/`. All work targets root `src/`.

```text
src/
  abstract/        Logic layer: di/ (ControllerContainer, @inject, @signalState, SignalMap), controllers/, managers/, UploaderPublicApi, EventBus, UploaderRegistry, …
  lit/             Block base classes + Lit glue (ChildBlock, ActivityChildBlock, SolutionChildBlock, RegisterableElementMixin, LightDomMixin)
  blocks/          Custom elements (Modal, DropArea, UploadList, Config, CloudImageEditor, …)
  solutions/       Presets (file-uploader regular/minimal/inline)
  plugins/         Built-in plugins (camera, url, external-sources, cloud-image-editor, …)
  locales/         Locale dictionaries
  types/           Public/shared types (types/exported.ts = public data shapes)
  utils/           Internal utilities
tests/             Browser e2e (*.e2e.test.tsx)
*.test.ts          Unit specs, colocated next to source
```

---

## Architecture (current)

- **Composition:** documented multi-tag model — `<uc-config>` +
  `<uc-file-uploader-regular|minimal|inline>` + `<uc-upload-ctx-provider>` +
  `<uc-form-input>`, wired by a shared `ctx-name` string and `@lit/context`.
- **State / DI:** each `ctx-name` owns one `ControllerContainer`
  (`src/abstract/di/ControllerContainer.ts`), registered in `UploaderRegistry`,
  that lazily creates one instance per single-responsibility controller
  (`ConfigController`, `RouterController`, `UploadCollectionController`,
  `CollectionStateController`, `EventEmitter`, `TelemetryManager`,
  `PluginController`, `UploaderPublicApi`, the upload stack, …). Controllers
  declare their dependencies with the experimental `@inject` decorator (lazy
  field resolution; a `() => X` thunk for circular refs) and hold reactive state
  via `@signalState` fields or a composed `SignalMap`, both backed by
  **`@lit-labs/signals`**. There is **no** global store and **no** `*`-keys.
  Host/boundary values (upload-client SDK, DOM hooks, the api/plugin manager for
  editor-bundle-isolated blocks) are provided via `declare`-only bridge tokens
  (`UploadHostBridge`, `PluginManagerBridge`) + `container.bind`.
- **Base classes:** `ChildBlock`
  (`SignalWatcher(RegisterableElementMixin(LightDomMixin(LitElement)))`) is the
  block base; `ActivityChildBlock` / `SolutionChildBlock` / `FileItemConfig`
  extend it. Blocks declare `static uses = [...]` and resolve controllers via
  `this.use(Token)` / `useOrNull(Token)` / `container.whenController(Token, cb)`,
  reading reactive state via `getTracked(...)` under `SignalWatcher` (imperative
  reads use `get(...)`). Controllers are plain DOM-free classes owned by the
  container — they must **not** import `lit` or touch the DOM. A Biome
  `noRestrictedImports` override in `biome.json` fails any `src/abstract` import of
  `lit`, `src/lit`, `src/blocks` or `src/solutions` (specs are exempt). Shared
  DOM-free pieces live in `src/abstract`, `src/utils` or `src/types`; controllers
  that do need the DOM (`A11y`, `ClipboardController`) live in `src/lit`.
- **Public JS API:** `element.getAPI()` → `UploaderPublicApi` (a thin `@inject`
  facade resolved from the container). Events dispatch on
  `<uc-upload-ctx-provider>` (`EventType` in `EventEmitter.ts`).

Symbiote and the v1 state layer (`@symbiotejs/symbiote`, `nanostores`,
`PubSubCompat`, `SymbioteCompatMixin`, `shared-instances`/the `$` proxy, the
`LitBlock`/`LitUploaderBlock` hierarchy, and the monolithic `UploaderController`)
are **all gone** — the per-ctx `ControllerContainer` + `@lit-labs/signals` are
the state mechanism.

---

## Async work and lifetimes

Async work that can outlive its owner (a block unmounted mid-await, a ctx torn down while an upload is queued) binds
to the owner's **lifetime** and stops at its next guarded await. Every owner holds one `Lifetime`
(`src/abstract/di/Lifetime.ts`), ended first thing on teardown:

| Owner | One lifetime per | API |
|-------|------------------|-----|
| `ChildBlock` | adoption | `runTask(task)`, `whileAdopted(work, dispose?)`, `adoptionSignal` |
| `EditorBlock` | attached editor controller | same three names |
| container-built controller | ctx container (ended in `dispose()`) | `lifetimeOf(this)` → `.run(task, onError)`, `.guard(work, dispose?)`, `.signal` |

How to bind work — reference conversions: `CameraSource.ts`, `Thumb.ts`, `UploadController.ts`:

1. Start every async entry point (event handler, `controllerReady`, observer callback, timer tick) with `runTask` /
   `lifetime.run`. It starts synchronously, swallows the lifetime's abort and logs any other error. Lint enforces it:
   `@typescript-eslint/no-floating-promises` with `ignoreVoid: false` rejects an unhandled or `void`-ed promise in `src/`.
2. Wrap every await of outside work (browser API, `fetch`, image preload, `updateComplete`, a plugin hook) in
   `whileAdopted` / `guard`. Pass `dispose` for a resource that leaks if it arrives late (a media stream, an object
   URL). After the await, read `@inject` fields directly.
3. Hand `adoptionSignal` / `.signal` to every API that takes one (`addEventListener`, `fetch`, upload-client) so it
   cleans up on its own.
4. A `catch` that wraps a guarded await opens with `if (isAbortError(error)) throw error;`, so the abort reaches
   `runTask` instead of being reported as a failure.
5. Rate-limited handlers on `ChildBlock` / `EditorBlock` use `@debounced` / `@throttled`
   (`src/lit/rate-limited-method.ts`): a call after release no-ops and a pending one is cancelled;
   `cancelPending(this._method)` cancels one by hand.

**Nothing leaves a destroyed uploader** — no request, telemetry, DOM event, or user callback (validator, resolver,
plugin hook). Each outlet drops at its single exit, so call sites stay plain: `EventBus.emit` (every DOM event, `api.on`
and telemetry go through it), `TelemetryManager.sendEvent`, and the entry's `AbortController`, which the ctx lifetime
aborts mid-upload. A new outlet gets the same guard at its exit. Reading a disposed container throws
(`[uc] X read after the ctx container was disposed …`): that error marks work outliving its uploader — bind the work,
don't catch the error. Pinned by `tests/flow/destroy.e2e.test.tsx`; moving the uploader in the DOM by
`tests/flow/remount*.e2e.test.tsx`.

A guard stays only where absence is normal rather than late: `@injectOrNull` / `useOrNull` for a dependency bound
later or conditionally (uploader-scope tokens, `PluginController`), a render path that runs before adoption, a
synchronous check during connect. Watch out:

- The guard checks when the awaited work settles. A request already on the network keeps running unless it received
  the signal.
- An unguarded await still resumes after teardown — guard each one, not just the first.
- A synchronous DOM move keeps the ctx but releases and re-adopts every block, so block tasks restart; only a gap of
  a macrotask destroys the ctx (`ChildBlock._teardownCtxIfUnreferenced`).
- Only container-built instances have a ctx lifetime. `A11y` is also built with `new` by the standalone editor, so it
  keeps its `_destroyed` flag.

## CDN URLs

Every CDN URL is built and read through **`@uploadcare/cdn-url`**. The v1 string
helpers (`cdn-utils.ts`: `createCdnUrl`, `extractUuid`, `trimFilename`, …) are gone —
they did regex surgery, returned best-effort garbage for input they didn't understand,
and one of them corrupted any path whose last segment recurred earlier.

- **Import library names from `@uploadcare/cdn-url` directly.** There is no re-export
  barrel: `src/utils/cdn/` holds only what is ours — `operations.ts`
  (`operationsFromModifiers`, `withOperations`) and `origin.ts` (`DEFAULT_CDN_ORIGIN`,
  `deliveryProxyOrigin`) — and everything else (`parseFileUrl`, `serializeFileUrl`,
  `modifiers`, `serializeOperations`, …) comes from the package. A barrel that just
  renamed the import path bought nothing and hid which library surface is actually in
  use. `@uploadcare/cdn-url/ops` is the sibling entry for operation *constants and
  types* (`FILTER_NAMES`, `FilterName`, `Quality`) — the editor's filter list needs it
  at runtime.
- **`parseCdnUrl` / `serializeCdnUrl` are banned by lint,** not by omission from a
  barrel — `biome.json`'s `style/noRestrictedImports` names them. Nothing needs the
  kind-dispatching pair, and every bundle measured smaller once the last consumer moved
  to `parseFileUrl` / `serializeFileUrl`. Lift the rule only alongside a call site that
  genuinely handles more than one URL kind.
- **`parseFileUrl` throws for anything that is not a single stored file** — a group,
  a group element, a delivery-proxy URL, a non-CDN URL. That is deliberate: most call
  sites here only ever handle single-file URLs (a thumbnail, an editor source, an
  upload entry), and discriminating on `kind` at those sites invents behaviour for
  input that should not arrive. The boundaries that can receive user input catch and
  degrade instead — `ImgBase._getUrlBase`, the editor's `updateImage`,
  `parseCdnUrlForEntry`, `secureDeliveryProxyUrl`, `Thumb._generateThumbnail`,
  `applyInitialCrop`. Adding a new call site means deciding which of those it is.
- **Build what you author, parse what the user supplies.** Operations the code writes
  itself are typed literals (`modifiers('format/auto', \`resize/${size}x\`)`, the
  `OperationLiteral` union). Values arriving from users — `<uc-img>`'s
  `format`/`quality`/`resize`/`blur`/`cdn-operations` from CSS custom properties and
  attributes, a stored `cdnUrlModifiers` — stay strings and go through
  `operationsFromModifiers`, which parses. Do **not** route user input through the
  `/ops` creators: their validation is `__DEV__`-gated, so a valid-but-unknown CDN
  value throws in the dev build and passes in production.
- **`unsafeOperation` is the one sanctioned cast.** The literal union cannot express a
  uuid (`overlay/<uuid>`) or an `@`-prefixed internal directive (`@clib`), so those go
  through it rather than a hand-written `as`.
- **The tiny URL API (`tinyParse`/`tinyBuild`) is not used here, on purpose.**
  Measured: putting `withOperations` on it took the editor bundle 49.14 → 49.38 KB
  brotli, because `parseFileUrl`/`serializeFileUrl` stay in every bundle for the
  upload-entry parse, the editor's read path and `<uc-img>`'s src handling — so tiny
  is added weight, not a replacement. Going tiny-only would recover ~0.5 KB and cost
  the uuid validation behind `addFileFromCdnUrl`'s documented error, the kind
  discrimination the editor and `<uc-img>` degrade on, and `CdnOperation` itself,
  which the editor's merge needs because it matches operations by name. Re-measure
  before revisiting.
- **Bundle budgets are tight and `size-limit` runs inside `npm run build`.** The
  editor sits near 49.1 KB of 51, the IIFE near 98.7 of 100, `<uc-img>` near 9.0 of
  10. Treat ~100 B as build-to-build variance and do not quote a single run to tighter
  precision. If a change crosses a limit, that is a decision to raise the budget or
  trim, not something to work around.
- **The editor bundle may not contain the upload stack.** Its build item lists
  `forbiddenModules` (`scripts/build-items.ts`); the build fails naming the module and
  the import chain that brought it in. Fix the chain (usually a value import that only
  needed a type, or a class named as a token) rather than the list.
- **The dependency is pinned to an alpha** (`6.20.0-alpha.*`, exact, no caret). It
  must not reach a published release as-is — a stable version has to land first.

---

## v2 migration (in progress)

A **strangler migration** is underway, incrementally adopting a v2 architecture
(DOM-free single-responsibility controllers resolved through a per-ctx DI
`ControllerContainer`, `EventBus`, the `Listeners` primitive, a central router)
under the existing v1 public tags — one testable milestone per PR. The
monolithic `UploaderController` god object that once fronted these controllers
has been dissolved (M-god step 8e): blocks resolve the controllers they need via
`ChildBlock.use(Token)`, and the ctx's `ControllerContainer` (registered in
`UploaderRegistry`) is the ownership/teardown unit.

- Integration branch: **`feat/v2-migration`**; each milestone branches off it
  and PRs back into it (`feat/v2-m<N>-<name>` → `feat/v2-migration`).
- The DOM-free controller layer lives in `src/abstract/` (e.g.
  `controllers/ConfigController.ts`, `controllers/RouterController.ts`,
  `di/ControllerContainer.ts`, `EventBus.ts`, `host-subscription.ts`,
  `UploaderRegistry.ts`). Controllers must **not** import `lit` or touch the
  DOM — UI bridging belongs in the element/adapter layer.
- Every milestone must pass the **full green gate including e2e** before merge.

---

## Do not break

- **Documented public API** (tags, ~55 `<uc-config>` options, `getAPI()`
  methods, 19 events, `--uc-*` CSS variables, the plugin API, and the
  `OutputFileEntry`/`OutputCollectionState` data shapes) defined in `fern-docs`.
  Until a future major, keep it working — add compat shims rather than breaking.
- **Undocumented** surface (the `$` proxy, `*`-prefixed keys, internal managers,
  `--cfg-*` CSS vars, `static template` setter) **may** change freely.

---

## Working agreements for agents

1. **Cover before you refactor.** Before changing existing functionality, first
   bring it (or its drop-in replacement) to **100% test coverage**, as a
   separate, purely-additive step — so the refactor has a safety net and
   behavior is provably preserved. Add new test cases only; never modify or
   weaken existing ones. Measure with `vitest --coverage` and confirm the
   touched files hit 100% before touching the code.
2. **Verify, don't claim.** Run the relevant gate commands and report real
   output. "Tests pass" requires having run them.
3. **Don't loosen tests or swallow errors** to make something pass. Fan-out
   paths isolate-and-warn (see `EventBus.emit` / `Listeners.notify`); follow
   that pattern rather than hiding failures.
4. **Write disciplined TypeScript.** Invoke the `typescript` skill when writing
   non-trivial TypeScript. Avoid unnecessary type assertions and `any`/`unknown`
   — prefer precise types, generics, and narrowing. Reserve casts for genuine
   boundaries (test mocks of large types, branded-type bridges, conditional-type
   defaults) and keep them as narrow as possible (`as { type?: string }`, not
   `as any`). `tsc:test` (run by the pre-commit hook) type-checks test files too.
5. **One concern per PR**, with a Conventional-Commit title and the gate green.
6. **Match surrounding code** — comment density, naming, idioms.
7. **Don't `git stash pop` blindly** — a pre-existing user stash
   (`temp-package-json-before-release-branch`) conflicts on `package.json`.
