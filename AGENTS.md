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
npm run test:specs && \
npm run test:locales && \
npm run test:e2e && \
npm run lint
```

Pre-commit (husky + lint-staged) runs `biome check --write` on staged
`*.{ts,js,cjs,tsx}`. The husky "DEPRECATED" warning on commit is benign.

### Known e2e flake
`tests/cloud-image-editor.e2e.test.tsx` (`getByTestId('uc-crop-frame')`) can
lose a render race under full parallel load but passes in isolation. The e2e
project has `retry: 1` so a transient flake won't fail the gate while a genuine
regression still fails both attempts. Don't "fix" it by loosening assertions.

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
  container — they must **not** import `lit` or touch the DOM.
- **Public JS API:** `element.getAPI()` → `UploaderPublicApi` (a thin `@inject`
  facade resolved from the container). Events dispatch on
  `<uc-upload-ctx-provider>` (`EventType` in `EventEmitter.ts`).

Symbiote and the v1 state layer (`@symbiotejs/symbiote`, `nanostores`,
`PubSubCompat`, `SymbioteCompatMixin`, `shared-instances`/the `$` proxy, the
`LitBlock`/`LitUploaderBlock` hierarchy, and the monolithic `UploaderController`)
are **all gone** — the per-ctx `ControllerContainer` + `@lit-labs/signals` are
the state mechanism.

---

## v2 migration (in progress)

A **strangler migration** is underway, incrementally adopting a v2 architecture
(DOM-free single-responsibility controllers resolved through a per-ctx DI
`ControllerContainer`, `EventBus`, the `Listeners` primitive, a central router)
under the existing v1 public tags — one testable milestone per PR. The
monolithic `UploaderController` god object that once fronted these controllers
has been dissolved (M-god step 8e): blocks resolve the controllers they need via
`ChildBlock.use(Token)`, and the ctx's `ControllerContainer` (registered in
`UploaderRegistry`) is the ownership/teardown unit. **Full plan:
[`MIGRATION-PLAN.md`](./MIGRATION-PLAN.md).**

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
