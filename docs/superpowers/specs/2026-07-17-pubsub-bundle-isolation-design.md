# PubSub bundle isolation — design spec ("B")

**Date:** 2026-07-17
**Status:** Draft for review (implementation deferred to a follow-up PR)
**Context:** Final step of the CloudImageEditor↔uploader isolation effort. Stages
1–3 (retiring `*cropperEl`/`*faderEl`/`*imgContainerEl` from the editor
controller state) are merged (#1033/#1034/#1035); the editor controller graph is
now fully DOM-ref-free. This spec covers the remaining **bundle-level** coupling.

---

## Problem

The standalone `<uc-cloud-image-editor>` bundle
(`web/uc-cloud-image-editor.min.js`, entry `solutions/cloud-image-editor/index.ts`)
still pulls in the **entire uploader controller graph** — `UploaderController`
and its managers (validation, upload, router, telemetry, clipboard, a11y,
plugins, secure-uploads, collection, …).

**Why:** the editor's one uploader touchpoint, the removable compat bridge
`editor-config-compat.ts`, imports `PubSub` (`src/lit/PubSubCompat.ts`) to read a
sibling `<uc-config>`'s ctx. `PubSubCompat` **statically imports**
`UploaderController` and instantiates it in `_uploader()`:

```ts
import { UploaderController } from '../abstract/controllers/UploaderController';
// …
private _uploader(): UploaderController {
  let controller = PubSub._controllers.get(this._ctxId);
  if (!controller) {
    controller = new UploaderController({ stateBridges: { /* 9 v1 bridges */ } });
    // …
  }
  return controller;
}
```

Because that import is static and unconditional, bundlers cannot tree-shake
`UploaderController` out of any bundle that imports `PubSub` — including the
editor-alone bundle, even though a **standalone** editor (no sibling
`<uc-config>`) never creates a ctx and never calls `_uploader()`.

**Payoff of fixing:** `web/uc-cloud-image-editor.min.js` is currently ~46 KB
brotlied (size-limit 50 KB). Removing the uploader controller graph gives real
headroom and makes the isolation genuine at the bundle level, not just the
source level.

---

## Goal

Make `UploaderController` **absent** from the editor-alone bundle while keeping
it present and correct in every uploader-coupled scenario (full uploader
solutions AND the documented sibling-`<uc-config>` + editor composition).

Non-goals: changing `UploaderController`'s behavior, the `stateBridges`, or the
compat bridge's read semantics.

---

## Current coupling (facts)

- `new UploaderController(...)` exists in exactly one place: `PubSubCompat._uploader()`.
- `_config()` / `_locale()` call `_uploader()`, so **any** `*cfg/*` or `*l10n/*`
  read through PubSub lazily creates the controller. This is relied on by
  `Config`, ctx-lifecycle, and `ChildBlock` (per the migration notes).
- `Config extends ChildBlock`; the editor root is a light `EditorBlock`
  (NOT `ChildBlock`). `Config/initialConfig.ts` is data-only (no controller
  import) — safe for the editor to import.
- Every uploader-coupled scenario mounts a `<uc-config>` (a `ChildBlock`), so a
  side-effect registration reachable from the `ChildBlock`/uploader-scope path
  runs in all of them.

---

## Approach — dependency-injected controller factory (recommended)

Invert the static import into a runtime-registered factory.

**1. `PubSubCompat` (consumer side) — no static `UploaderController` import.**

```ts
// module-level
type UploaderControllerFactory = (deps: UploaderControllerDeps) => UploaderControllerLike;
let _controllerFactory: UploaderControllerFactory | null = null;

export function registerUploaderControllerFactory(factory: UploaderControllerFactory): void {
  _controllerFactory = factory;
}

// in _uploader():
if (!_controllerFactory) {
  throw new Error(
    'UploaderController factory not registered — a `<uc-config>`/uploader entry must be loaded before uploader ctx state is used.',
  );
}
controller = _controllerFactory({ stateBridges });
```

`PubSub` keeps building the `stateBridges` (they close over `this`); only the
`new UploaderController(...)` call moves behind the factory. Types: `PubSub`
references `UploaderController` only via `import type` (erased at build), so no
runtime edge remains.

**2. Registration (provider side) — a side-effect module.**

```ts
// src/lit/registerUploaderController.ts
import { UploaderController } from '../abstract/controllers/UploaderController';
import { registerUploaderControllerFactory } from './PubSubCompat';
registerUploaderControllerFactory((deps) => new UploaderController(deps));
```

Imported for side-effect from a module that loads in **every** uploader-coupled
scenario but **not** in the editor-alone bundle. Candidate: `ChildBlock.ts`
(base of `Config` and all uploader blocks; the editor doesn't extend it) — to be
**confirmed by bundle analysis** during implementation. Alternatives:
`ensureUploaderScope.ts` / `buildUploaderScopeDeps.ts` (the uploader-scope setup).

**3. Result.** The editor-alone bundle imports `PubSub` (via the compat bridge)
but never the registration module and never calls `_uploader()` (no ctx in
standalone mode) → `UploaderController` and its graph tree-shake out.

---

## Alternatives considered

- **Dynamic `import()` of `UploaderController` inside `_uploader()`.** Rejected:
  `_uploader()` is synchronous (config/locale reads are sync); an async import
  can't satisfy them.
- **Move the editor off `PubSub` entirely.** Rejected: the compat bridge's whole
  job is reading the sibling `<uc-config>`'s ctx, which *is* PubSub. It's
  compat-only and already the single deletable touchpoint.
- **Split `UploaderController` so `PubSub` imports only a thin core.** Rejected:
  larger surface, and the factory achieves the same isolation with a smaller,
  reversible change.

---

## Risks & mitigations

- **HIGH — a ctx used before the factory is registered throws.** `_config()`/
  `_locale()` create the controller on any config read app-wide. If the
  registration module isn't loaded where the full uploader expects it, the whole
  uploader breaks.
  - *Mitigation:* register from a module provably on every uploader path
    (bundle-analysis-verified), keep the thrown error explicit, and run the
    **full uploader gate** (not just editor e2e).
- **MEDIUM — sibling-`<uc-config>` + editor composition.** Here the editor's
  bridge reads config through the ctx `<uc-config>` created. `<uc-config>` is a
  `ChildBlock` → the registration is present. Covered by the plugin/standalone
  e2e that exercises this path.
- **LOW — registration ordering.** Registration is a top-level side-effect at
  module load; the first `_uploader()` call happens later (on connect/read), so
  ordering holds. Guard with the explicit throw anyway.

---

## Testing strategy

1. **Full uploader green gate** — `tsc`, build, specs, locales, **full e2e**
   (regular/minimal/inline solutions, plugins, editor-in-uploader), lint. This
   change touches app-wide controller creation, so editor-only e2e is
   insufficient.
2. **Bundle assertion** — confirm `web/uc-cloud-image-editor.min.js` shrinks and
   no longer contains `UploaderController`/its managers (inspect the bundle for
   telltale symbols; tighten the size-limit entry to lock the win in).
3. **Negative check** — a spec asserting `_uploader()` throws the explicit error
   when no factory is registered (documents the contract).

---

## Rollout

Own PR (`feat/v2-editor-uploader-isolation-B` or similar), off `feat/v2-migration`.
Independent of stages 1–3 (already merged). Reversible: re-adding the static
import + `new` restores the prior behavior.
