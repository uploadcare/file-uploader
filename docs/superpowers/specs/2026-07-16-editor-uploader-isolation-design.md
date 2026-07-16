# CloudImageEditor ↔ Uploader Isolation — Design

**Date:** 2026-07-16
**Status:** approved design → implementation plan next
**Context:** Follow-up to M12 (PR #1031). The editor family is on the v2 controller/light-base architecture, but the root `<uc-cloud-image-editor>` still calls `ensureUploaderCtx`, which force-creates the **entire** `UploaderController` graph (upload/collection state, router, plugin manager, clipboard, event emitter, telemetry, a11y, locale). This refactor severs that dependency.

## Goal & principle

`<uc-cloud-image-editor>` becomes **fully standalone**: it owns its own config, locale, and icons, and depends on **none** of the uploader controller graph. Backward compatibility with the documented "reads config/locale from a sibling `<uc-config>`" behavior is preserved by a **single, clearly-marked, deletable compat module** — the only code in the editor that touches the uploader `PubSub` ctx.

**Config precedence, everywhere:** editor's own prop → `<uc-config>` sibling (compat bridge) → built-in default.

## Non-goals (explicitly out of scope)

- **Global icon-system refactor** (lifting plugin/`iconHrefResolver` override resolution up to the uploader / collapsing to one dumb icon everywhere). Tracked as a separate follow-up. `uc-icon`'s uploader-side behavior is unchanged here.
- Mirroring all ~55 `<uc-config>` options as editor props — only the editor-relevant subset (below).
- Any change to the uploader side (`ChildBlock`, `ensureUploaderCtx`, `<uc-config>`) beyond the icon `renderIconSvg` extraction.

## Current coupling (what we're removing)

- `CloudImageEditorBlock` calls `ensureUploaderCtx(ctxName)` → forces `UploaderController` + seeds uploader/solution state + registers 6 controller-owned instances.
- `EditorServices` are wired from that ctx: `l10n` via `createL10n(ctx)`, `getConfig` via `ctx.read(sharedConfigKey(k))`, `telemetry` via `ctx.read('*telemetryManager')`, `proxyUrl` via config-derived resolver.
- `uc-icon` (a `ChildBlock`) is used throughout the editor toolbar/tabs and adopts the uploader ctx for plugin/`iconHrefResolver` overrides.
- Cross-component coordination via controller state refs `*cropperEl` / `*faderEl` / `*imgContainerEl`, with the toolbar/root reaching into sibling elements to call `.activate()` / `.deactivate()`.

## Editor config surface (the only config the editor needs)

`cdnCname`, `secureDeliveryProxy`, `secureDeliveryProxyUrlResolver`, `cloudImageEditorMaskHref`, `testMode`, plus locale. Exposed as element props:

| Prop / attribute | Type | Attribute |
|---|---|---|
| `cdn-cname` | `string` | yes |
| `secure-delivery-proxy` | `string` | yes |
| `secureDeliveryProxyUrlResolver` | function | JS prop only |
| `cloud-image-editor-mask-href` | `string` | yes |
| `test-mode` | `boolean` | yes |
| `locale-name` | `string` | yes |
| `localeDefinition` | object | JS prop only |

Existing props (`uuid`, `cdn-url`, `crop-preset`, `tabs`, `ctx-name`) are unchanged. `ctx-name` remains only as the key the **compat bridge** uses to find a sibling `<uc-config>`; it is not required for standalone use.

## Architecture

### 1. Editor-owned config
`CloudImageEditorController` (or a small dedicated config holder it owns) holds the config values above. `EditorServices.getConfig` reads from here. `ensureUploaderCtx` is **removed** from the editor. The controller resolves each value by precedence: own-prop → bridge → default.

### 2. Compat bridge (removable)
A single module (`editor-config-compat.ts`) is the **only** editor code that references the uploader `PubSub`/`sharedConfigKey`. Given the editor's `ctx-name`, it:
- looks up an **existing** ctx via `PubSub.getCtx(ctxName)` — **read-only; never force-creates a controller** (so no uploader graph is instantiated by the editor);
- reads config + locale keys and feeds them into the editor's config source, but **only for keys the element's own props did not set**;
- subscribes for live updates (config/locale change) and pushes them through.
It carries a header comment marking it compat-only with explicit deletion steps (delete the module + its single call site; standalone props remain the sole source).

### 3. Locale (fully standalone)
The editor's ~dozen locale keys (`a11y-cloud-editor-*`, `crop-to-shape`, filter/tuning names, `cancel`, etc.) are vendored as a default **English** dictionary in the editor bundle. An `EditorL10n` resolves: `localeDefinition` prop → compat bridge (uc-config locale) → bundled default. The editor renders correct labels with no `<uc-config>` present.

### 4. Icons
- `renderIconSvg(href)` — shared template helper: `<svg><use href=...></svg>`. Single source of truth for drawing.
- `UcIconBase` (plain-Lit, light DOM): `name` property, aria, renders `renderIconSvg('#uc-icon-' + name)`. No ctx.
- `uc-editor-icon extends UcIconBase` — used everywhere in the editor tree.
- `uc-icon` stays a `ChildBlock`; its `render()` is refactored to call `renderIconSvg(...)` after its existing plugin/`iconHrefResolver` resolution. **Uploader behavior unchanged.**

### 5. Coordination → reactive self-activation
Retire `*cropperEl` / `*faderEl` / `*imgContainerEl` from controller state entirely. The cropper and fader **observe controller state** (`tabId`, `imageSize`, `originalUrl`, `networkProblems`, `editorTransformations`) and **self-activate / self-deactivate**:
- Cropper activates when `tabId === 'crop'` and `imageSize` + `originalUrl` are present; deactivates otherwise.
- Fader activates when `tabId !== 'crop'` and image data is present; deactivates otherwise; applies `editorTransformations` reactively.
- Preload width (was read off `*imgContainerEl`) is measured from the element's own DOM in the Lit layer (the toolbar/root reads its own ref, not a shared one).
The toolbar/root only mutate controller state (`tabId`, etc.); no element reaches into a sibling. The controller stays DOM-free (no element refs, no `.activate()` calls).

### 6. Lifecycle
- **#3 ctx release — dissolves.** The editor creates no uploader ctx; the compat bridge only *reads* an existing one (owned by `<uc-config>`), so there is nothing for the editor to release.
- **#221 reconnect.** Reset the init gates (`_editorInitialized`/`_isInitialized`) on disconnect and re-run controller/bridge/locale wiring on reconnect (or make setup idempotent and reinstall from `connectedCallback`). Same-node reconnect fully re-establishes state mirroring + viewer activation.
- **#612 `ctx-name` change.** Re-run init when `ctxName` changes before initialization completes; the compat bridge re-targets the new sibling ctx.

## Documented-behavior preservation

- Standalone `<uc-cloud-image-editor uuid=… ctx-name=X>` beside `<uc-config ctx-name=X cdn-cname=…>` behaves exactly as today — the bridge supplies `cdnCname`/config/locale.
- Public `apply` / `cancel` / `change` events unchanged.
- Editor bundle must stay ≤ 50 KB (currently 45.3 KB). Removing the uploader-graph value-import should keep or improve this; the vendored locale subset + `uc-editor-icon` are small.
- `iconHrefResolver` / plugin custom icons continue to work for `uc-icon` (uploader). Editor icons legitimately do not participate (they never did meaningfully; they draw the built-in editor sprite set).

## Testing

- **Editor-alone e2e** (no `<uc-config>`): renders with `cdn-cname` prop + bundled English locale + icons visible + cropper activates + a filter/tuning op applies.
- **Editor + `<uc-config>` compat e2e**: bridge supplies `cdnCname`/config/locale; existing behavior preserved (the current suite covers this).
- **Reactive activation e2e**: switching tabs activates/deactivates cropper vs fader via state only (no ref reach-in).
- **Reconnect e2e**: disconnect + reconnect the same editor node → state/activation resume.
- **Icon e2e**: `uc-editor-icon` renders sprite; `uc-icon` (uploader) still resolves plugin/`iconHrefResolver` overrides (existing coverage).
- Controller unit specs: config precedence, locale resolution, bridge feeding only unset keys.

## Risks

- **Reactive self-activation** rewrites the activation path — the exact area with prior M12 regressions. Mitigate with the activation + reconnect e2e above and incremental, per-element porting (cropper, then fader).
- **Locale vendoring** must stay in sync with the canonical editor keys; a locale test should assert the bundled subset covers every key the editor renders.
- **Bridge read-only semantics**: must confirm `PubSub.getCtx` never instantiates a controller (unlike `ensureUploaderCtx`).
