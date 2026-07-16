# Editor↔Uploader Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `<uc-cloud-image-editor>` fully standalone — its own config props, bundled locale, and own icon — with zero dependency on the uploader controller graph, keeping the documented sibling-`<uc-config>` behavior via a single removable compat bridge.

**Architecture:** The editor controller owns config (precedence: own prop → compat bridge → default). One `editor-config-compat.ts` module is the only code touching the uploader `PubSub` ctx (read-only via `PubSub.getCtx`, which never instantiates a controller). Cropper/fader observe controller state and self-activate (no `*cropperEl`/`*faderEl`/`*imgContainerEl` refs). A shared `renderIconSvg` helper backs `UcIconBase`→`uc-editor-icon` (editor) and the existing `uc-icon` (uploader, unchanged behavior).

**Tech Stack:** TypeScript, Lit (light DOM), `@lit/context`, nanostores `PubSub` shim, Vitest (specs + Chromium e2e).

**Spec:** `docs/superpowers/specs/2026-07-16-editor-uploader-isolation-design.md`
**Branch:** `feat/v2-editor-uploader-isolation` (off `feat/v2-migration`).

## Global Constraints

- Controllers in `src/abstract/controllers/*` stay DOM-free — no `lit` import, no element refs, no `.activate()` calls into elements.
- Editor blocks must NOT extend `ChildBlock` nor value-import `ensureUploaderCtx`/`UploaderController`/`UploaderRegistry`. After this plan the editor imports **none** of them.
- Editor bundle `web/uc-cloud-image-editor.min.js` must stay ≤ 50 KB (currently 45.3 KB).
- Documented public behavior preserved: standalone `<uc-cloud-image-editor uuid=… ctx-name=X>` + `<uc-config ctx-name=X cdn-cname=…>` behaves as today; public `apply`/`cancel`/`change` events unchanged.
- Every ported block keeps its type-only `declare attributesMeta` member (JSX typing; only `tsc:e2e` catches loss).
- Config precedence, every value: editor's own prop → `<uc-config>` compat bridge → built-in default.
- Green gate per task before commit: `npm run tsc:app`; for e2e-touching tasks also `npm run build` then the relevant `npx vitest run --project e2e <files>`. Full gate (`tsc`, `build`, `test:specs`, `test:locales`, `test:e2e`, `lint`) before the final PR.
- `uc-icon` (uploader) behavior must not change; only its `render()` internals are refactored to call the shared helper.

---

## File structure

- `src/blocks/Icon/renderIconSvg.ts` *(new)* — shared `renderIconSvg(href)` template helper.
- `src/blocks/Icon/UcIconBase.ts` *(new)* — plain-Lit base: `name` prop → `renderIconSvg('#uc-icon-' + name)`.
- `src/blocks/CloudImageEditor/src/EditorIcon.ts` *(new)* — `uc-editor-icon` extends `UcIconBase`.
- `src/blocks/Icon/Icon.ts` *(modify)* — `render()` calls `renderIconSvg`.
- `src/blocks/CloudImageEditor/src/editor-locale.ts` *(new)* — vendored English dictionary (editor key subset) + `resolveEditorL10n`.
- `src/blocks/CloudImageEditor/src/editor-config-compat.ts` *(new, removable)* — the only uploader-ctx reader.
- `src/abstract/controllers/CloudImageEditorController.ts` *(modify)* — owns config + locale; drops `*cropperEl`/`*faderEl`/`*imgContainerEl`.
- `src/blocks/CloudImageEditor/src/CloudImageEditorBlock.ts` *(modify)* — config props, drop `ensureUploaderCtx`, wire bridge+locale, lifecycle fixes, drop coordination refs.
- `src/blocks/CloudImageEditor/src/EditorImageCropper.ts` / `EditorImageFader.ts` *(modify)* — reactive self-activation.
- `src/blocks/CloudImageEditor/src/EditorToolbar.ts` *(modify)* — stop reaching `*cropperEl`/`*faderEl`; preload width from own ref.
- Tests colocated + `tests/cloud-image-editor.e2e.test.tsx`, `tests/cloud-image-editor-standalone.e2e.test.tsx` *(new)*.

---

### Task 1: Shared icon helper + `UcIconBase` + `uc-editor-icon`; refactor `uc-icon` to reuse

**Files:**
- Create: `src/blocks/Icon/renderIconSvg.ts`, `src/blocks/Icon/UcIconBase.ts`, `src/blocks/CloudImageEditor/src/EditorIcon.ts`
- Modify: `src/blocks/Icon/Icon.ts` (`render()` only)
- Test: `src/blocks/CloudImageEditor/src/EditorIcon.test.ts`

**Interfaces:**
- Produces: `renderIconSvg(href: string): TemplateResult`; `class UcIconBase extends LightDomMixin(LitElement)` with `@property() name: string`; custom element `uc-editor-icon` (`EditorIcon extends UcIconBase`).
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test** — `EditorIcon.test.ts`: define + register `uc-editor-icon`, set `name="rotate"`, assert it renders `svg use[href="#uc-icon-rotate"]` and needs no ctx (append to bare `document.body`, no `<uc-config>`).

```ts
import { expect, it, beforeAll } from 'vitest';
it('renders the sprite use for its name with no ctx', async () => {
  await import('@/blocks/CloudImageEditor/src/EditorIcon');
  const el = document.createElement('uc-editor-icon');
  el.setAttribute('name', 'rotate');
  document.body.append(el);
  await (el as any).updateComplete;
  const use = el.querySelector('svg use');
  expect(use?.getAttribute('href')).toBe('#uc-icon-rotate');
  el.remove();
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run --project specs src/blocks/CloudImageEditor/src/EditorIcon.test.ts` → FAIL (element undefined).

- [ ] **Step 3: Implement** — `renderIconSvg.ts`:

```ts
import { html, type TemplateResult } from 'lit';
export function renderIconSvg(href: string): TemplateResult {
  return html`<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><use href=${href}></use></svg>`;
}
```

`UcIconBase.ts` — plain-Lit light-DOM base (mirror `Icon`'s `aria-hidden` on connect):

```ts
import { LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { LightDomMixin } from '../../lit/LightDomMixin';
import { renderIconSvg } from './renderIconSvg';
export class UcIconBase extends LightDomMixin(LitElement) {
  @property({ type: String }) public name = '';
  public override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('aria-hidden', 'true');
  }
  public override render() {
    return this.name ? renderIconSvg(`#uc-icon-${this.name}`) : null;
  }
}
```

`EditorIcon.ts`:

```ts
import { UcIconBase } from '../../Icon/UcIconBase';
export class EditorIcon extends UcIconBase {}
if (!customElements.get('uc-editor-icon')) customElements.define('uc-editor-icon', EditorIcon);
declare global {
  interface HTMLElementTagNameMap { 'uc-editor-icon': EditorIcon; }
}
```

Then in `Icon.ts` `render()`, replace the inline `<svg>…<use>…` branch with `renderIconSvg(this._resolvedHref)` wrapped in the existing `this.yield('', …)` (keep the `_pluginSvg` branch untouched).

- [ ] **Step 4: Run to verify it passes.**

- [ ] **Step 5: Swap the editor tree** — replace every `<uc-icon name=…>` in `src/blocks/CloudImageEditor/src/**` templates with `<uc-editor-icon name=…>`; add `import './EditorIcon'` where needed. Grep to confirm zero `uc-icon` left under `CloudImageEditor/src`.

- [ ] **Step 6: Build + editor e2e + icon regression** — `npm run build` then `npx vitest run --project e2e tests/cloud-image-editor.e2e.test.tsx`. The existing "renders editor icons" guard now targets `uc-editor-icon` (update its selector if it queried `uc-icon`). Expected PASS.

- [ ] **Step 7: Commit** — `refactor(editor-isolation): extract renderIconSvg + UcIconBase; editor uses uc-editor-icon`.

---

### Task 2: Editor-owned config state + element props (bridge NOT yet wired)

**Files:**
- Modify: `src/abstract/controllers/CloudImageEditorController.ts` (add config holder + defaults), `src/blocks/CloudImageEditor/src/CloudImageEditorBlock.ts` (props + `getConfig` reads own config)
- Test: `src/abstract/controllers/CloudImageEditorController.test.ts`

**Interfaces:**
- Produces: `EditorConfig` type `{ cdnCname: string; secureDeliveryProxy?: string; secureDeliveryProxyUrlResolver?: SecureDeliveryProxyUrlResolver; cloudImageEditorMaskHref?: string; testMode: boolean }`; `controller.setConfig(patch: Partial<EditorConfig>)`, `controller.getConfigValue<K>(k): EditorConfig[K]`. Defaults: `cdnCname: 'https://ucarecdn.com'`, `testMode: false`, others `undefined`.
- Consumes: nothing.

- [ ] **Step 1: Failing test** — controller seeds config defaults; `setConfig` patches; `getConfigValue('cdnCname')` returns default then patched value.

```ts
it('owns editor config with defaults and setConfig patch', () => {
  const c = new CloudImageEditorController();
  expect(c.getConfigValue('cdnCname')).toBe('https://ucarecdn.com');
  expect(c.getConfigValue('testMode')).toBe(false);
  c.setConfig({ cdnCname: 'https://cdn.example.com/', testMode: true });
  expect(c.getConfigValue('cdnCname')).toBe('https://cdn.example.com/');
  expect(c.getConfigValue('testMode')).toBe(true);
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — add a private `_config: EditorConfig` (defaults) + `setConfig`/`getConfigValue` to the controller. Update `EditorServices.getConfig` default impl and the doc.
- [ ] **Step 4: Add element props** in `CloudImageEditorBlock`: `@property({ attribute: 'cdn-cname' }) cdnCname`, `@property({ attribute: 'secure-delivery-proxy' }) secureDeliveryProxy`, `@property({ attribute: false }) secureDeliveryProxyUrlResolver`, `@property({ attribute: 'cloud-image-editor-mask-href' }) maskHref`, `@property({ type: Boolean, attribute: 'test-mode' }) testMode`. In `willUpdate`, on any of these changing, call `this._editorController.setConfig({...})` with the **defined** ones (own-prop layer). Point `_setupEditorController`'s `getConfig` service at `this._editorController.getConfigValue(...)` (keep the ctx read as a temporary fallback until Task 3).
- [ ] **Step 5: Run controller specs + tsc:app → PASS.**
- [ ] **Step 6: Commit** — `feat(editor-isolation): editor controller owns config + element props`.

---

### Task 3: Removable compat bridge + drop `ensureUploaderCtx`

**Files:**
- Create: `src/blocks/CloudImageEditor/src/editor-config-compat.ts`
- Modify: `src/blocks/CloudImageEditor/src/CloudImageEditorBlock.ts` (remove `ensureUploaderCtx` import + call; wire bridge; precedence)
- Test: `src/blocks/CloudImageEditor/src/editor-config-compat.test.ts`

**Interfaces:**
- Produces: `subscribeUploaderConfigCompat(ctxName: string, onConfig: (patch: Partial<EditorConfig>) => void, onLocale: (dict) => void): () => void` — resolves an existing ctx via `PubSub.getCtx(ctxName)` (returns a no-op unsubscribe + calls nothing when `null`); reads `*cfg/*` keys + locale and calls the callbacks; subscribes for changes; returns unsubscribe.
- Consumes: `EditorConfig` (Task 2), `resolveEditorL10n` interplay (Task 4 — for now `onLocale` may be a stub the root ignores until Task 4).

- [ ] **Step 1: Failing test** — with no ctx registered, `subscribeUploaderConfigCompat('missing', …)` calls neither callback and returns a callable no-op. With a ctx pre-seeded (`PubSub.registerCtx({ '*cfg/cdnCname': 'https://x/' } as any, 'k')`), it calls `onConfig` with `{ cdnCname: 'https://x/' }`.

```ts
it('is inert when no sibling ctx exists', () => {
  const cfg = vi.fn(); const off = subscribeUploaderConfigCompat('missing-'+Math.random(), cfg, vi.fn());
  expect(cfg).not.toHaveBeenCalled(); expect(() => off()).not.toThrow();
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** the bridge using `PubSub.getCtx` + `sharedConfigKey` (read-only; header comment: "COMPAT ONLY — the sole uploader-ctx dependency; delete this file + its call site in CloudImageEditorBlch to fully decouple"). Map only editor keys.
- [ ] **Step 4: Rewire the root** — remove `ensureUploaderCtx` import + `_ctx`/`uploaderCtx` usage for config/telemetry; `getConfig` reads `this._editorController.getConfigValue`; in `_maybeInitializeCtx` (rename to `_setupEditor`) call `subscribeUploaderConfigCompat(effectiveCtxName, patch => this._editorController.setConfig(onlyUnsetByOwnProps(patch)), …)`; store the unsubscribe for teardown. Telemetry: use the injected `TelemetryManager` only if resolvable via the bridge ctx, else a no-op sink (editor telemetry is best-effort). Also delete the now-dead `a11y` getter + its `A11y` import (defined on the root but never called in the editor tree). Confirm `grep -rE "ensureUploaderCtx|UploaderController|UploaderRegistry" src/blocks/CloudImageEditor/src` returns zero.
- [ ] **Step 5: Build + editor + plugins e2e + bundle size** — `npm run build`; `npx vitest run --project e2e tests/cloud-image-editor.e2e.test.tsx tests/plugins/cloud-image-editor.e2e.test.tsx`; `npx size-limit`. Expected: editor+config compat path still green (bridge supplies `cdnCname`), bundle ≤ 50 KB.
- [ ] **Step 6: Commit** — `feat(editor-isolation): removable uc-config compat bridge; drop ensureUploaderCtx`.

---

### Task 4: Vendored locale (fully standalone text)

**Files:**
- Create: `src/blocks/CloudImageEditor/src/editor-locale.ts`
- Modify: `CloudImageEditorController.ts` (l10n reads resolved dict), `CloudImageEditorBlock.ts` (`locale-name`/`localeDefinition` props + bridge locale), `editor-config-compat.ts` (`onLocale`)
- Test: `src/blocks/CloudImageEditor/src/editor-locale.test.ts`, `tests/locales` coverage assertion

**Interfaces:**
- Produces: `EDITOR_DEFAULT_LOCALE: Record<string, string>` (every editor key, English); `resolveEditorL10n(overrides?: Record<string,string>): (key, vars?) => string`.
- Consumes: bridge `onLocale` (Task 3).

- [ ] **Step 1: Failing test** — `resolveEditorL10n()('cancel')` → `'Cancel'`; unknown key falls back to the key; override wins.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — enumerate every key the editor renders (grep `l10nSafe`/`l10n` in `CloudImageEditor/src` + the operation/filter name keys) and vendor English strings copied from the canonical `src/locales/*` file. `resolveEditorL10n` layers: overrides → default.
- [ ] **Step 4: Wire** — controller `l10n` uses the resolved function; root sets overrides from `localeDefinition` prop and from the bridge `onLocale`; precedence prop → bridge → default.
- [ ] **Step 5: Coverage test** — a spec that asserts `EDITOR_DEFAULT_LOCALE` has a key for every `l10nSafe(...)` literal used in the editor (fail if a key is missing).
- [ ] **Step 6: Build + standalone e2e stub** — render `<uc-cloud-image-editor uuid=… cdn-cname=…>` with NO `<uc-config>`; assert a known label (e.g. apply button aria) reads English, icons render. Commit — `feat(editor-isolation): vendored editor locale for standalone text`.

---

### Task 5: Reactive self-activation — cropper

**Files:**
- Modify: `EditorImageCropper.ts` (observe state, self-activate/deactivate), `EditorToolbar.ts` + `CloudImageEditorBlock.ts` (stop calling cropper `.activate()`/`.deactivate()`; stop setting/reading `*cropperEl`)
- Test: `tests/cloud-image-editor.e2e.test.tsx` (existing cropper-activation guard must still pass)

**Interfaces:**
- Consumes: controller state `tabId`, `imageSize`, `originalUrl`, `networkProblems`.
- Produces: cropper no longer needs an external activator; `*cropperEl` removed from `CloudImageEditorControllerState`.

- [ ] **Step 1** In `EditorImageCropper`, add a `subscribeEditor` reaction computing `shouldBeActive = tabId==='crop' && !!imageSize && !!originalUrl && !networkProblems`; when it transitions to true call the existing internal `this.activate(imageSize, …)`, to false call `this.deactivate(…)`. Guard re-entrancy with the existing `_isActive`.
- [ ] **Step 2** Remove `editorController.set('*cropperEl', …)` (root `_assignSharedElements`) and every `get('*cropperEl')?.activate/deactivate` call in `EditorToolbar._applyTabState` and root `_activateViewer`/`updateImage` — the cropper now reacts on its own.
- [ ] **Step 3** Remove `'*cropperEl'` from `CloudImageEditorControllerState` + defaults; `tsc:app` guides the remaining references.
- [ ] **Step 4: Build + editor e2e** — the "activates the cropper on the crop tab" guard + "select crop preset" + tab switching must pass with no external activation. Expected PASS, no `change-in-update` warnings, no unhandled errors.
- [ ] **Step 5: Commit** — `refactor(editor-isolation): cropper self-activates from controller state (retire *cropperEl)`.

---

### Task 6: Reactive self-activation — fader

**Files:**
- Modify: `EditorImageFader.ts` (self-activate on non-crop tabs; apply transformations reactively), `EditorToolbar.ts` + `CloudImageEditorBlock.ts` (drop `*faderEl` set/get + `.activate/.deactivate/.setTransformations` calls)
- Test: `tests/cloud-image-editor.e2e.test.tsx` ("apply brightness" / tuning + filters tabs)

**Interfaces:**
- Consumes: `tabId`, `imageSize`, `originalUrl`, `editorTransformations`, `networkProblems`.
- Produces: `*faderEl` removed from state.

- [ ] **Step 1** Fader `subscribeEditor`: `shouldBeActive = tabId!=='crop' && !!originalUrl && !!imageSize`; activate/deactivate accordingly; on `editorTransformations` change while active, call its existing `setTransformations`.
- [ ] **Step 2** Remove all `get('*faderEl')?.…` calls (toolbar `_applyTabState`, `subEditorKey('*editorTransformations')` fader line, `subEditorKey('*originalUrl')` fader deactivate, root `updateImage`/`_activateViewer`) and the root `set('*faderEl', …)`.
- [ ] **Step 3** Remove `'*faderEl'` from state + defaults.
- [ ] **Step 4: Build + editor e2e** — "apply brightness" + tuning/filters tab switches pass. Expected PASS.
- [ ] **Step 5: Commit** — `refactor(editor-isolation): fader self-activates from controller state (retire *faderEl)`.

---

### Task 7: Retire `*imgContainerEl`; simplify root viewer plumbing

**Files:**
- Modify: `EditorToolbar.ts` (`_preloadEditedImage` reads its own container width, not `*imgContainerEl`), `CloudImageEditorBlock.ts` (drop `_assignSharedElements`/`_activateViewer` now that elements self-activate; keep `updateImage` producing state), `CloudImageEditorController.ts` (drop `'*imgContainerEl'`)
- Test: existing editor e2e + a preload smoke (no throw)

**Interfaces:**
- Produces: `CloudImageEditorControllerState` no longer has `*cropperEl`/`*faderEl`/`*imgContainerEl` (all three gone).

- [ ] **Step 1** In the toolbar, resolve the container width from the toolbar's own DOM (nearest `.uc-image_container` via `this.closest`/a queried ref) instead of `get('*imgContainerEl')`. If unavailable, skip preload (guard).
- [ ] **Step 2** Delete `_assignSharedElements`, `_activateViewer`, and the `*cropperEl`/`*faderEl`/`*imgContainerEl` writes from the root; `updateImage` now only sets `originalUrl`/`editorTransformations`/`imageSize` and the elements react. Keep the `_scheduleInitialization` → `_isInitialized` gate.
- [ ] **Step 3** Remove `'*imgContainerEl'` from state + defaults. `tsc:app` clean.
- [ ] **Step 4: Build + full editor + plugins e2e** — all editor guards pass, image + crop frame render, brightness applies. Expected PASS.
- [ ] **Step 5: Commit** — `refactor(editor-isolation): retire *imgContainerEl + external activation plumbing`.

---

### Task 8: Lifecycle — reconnect (#221) + ctx-name change (#612) + standalone e2e

**Files:**
- Modify: `CloudImageEditorBlock.ts` (reconnect wiring + `ctxName`-change re-init)
- Test: `tests/cloud-image-editor-standalone.e2e.test.tsx` *(new)*

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1** Make setup idempotent + reinstall on reconnect: on `disconnectedCallback` tear down the compat-bridge unsubscribe + config/locale subs AND clear an `_wired` flag (do NOT permanently latch `_editorInitialized`); on `connectedCallback` re-run `_setupEditor`. The controller is created once in the field initializer and reused (do not `destroy()` it on disconnect unless the node is truly gone — reuse on reconnect).
- [ ] **Step 2** In `willUpdate`, if `changedProperties.has('ctxName')` and not yet wired to that name, re-target the compat bridge (unsubscribe old, subscribe new).
- [ ] **Step 3: New standalone e2e** — (a) editor with `cdn-cname` prop + NO `<uc-config>`: image + crop frame + English apply label + icons render, cropper activates; (b) same node removed + re-appended: still active and interactive; (c) editor + `<uc-config>` compat: `cdnCname` from config still applies (documented path).

```tsx
it('renders fully standalone with no <uc-config>', async () => {
  page.render(<uc-cloud-image-editor uuid="f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f" cdn-cname="https://ucarecdn.com/" test-mode></uc-cloud-image-editor>);
  await expect.element(page.getByTestId('uc-cloud-image-editor')).toBeVisible();
  await expect.poll(() => document.querySelector('uc-editor-image-cropper')?.className).toMatch(/uc-active_from_/);
  await expect.poll(() => [...document.querySelectorAll('uc-editor-icon')].some(i => i.querySelector('svg use'))).toBe(true);
});
```

- [ ] **Step 4: Full gate** — `npm run tsc && npm run build && npm run test:specs && npm run test:locales && npx vitest run --project e2e tests/cloud-image-editor.e2e.test.tsx tests/cloud-image-editor-standalone.e2e.test.tsx tests/plugins/cloud-image-editor.e2e.test.tsx tests/bundles.e2e.test.tsx && npm run lint && npx size-limit`. Expected all green, bundle ≤ 50 KB.
- [ ] **Step 5: Commit** — `feat(editor-isolation): standalone lifecycle (reconnect + ctx-name re-target) + e2e`.

---

## Notes for the executor

- After Task 3 the editor imports nothing from the uploader controller graph; the compat bridge is the single seam. Verify with the grep in Task 3 Step 4 and again at the end.
- Tasks 5–7 are the highest-risk (activation path — prior M12 regressions here). Port cropper (5) and fader (6) separately, run the editor e2e after each, and watch for `change-in-update` warnings and unhandled errors, not just pass/fail.
- The bundle-size check is a real gate — run `npx size-limit` after Tasks 3 and 8.
- Update the post-migration cleanup memory (`cloud-editor-post-migration-cleanup.md`): remove #3/#221/#612 (done here) and the coordination-ref item; keep the global icon-system unification as still-deferred.
