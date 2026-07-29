# v1 → v2 Strangler Migration Plan

> Incremental adoption of the v2 architecture into the shipping v1
> `@uploadcare/file-uploader`, one testable milestone at a time, without a
> single huge risky diff. The v2 spike (`worktree-v2-spike`) is the reference
> target; this plan re-derives it as a sequence of safe steps on top of `main`.

---

## 0. Status — 2026-07-30

The migration is **effectively complete on `feat/v2-migration`** (integration PR
#1048 → `main`, ~50 commits ahead). Sections 2–9 are kept for the historical
record; where they describe machinery, read them as *what the plan was*, not
what the code is. The deltas that matter:

| Plan says | Reality |
|-----------|---------|
| M0–M9 sequenced ahead | **Done.** The v1 engine is gone: no `PubSubCompat`, `SymbioteCompatMixin`, `SharedState`, `LitBlock`, `LitActivityBlock`, `ModalManager`, `CTX.ts`, `$` proxy, `*`-keys, or nanostores. State lives in the per-ctx `ControllerContainer` + `@lit-labs/signals`. |
| M10 = deferred `<uc-uploader>` plus `uc-uploader-regular\|minimal\|inline` preset tags | **Shipped differently (#1056):** one `<uc-uploader mode="regular\|minimal\|inline">` host (`src/solutions/file-uploader/Uploader.ts`). No preset tags; `<uc-file-uploader-*>` stay real solutions, now sharing `layout-fragments.ts` + `<uc-upload-list chrome="…">` (#1057). |
| M11 = delete undocumented internals | **Done except one item:** `CssDataMixin` + `--cfg-*` reads survive in `src/blocks/Img/` (`CssDataMixin.ts`, `ImgConfig.ts`), deliberately left in place. Everything else on the M11 list is already absent from `src/`. |
| Facade router (§3) keeps both engines alive per domain | Gone — there is no facade left to delete. |

**Debt found while auditing M11 — since fixed.** `trimFilename` in
`src/utils/cdn-utils.ts` stripped the filename with a substring `replace`, removing
the *first* matching occurrence rather than the trailing segment, so it mangled any
CDN path whose last segment repeated earlier (`/a/a` → `//a`). `createCdnUrl` papered
over only the leading-`//` case, and `extractCdnUrlModifiers` / `extractOperations`
inherited the bad path.

That whole module is gone. CDN URLs are built and read through
`@uploadcare/cdn-url` behind `src/utils/cdn` (see AGENTS.md → "CDN URLs"), which
retires the bug by construction: structural parsing has no substring surgery to get
wrong. Two smaller ones went with it — `secureDeliveryProxyUrl` parsed the same URL
three times, and `parseCdnUrl` called `new URL()` outside its `try`, so
`addFileFromCdnUrl('not a url')` threw a raw `TypeError` instead of the documented
`Error('Invalid CDN URL')`.

---

## 1. Goal & decisions

| Decision | Choice |
|----------|--------|
| **End-state** | **Full v2, incrementally.** Reach the complete v2 architecture (single composable `<uc-uploader>` tag, central router, no compat shim). Documented public API kept working via compat shims until a future **major** release, then dropped. |
| **Core mechanism** | **Strangler facade.** `UploaderController` becomes the real state engine; v1's `$` / `cfg` / `sub` / `pub` are reduced to a thin facade that delegates to controllers, flipped **one domain at a time**. Blocks stay unchanged until their domain migrates. |
| **Single `<uc-uploader>` tag** | Was **deferred** to M10; landed as a `mode`-attribute host rather than preset tags — see §0. |
| **Green gate** | **e2e green every milestone** (plus app typecheck, specs, build). The 24 e2e tests exercise the documented contract — they are the strangler's safety net. |
| **What we may break** | Anything **undocumented**: the `$` proxy, `*`-prefixed keys, internal managers, `--cfg-*` CSS vars, `static template` setter, nanostores. |
| **What we must NOT break** | The documented contract (§4) until the future major. |

**Repo facts as of the plan's start (verified on `main`, commit `bea13694`) — historical:**
- Single package: root `package.json` = `@uploadcare/file-uploader`, **no** workspaces. Canonical source = root `src/` (376 tracked files), root `tests/`.
- The working-tree `packages/` directory is **untracked stray cruft** from a `feat/monorepo` checkout (0 tracked files, not gitignored). Safe to `rm -rf packages/`. This plan targets root `src/` only.
- Runtime is already **Lit + nanostores** — Symbiote is gone; `SymbioteCompatMixin` is just a nanostores-backed compat shim. So this is a state-engine + routing migration, **not** a framework rewrite.
- A `src/abstract/controllers/` directory already exists on `main` (minimal) — confirm its contents before M0 to avoid collisions.

---

## 2. The two engines *(historical — the v1 engine no longer exists)*

**v1 engine — `PubSub` (`src/lit/PubSubCompat.ts`)**
One nanostores `MapStore` per `ctx-name`, reached via the `$` proxy and `sub`/`pub`/`read`/`add` in `SymbioteCompatMixin`. Flat string keys: `*cfg/<key>`, `*currentActivity`, `*history`, `*uploadList`, `*l10n/<key>`, plus singleton-instance keys (`*blocksRegistry`, `*pluginManager`, `*eventEmitter`, `*validationManager`, …). `ctx-name` propagates through the DOM tree via `@lit/context`.

**v2 engine — `UploaderController` (`src/abstract/controllers/UploaderController.ts` on the spike)**
Structured sub-controllers (`config`, `router`, `locale`, `validation`, `collection`, `secureUploads`, `upload`, `plugins`, `sources`, `clipboard`, `telemetry`, `api`, `events`/`EventBus`). Each holds plain state + a 23-line `Listeners` set (`host-subscription.ts`). **Zero** `lit`/DOM imports. DOM is bridged by thin adapters (`Uploader.ts`, `ChildBlock.ts`, `ui-adapters.ts`).

---

## 3. The facade mechanism (built once, in M0) *(historical — fully removed)*

`PubSub` gains a **per-key-namespace router**:

- For keys whose namespace has been **migrated**, `read` / `pub` / `sub` / `add` delegate to the owning sub-controller. A controller's `Listeners.subscribe` is adapted to the nanostores-shaped `sub(key, cb, init)` signature so existing subscribers keep working unchanged.
- For all other keys, `PubSub` uses nanostores exactly as today.

**Migrating a domain = flipping its key namespace from nanostores-backed to controller-backed.** Because the facade is bidirectional and lossless per domain:
- Un-migrated blocks reading `this.$['*cfg/multiple']` and new code reading `controller.config.values.multiple` observe the **same value**, both directions, with subscriptions firing on either path.
- This is what keeps e2e green while domains flip over one at a time.

Per-domain facade adapters are deleted in M11 once no block reads via `$` anymore.

---

## 4. Documented contract — DO NOT BREAK (until future major)

Source: `fern-docs/fern/pages/file-uploader/*`.

- **Tags:** `<uc-config>`, `<uc-file-uploader-regular|minimal|inline>`, `<uc-upload-ctx-provider>`, `<uc-form-input>`, `<uc-cloud-image-editor>`, `<uc-icon>`. The `ctx-name` string-bus wiring between them is the documented integration pattern.
- **Config:** ~55 `<uc-config>` options, each as kebab attribute + camel DOM property, with documented attribute⇄property reactivity. (`enableVideoRecording` is documented-deprecated.)
- **JS API** via `uc-upload-ctx-provider.getAPI()`: `getOutputItem`, `getOutputCollectionState`, `addFileFromObject/Uuid/Url/CdnUrl`, `removeFileByInternalId`, `removeAllFiles`, `uploadAll`, `initFlow`, `doneFlow`, `setCurrentActivity`, `setModalState`, `historyBack`, `on`, `l10n`, `cfg`. Module fns: `defineComponents`, `defineLocale`, `loadFileUploaderFrom`, `EventType`. Global IIFE name `UC`.
- **Events (19)** on `<uc-upload-ctx-provider>`: `file-added`, `file-removed`, `file-upload-{start,progress,success,failed}`, `file-url-changed`, `modal-{open,close}`, `done-click`, `upload-click`, `activity-change`, `common-upload-{start,progress,success,failed}`, `change`, `group-created`. Plus `<uc-cloud-image-editor>`: `apply`/`change`/`cancel`.
- **CSS:** ~40 `--uc-*` custom properties, theme classes `uc-light`/`uc-dark`, cascade layers (`uc`, `uc.base`, `uc.shared`, …), plugin-activity classes (`.uc-ui-*`). Internal class names (`.uc-toolbar`, etc.) are **explicitly non-public**.
- **Plugin API:** `uc-config.plugins`; `pluginApi.registry.{registerSource,registerActivity,registerFileAction,registerFileHook,registerConfig,registerIcon,registerL10n}`; `pluginApi.{config,activity,files}`; reserved built-in IDs (`camera`, `url-source`, `external-sources`, `cloud-image-editor`, `image-shrink`); `CustomActivities`/`CustomConfig` TS augmentation.
- **Data shapes:** `OutputFileEntry`, `OutputCollectionState` field names are a read contract for event handlers/validators.

---

## 5. Green gate (every milestone)

Run, in order — all must pass before the milestone is "done":

1. `npm run tsc:app`
2. `npm run test:specs` (120 files / 1272 tests as of 2026-07-25; was 239 tests when this plan was written)
3. `npm run test:locales`
4. `npm run build:svg-sprites && npm run build:lib` — **prerequisite for e2e** (the `bundles.e2e` test reads `web/` artifacts; a clean tree has none)
5. `npm run test:e2e` (54 files as of 2026-07-25; was 24 files / 187 tests when this plan was written)
6. `npm run build` (incl. `test:attw`, `test:publint`, `lint:size`) at milestone boundaries
7. `npm run lint`

**Baseline (measured on `main`, 2026-06-09):**
- specs: green.
- e2e: **186/187 green.** One **flake**: `tests/cloud-image-editor.e2e.test.tsx` → `getByTestId('uc-crop-frame')` fails under full 24-file parallel browser load but passes **5/5 in isolation**. Treat as flake; do not let it mask a regression.

**e2e prerequisites (one-time / CI):**
- `npx playwright install chromium` (binary `chromium-1208`; was missing locally). Playwright pinned at **1.58.2** — note prior guidance about keeping playwright recent to avoid an install-hang; 1.58.2 installed cleanly here.
- `web/` artifacts must exist → run `build:lib` first.

**Flake handling for the gate:** configure an e2e retry (or run cloud-image-editor isolated) so the known crop-frame flake can't fail the gate, while any *new* failure still does.

---

## 6. Milestone sequence (dependency-ordered)

| # | Milestone | Domain / keys facaded | Documented contract held | Risk | Status |
|---|-----------|-----------------------|--------------------------|------|--------|
| **M0** | Foundations & safety net | — (no behavior change) | all | low | done |
| **M1** | Config | `cfg`, `*cfg/*` | `<uc-config>` 55 attrs/props + attr⇄prop reactivity | med | done |
| **M2** | Locale | `*l10n/*`, `l10n()` | `defineLocale`, `localeName`, `localeDefinitionOverride` | low | done |
| **M3** | Collection + Validation | `*uploadList`, per-entry state | `addFileFrom*`, `removeAll*`, `getOutputItem`, `getOutputCollectionState`, validators | **high** | done |
| **M4** | Upload + Secure uploads | `*uploadQueue`, progress | `uploadAll`, secure-upload resolvers | med | done |
| **M5** | Events | `*eventEmitter` | 19 provider events, `EventType`, `api.on()` | med | done |
| **M6** | Plugins + Sources | `*pluginManager`, `*lazyPlugins` | plugin API + built-in plugin IDs | high | done |
| **M7** | Router (the swap) | `*currentActivity`, `*history`, `ModalManager` | `setCurrentActivity`, `setModalState`, `initFlow`, `doneFlow`, `historyBack`, activity/modal events | **high** | done |
| **M8** | Clipboard + Telemetry | remaining singletons | `pasteScope`, `qualityInsights` | low | done |
| **M9** | UI adapter base classes | — (port blocks off `$`) | every tag's rendered behavior | high | done |
| **M10** | Single `<uc-uploader>` tag + presets | — (additive new tags) | v1 tags become shims | med | **shipped as `mode` attr, no preset tags (§0)** |
| **M11** | Remove undocumented internals | delete facade + shim | documented tags survive as shims to future major | med | **done except `Img`'s `CssDataMixin`/`--cfg-*` (§0)** |

> End of **M8**: `PubSub` holds zero independent state — internal architecture is fully v2. M9–M11 peel away the v1 element layer itself.

---

## 7. Per-milestone detail

### M0 — Foundations & safety net
**Do:**
- Branch off `main` (e.g. `feat/v2-strangler`).
- Pin the e2e baseline: install chromium, build lib, run `test:e2e`, document the command + the cloud-image-editor flake, add the retry/isolation so the gate is trustworthy.
- Land **pure additive primitives** with unit tests but **zero wiring**: `Listeners` (`host-subscription.ts`), `EventBus`, the `src/abstract/controllers/` tree (port from spike), `UploaderRegistry`, and the **facade router** inside `PubSubCompat` (dormant — no namespace migrated yet).
- Reconcile with the controller scaffolding already present on `main`.

**Exit:** full gate green; no behavior change (controllers instantiated nowhere, or instantiated inert).
**Risk note:** instantiating `UploaderController` must be side-effect-free until a domain is wired — guard telemetry pings and the async CDN-cname derivation so M0 stays a no-op.

### M1 — Config (facade proof-of-concept)
`ConfigController` becomes source of truth. `cfg` proxy + `*cfg/*` keys delegate to it. `<uc-config>`'s attribute/property reactivity re-expressed via `bindConfigToElement` (`ui-adapters.ts`). Custom plugin config keys (`registerConfig`) routed through `config.register`.
**Watch:** `--cfg-*` CSS vars read by `CssDataMixin.getCssData` (undocumented; a few layout values) — keep reading them into `ConfigController` for now, drop in M11. Default-value parity between v1's lazy `cfg` add and `ConfigController.register`.
**Exit:** `config.e2e`, `custom-config.e2e` green; full gate.

### M2 — Locale
`LocaleController` source of truth; `*l10n/*` keys + `l10n()` + `defineLocale` facade over it; plugin `registerL10n` → `locale.merge`. ICU plural parity.
**Exit:** `icon-and-l10n.e2e`, localization specs green; full gate.

### M3 — Collection + Validation (data-model heart) — **high risk**
`UploadCollectionController` + `ValidationController` own the upload list and validation. Documented `getOutputCollectionState`/`getOutputItem`/`OutputFileEntry` shapes must stay byte-compatible.
**Hard part:** v1 gives **each upload entry its own `PubSub` context** (keyed by entry UID via `TypedCollection`/`TypedData`); v2 uses a single `UploadCollection` store. The facade must map per-entry reads/writes onto collection entries. User `fileValidators`/`collectionValidators` keep their documented signatures (validator receives `UploaderApi` as `api`; collection validator receives `OutputCollectionState`).
**Exit:** `validation.e2e`, `api.e2e`, `file-hook-validators.e2e` green; full gate.

### M4 — Upload + Secure uploads
`UploadController` + `SecureUploadsController` own the upload-client queue, progress, abort, `beforeUpload` hook chain. `uploadAll` and `secureUploadsSignatureResolver`/`secureDeliveryProxyUrlResolver` preserved.
**Exit:** upload-flow e2e green; full gate.

### M5 — Events
`EventBus` becomes the internal backbone; documented DOM `CustomEvent`s on `<uc-upload-ctx-provider>` bridged via `bindEventBusToElement`. `EventType` constants, `api.on()`, `silent` suppression preserved. `UploadCtxProvider` remains the dispatch target.
**Exit:** event assertions across `api.e2e`, `file-uploader-*.e2e` green; full gate.

### M6 — Plugins + Sources — high risk
`PluginRegistryController` + `SourcesController` + the legacy bridge (`plugin-api-bridge.ts` `buildLegacyPluginCtx`). Documented `pluginApi.*` maps onto controller methods; 0ms-debounce registration batching preserved. Built-in plugins (camera, url, external-sources, cloud-image-editor, image-shrink) install through the controller. Lazy-plugin loading (`configDeps`/`isEnabled`/`load`) re-expressed.
**Exit:** all `tests/plugins/*.e2e` green; full gate.

### M7 — Router (the atomic swap) — **high risk**
v2's dual-slot `RouterController` (`activity` background + `modal` foreground, `RouteTable`, hook chains, `navigationStrategy`) **replaces** `LitActivityBlock` subscriptions + `ModalManager` + `RouterHooksLayer` + per-solution `sub('*currentActivity')` handlers. Cannot run both engines on one instance → single focused swap behind unchanged public methods. `<uc-modal>` reads `router.modal === id`. Documented `setCurrentActivity`/`setModalState`/`initFlow`/`doneFlow`/`historyBack` + `activity-change`/`modal-open`/`modal-close` events preserved.
**Exit:** `file-uploader-regular/minimal/inline.e2e`, `dynamic-btn-upload-list.e2e` green; full gate. **Lean hard on e2e here.**

### M8 — Clipboard + Telemetry
`ClipboardController` (window paste listener attached via `registerScope`, honoring `pasteScope`) + `Telemetry` (`qualityInsights`). Smallest remaining domains. After this, `PubSub` is a pure facade.
**Exit:** full gate.

### M9 — UI adapter base classes — high risk
Introduce `Uploader.ts` (ContextProvider + `bindConfigToElement` + `bindEventBusToElement`, owner element) and `ChildBlock.ts` (ContextConsumer / `UploaderRegistry` resolution). Port inner blocks **block-by-block** off `LitBlock`/`SymbioteCompatMixin` to `ChildBlock`, reading controllers directly instead of `this.$`. Remove each block's `$` usage as it migrates. Group ports (e.g. by activity) so each is independently gated.
**Exit (per group):** full gate. Final: no block reads via `$`.

### M10 — Single composable `<uc-uploader>` tag *(shipped, reshaped)*
**Planned:** additive `<uc-uploader>` base + `<uc-uploader-regular|minimal|inline>` presets (`styleAttrs`, `navigationSlotFor`, `renderLayout()`), with `<uc-file-uploader-*>` reduced to thin compat shims and a named-slot override model (`yield`/`content-for`).

**Shipped instead (#1056, #1057):** a single `<uc-uploader mode="regular|minimal|inline">` host (`src/solutions/file-uploader/Uploader.ts`) that mounts the existing solution for the requested mode. No preset tags, no slot-override model, and `<uc-file-uploader-*>` were **not** demoted to shims — they remain the real solutions. Sharing happens at two seams instead: pure template helpers in `src/solutions/file-uploader/layout-fragments.ts` and a `chrome="default|compact"` property on `<uc-upload-list>`. Design notes: `docs/superpowers/specs/2026-07-23-solution-layout-chrome-design.md`.

**Exit (met):** `<uc-uploader>` specs + existing-tag e2e green; full gate.

### M11 — Remove undocumented internals *(done, one exception)*
Removed: `SymbioteCompatMixin`, `PubSubCompat`, `SharedState`, `LitBlock`/`LitActivityBlock`, `CTX.ts`, `ModalManager`, the facade adapters, the nanostores dependency, the `$` proxy and `*`-prefixed keys, the `static template` setter, `LitUploaderBlock.extSrcList/sourceTypes`.

**Still present, by choice:** `CssDataMixin` + `--cfg-*` reads in `src/blocks/Img/` (`CssDataMixin.ts`, `ImgConfig.ts`) — `<uc-img>` keeps its CSS-var config path for now.

**Documented tags remain as compat shims** until a future major explicitly drops them (out of scope here).

---

## 8. Key reference files

**Deleted during the migration** (listed here only so old references resolve):
`src/lit/PubSubCompat.ts`, `src/lit/SymbioteCompatMixin.ts`,
`src/lit/SharedState.ts`, `src/lit/LitBlock.ts`, `src/lit/LitActivityBlock.ts`,
`src/abstract/managers/ModalManager.ts`, `src/abstract/CTX.ts`.

**Current (root `src/`):**
- `src/abstract/di/ControllerContainer.ts` — per-ctx DI container; the ownership/teardown unit.
- `src/abstract/UploaderRegistry.ts` — ctx-name → container registry + lifecycle.
- `src/abstract/host-subscription.ts` — `Listeners` primitive.
- `src/abstract/controllers/*` — the DOM-free controller tree (`Config`, `Router`, `Locale`, `Validation`, `UploadCollection`, `Upload*`, `SecureUploads`, `SourceList`, `LazyPlugins`, `Clipboard`, `CloudImageEditor`, `State`, …).
- `src/abstract/EventBus.ts` + `src/blocks/UploadCtxProvider/EventEmitter.ts` — internal bus and the documented DOM event contract.
- `src/abstract/UploaderPublicApi.ts` — documented JS API, `@inject` facade over controllers.
- `src/lit/ChildBlock.ts` (+ `ActivityChildBlock`, `SolutionChildBlock`, `WithApi`, `WithConfig`) — element/adapter layer.
- `src/blocks/Config/Config.ts` — `<uc-config>` element over `ConfigController`'s descriptor registry.
- `src/abstract/managers/plugin/*` — plugin system.
- `src/solutions/file-uploader/` — `Uploader.ts` (`mode` host), `layout-fragments.ts`, `{regular,minimal,inline}/*`.

---

## 9. Open risks & notes

**Resolved:** the per-entry PubSub facade mapping (M3), the router swap (M7),
and the `packages/` stray dir are all behind us. The cloud-image-editor
crop-frame e2e flake is contained by `retry: 1` on the e2e project (see
`AGENTS.md`), not fixed — a genuine regression still fails both attempts.

**Still open:**
- **Landing `feat/v2-migration` → `main`** (PR #1048) is now the dominant risk: ~50 commits and a large diff sitting unmerged.
- **`Img`'s `CssDataMixin`/`--cfg-*`** is the one deliberate M11 leftover (§0).
- **CDN URLs are now `@uploadcare/cdn-url`** behind `src/utils/cdn` (§0), which retired `cdn-utils.ts` and its `trimFilename` bug. The dependency is pinned to a `6.20.0-alpha.*` and must reach a stable version before any release.
- **Future major** (dropping documented tags / shims) remains **out of scope**; this plan stops at "internals fully v2 + single tag available + undocumented internals gone."
