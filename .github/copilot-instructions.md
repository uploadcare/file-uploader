# GitHub Copilot instructions

Full project conventions are in [`AGENTS.md`](../AGENTS.md) at the repo root —
treat it as the source of truth. Key rules for code generation and PR review:

## Project
`@uploadcare/file-uploader` — a framework-agnostic Web Components file uploader
built on **Lit**, with state via a **nanostores**-backed shim
(`SymbioteCompatMixin`). Single package; canonical source is root `src/`. A
v2 **strangler migration** is in progress (see `MIGRATION-PLAN.md`): DOM-free
`UploaderController` + sub-controllers / `EventBus` / `Listeners` under the
existing public tags, one milestone per PR.

## Conventions
- TypeScript + Lit; custom-element tags prefixed `uc-`.
- TS experimental decorators (`useDefineForClassFields: false`) — not standard
  decorators.
- Formatting is **Biome**: single quotes, space indent, line width 120.
- Domain-based file names; light-DOM rendering (`LightDomMixin`).
- **Conventional Commits** (drives lerna releases): `feat:`, `fix:`, `chore:`,
  `docs:`, `refactor:`, optional scope.
- v2 controllers (`src/abstract/controllers/*`, `EventBus`, `host-subscription`)
  must **not** import `lit` or touch the DOM.

## Build & test (for reviewing CI-affecting changes)
- Run a full `npm run build` **before** `npm run test:specs` and
  `npm run test:e2e` — they consume built `dist/`+`web/` and self-resolve the
  package (needs `dist/index.ssr.js` from `build:ssr-stubs`).
- e2e needs `npx playwright install chromium`. The e2e project has `retry: 1`
  for a known cloud-image-editor flake — don't loosen assertions to "fix" flakes.
- Gate: `tsc:app` + `build` + `test:specs` + `test:locales` + `test:e2e` + `lint`.

## Review focus
- **Don't break the documented public API** (tags, `<uc-config>` options,
  `getAPI()` methods, events, `--uc-*` CSS vars, plugin API, `OutputFileEntry`/
  `OutputCollectionState` shapes — documented in the `fern-docs` repo).
  Undocumented internals (`$` proxy, `*`-keys, `--cfg-*`) may change freely.
- Flag swallowed errors and silent fallbacks. Fan-out paths should
  isolate-and-warn (cf. `EventBus.emit`, `Listeners.notify`), not hide failures.
- Keep PRs to one concern with the gate green.
