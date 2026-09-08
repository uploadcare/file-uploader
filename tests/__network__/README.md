# Network snapshots

Every request the e2e suite makes to a third party is recorded here, one HAR per test file. Runs replay them by
default, so `npm run test:e2e` needs neither API access nor a working network, and no longer depends on how quickly
the upload API happens to answer.

- `npm run test:e2e` — replay. A request nothing recorded aborts, so a test that starts hitting a new endpoint fails
  instead of quietly reaching for the real API. `E2E_NET_DEBUG=1` logs each one.
- `npm run test:e2e:record` — re-record every snapshot against the real API, then normalise it. Expect a large diff:
  each recording gets fresh upload UUIDs. Do this when a test starts calling something new, or when the API moved.
- `E2E_NET=live npm run test:e2e` — no snapshot at all. This is what release branches (`releases/v*`) and any PR
  labelled `e2e-live` run in CI, because a snapshot cannot tell you the API changed under you.

Recording one file at a time works too: `E2E_NET=record npx vitest run --project e2e tests/validation.e2e.test.tsx`
followed by `npx tsx ./scripts/normalize-har.ts`. The normalisation step is not optional — the header of that script
says what it strips and why.

The `.dat`/`.json`/image files are response bodies, content-addressed and shared between snapshots. Telemetry is not
recorded; it is answered with a canned 200. Both are explained in `tests/utils/network-snapshot.ts`, along with why
replay is hand-rolled instead of using Playwright's `routeFromHAR`.
