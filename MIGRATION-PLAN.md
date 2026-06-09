# v1 → v2 Strangler Migration Plan

> Incremental adoption of the v2 architecture into the shipping v1
> `@uploadcare/file-uploader`, one testable milestone at a time, without a
> single huge risky diff. The v2 spike (`worktree-v2-spike`) is the reference
> target; this plan re-derives it as a sequence of safe steps on top of `main`.

---

## 1. Goal & decisions

| Decision | Choice |
|----------|--------|
| **End-state** | **Full v2, incrementally.** Reach the complete v2 architecture (single composable `<uc-uploader>` tag, central router, no compat shim). Documented public API kept working via compat shims until a future **major** release, then dropped. |
| **Core mechanism** | **Strangler facade.** `UploaderController` becomes the real state engine; v1's `$` / `cfg` / `sub` / `pub` are reduced to a thin facade that delegates to controllers, flipped **one domain at a time**. Blocks stay unchanged until their domain migrates. |
| **Single `<uc-uploader>` tag** | **Deferred** to a late milestone (M10). Early milestones decouple internals under the existing tags. |
| **Green gate** | **e2e green every milestone** (plus app typecheck, specs, build). The 24 e2e tests exercise the documented contract — they are the strangler's safety net. |
| **What we may break** | Anything **undocumented**: the `$` proxy, `*`-prefixed keys, internal managers, `--cfg-*` CSS vars, `static template` setter, nanostores. |
| **What we must NOT break** | The documented contract (§4) until the future major. |

**Repo facts (verified on `main`, commit `bea13694`):**
- Single package: root `package.json` = `@uploadcare/file-uploader`, **no** workspaces. Canonical source = root `src/` (376 tracked files), root `tests/`.
- The working-tree `packages/` directory is **untracked stray cruft** from a `feat/monorepo` checkout (0 tracked files, not gitignored). Safe to `rm -rf packages/`. This plan targets root `src/` only.
- Runtime is already **Lit + nanostores** — Symbiote is gone; `SymbioteCompatMixin` is just a nanostores-backed compat shim. So this is a state-engine + routing migration, **not** a framework rewrite.
- A `src/abstract/controllers/` directory already exists on `main` (minimal) — confirm its contents before M0 to avoid collisions.

---

## 2. The two engines

**v1 engine — `PubSub` (`src/lit/PubSubCompat.ts`)**
One nanostores `MapStore` per `ctx-name`, reached via the `$` proxy and `sub`/`pub`/`read`/`add` in `SymbioteCompatMixin`. Flat string keys: `*cfg/<key>`, `*currentActivity`, `*history`, `*uploadList`, `*l10n/<key>`, plus singleton-instance keys (`*blocksRegistry`, `*pluginManager`, `*eventEmitter`, `*validationManager`, …). `ctx-name` propagates through the DOM tree via `@lit/context`.

**v2 engine — `UploaderController` (`src/abstract/controllers/UploaderController.ts` on the spike)**
Structured sub-controllers (`config`, `router`, `locale`, `validation`, `collection`, `secureUploads`, `upload`, `plugins`, `sources`, `clipboard`, `telemetry`, `api`, `events`/`EventBus`). Each holds plain state + a 23-line `Listeners` set (`host-subscription.ts`). **Zero** `lit`/DOM imports. DOM is bridged by thin adapters (`Uploader.ts`, `ChildBlock.ts`, `ui-adapters.ts`).

---

## 3. The facade mechanism (built once, in M0)

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
2. `npm run test:specs` (239 unit specs)
3. `npm run test:locales`
4. `npm run build:svg-sprites && npm run build:lib` — **prerequisite for e2e** (the `bundles.e2e` test reads `web/` artifacts; a clean tree has none)
5. `npm run test:e2e` (24 files / 187 tests, browser)
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

| # | Milestone | Domain / keys facaded | Documented contract held | Risk |
|---|-----------|-----------------------|--------------------------|------|
| **M0** | Foundations & safety net | — (no behavior change) | all | low |
| **M1** | Config | `cfg`, `*cfg/*` | `<uc-config>` 55 attrs/props + attr⇄prop reactivity | med |
| **M2** | Locale | `*l10n/*`, `l10n()` | `defineLocale`, `localeName`, `localeDefinitionOverride` | low |
| **M3** | Collection + Validation | `*uploadList`, per-entry state | `addFileFrom*`, `removeAll*`, `getOutputItem`, `getOutputCollectionState`, validators | **high** |
| **M4** | Upload + Secure uploads | `*uploadQueue`, progress | `uploadAll`, secure-upload resolvers | med |
| **M5** | Events | `*eventEmitter` | 19 provider events, `EventType`, `api.on()` | med |
| **M6** | Plugins + Sources | `*pluginManager`, `*lazyPlugins` | plugin API + built-in plugin IDs | high |
| **M7** | Router (the swap) | `*currentActivity`, `*history`, `ModalManager` | `setCurrentActivity`, `setModalState`, `initFlow`, `doneFlow`, `historyBack`, activity/modal events | **high** |
| **M8** | Clipboard + Telemetry | remaining singletons | `pasteScope`, `qualityInsights` | low |
| **M9** | UI adapter base classes | — (port blocks off `$`) | every tag's rendered behavior | high |
| **M10** | Single `<uc-uploader>` tag + presets *(deferred)* | — (additive new tags) | v1 tags become shims | med |
| **M11** | Remove undocumented internals | delete facade + shim | documented tags survive as shims to future major | med |

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

### M10 — Single composable `<uc-uploader>` tag + presets *(deferred)*
Additive `<uc-uploader>` base + `<uc-uploader-regular|minimal|inline>` presets (`styleAttrs`, `navigationSlotFor`, `renderLayout()`). Existing `<uc-file-uploader-*>` reduced to thin compat shims. Initially undocumented; document in a later step. Named-slot override model (`yield`/`content-for`).
**Exit:** new-tag e2e added + green; existing-tag e2e still green; full gate.

### M11 — Remove undocumented internals
Delete `SymbioteCompatMixin`, `PubSubCompat`, the facade adapters, nanostores dependency, `CssDataMixin`, `--cfg-*`, `static template` setter, `LitUploaderBlock.extSrcList/sourceTypes`, `<uc-config>`/`<uc-upload-ctx-provider>` internals not needed by shims. **Documented tags remain as compat shims** until a future major explicitly drops them (out of scope here).
**Exit:** full gate; bundle-size reduction confirmed via `lint:size`.

---

## 8. Key reference files

**v1 (root `src/`):**
- `src/lit/PubSubCompat.ts` — state atom; where the facade router is added (M0).
- `src/lit/SymbioteCompatMixin.ts` — `$`/`sub`/`pub`, ctx-name propagation; retired in M9/M11.
- `src/lit/SharedState.ts` — full key inventory (the migration checklist).
- `src/lit/LitBlock.ts` — manager bootstrap, `cfg` proxy; decomposed across M1–M8.
- `src/lit/LitActivityBlock.ts` + `src/abstract/managers/ModalManager.ts` — routing, replaced in M7.
- `src/abstract/UploaderPublicApi.ts` — documented JS API; re-pointed at controllers.
- `src/abstract/CTX.ts` — `init$` factories (initial state shape).
- `src/blocks/Config/Config.ts` — config element; re-expressed in M1.
- `src/blocks/UploadCtxProvider/EventEmitter.ts` — event contract; M5.
- `src/abstract/managers/plugin/*` — plugin system; M6.
- `src/solutions/file-uploader/{regular,minimal,inline}/*` — solution composition; M7/M10.

**v2 reference (worktree `/tmp/v2-spike-explore/src/`, branch `worktree-v2-spike`):**
- `abstract/host-subscription.ts` — `Listeners` primitive.
- `abstract/controllers/UploaderController.ts` — controller tree + `install()`.
- `abstract/controllers/{Config,Router,Locale,Validation,UploadCollection,Upload,PluginRegistry,Sources,Clipboard}Controller.ts`.
- `abstract/EventBus.ts`, `abstract/UploaderApi.ts`, `abstract/UploaderRegistry.ts`.
- `abstract/ui-adapters.ts`, `abstract/Uploader.ts`, `abstract/ChildBlock.ts`.
- `abstract/plugin.ts`, `abstract/plugin-api-bridge.ts`.
- `solutions/file-uploader/regular/{UploaderRegular,FileUploaderRegular}.ts` — preset + compat-shim patterns.

---

## 9. Open risks & notes

- **Per-entry PubSub contexts (M3)** are the trickiest facade mapping — budget extra time.
- **Router swap (M7)** is the one non-incremental step within a milestone; it stands or falls on e2e coverage of the regular/minimal/inline flows.
- **e2e flake** (cloud-image-editor crop-frame) must be stabilized in M0 or it erodes trust in the gate.
- **`packages/` stray dir** — remove before starting to avoid path confusion.
- **Future major** (dropping documented tags / shims) is explicitly **out of scope** for this plan; this plan stops at "internals fully v2 + single tag available + undocumented internals gone."
