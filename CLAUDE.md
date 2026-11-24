# CLAUDE.md

Project conventions for this repository live in **[AGENTS.md](./AGENTS.md)** —
the single source of truth for build/test commands, the green gate, code
conventions, architecture, and the in-progress v2 migration.

@AGENTS.md

> Quick reminders (full detail in AGENTS.md):
> - Run a full `npm run build` **before** `test:specs` / `test:e2e`.
> - `npx playwright install chromium` is required once for e2e.
> - Don't break the documented public API (see `fern-docs`); undocumented
>   internals are fair game.
> - Conventional Commits; one concern per PR; full green gate before merge.
