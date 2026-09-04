# Public API parity

The documented public API of `@uploadcare/file-uploader` lives in a **separate
repo** — `fern-docs`, under `fern/pages/file-uploader/`. CI does not have it, so
the contract is transcribed into [`public-surface.json`](./public-surface.json)
and asserted here.

| file | checks |
|---|---|
| `options-parity.test.ts` | all 64 documented `<uc-config>` options exist, use their documented attribute name, and carry the documented default |
| `events-parity.test.ts` | documented event names match `EventType` exactly, and no internal event type leaks into it |
| `css-vars-parity.test.ts` | every documented `--uc-*` variable is still present in the built CSS (needs `npm run build`) |
| `../../tests/public-api-parity.e2e.test.tsx` | every documented `getAPI()` method exists on a real instance — an e2e, because those methods are arrow-function class fields and so never appear on the prototype |

## When one of these fails

It means the code and the docs disagree. Decide which is wrong:

- **The code broke a documented promise** → fix the code. The docs are the
  contract until a major version says otherwise (see `AGENTS.md`, "Do not break").
- **The docs changed** → regenerate the fixture:

  ```sh
  git -C ~/workspace/fern-docs checkout main   # released docs only
  node scripts/extract-public-surface.mjs ~/workspace/fern-docs
  ```

  **Regenerate from `main`, never a feature branch.** A docs branch for an
  unreleased version describes API that has not shipped — generating from one
  files the whole of it as drift. That already happened once: `navigate()` came
  from `docs/v1.34-minor-deprecations` and looked like a missing method.

  `knownMissing` and `knownMismatch` are preserved across regeneration; only the
  extracted sections are rewritten.

## `knownMissing` / `knownMismatch`

Two hand-maintained blocks in the fixture recording where docs and code already
disagree, each with a note explaining why it has not been fixed. They exist so
the drift is visible in one place rather than silently absent from the tests.

Removing an entry is how you close a gap: the parity test then demands the
documented behaviour. Adding one needs a reason in the `note` field.
