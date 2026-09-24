# Offline verification

```sh
npm ci
npm run build
npm run typecheck
npm test
```

The default suite is offline and requires no Azure credentials. Its runner
replaces global `fetch` with a throwing guard; provider tests inject explicit
local fixtures. This guard is not a general network sandbox. Real child-process
stdio tests use either invalid/unconfigured Azure settings or a fake provider,
never a live deployment. Azure ownership tests use a mocked CLI.

Targeted tests can run after a build:

```sh
node --import ./test/fixtures/offline-fetch.mjs --test \
  test/generation.test.mjs test/editing.test.mjs test/provider.test.mjs
```

Coverage is behavior-based, not an unmeasured percentage:

| Contract | Evidence |
| --- | --- |
| Auth selection, config rejection, no key/token serialization | `config.test.mjs` |
| Configured vs deployed/observed evidence; nonbillable diagnostics | `capabilities.test.mjs` |
| Actual executable stdout is exclusively JSON-RPC; all tools discoverable | `stdout.test.mjs`, `server.test.mjs` |
| Typed errors traverse actual stdio without private content | `error-protocol.test.mjs`, `errors.test.mjs` |
| Options, no prompt rewriting, durable replay, usage and bounded previews | `generation.test.mjs` |
| Native multipart, explicit source, process restart and branching lineage | `editing.test.mjs` |
| Invalid formats/shapes/quality/counters and safe HTTP categories | `provider.test.mjs`, `generation.test.mjs` |
| Immutable files, interrupted operations, persistence and concurrency | `artifacts.test.mjs`, `operations.test.mjs` |
| Explicit paid bounds and invalid smoke-source refusal | `live-budget.test.mjs`, `smoke-source.test.mjs` |

Provider fixtures use the sanitized [observed Azure response shape](evidence/azure-contract.md);
their synthetic pixels are not evidence of model quality. Real Azure evaluation
requires the separate explicit opt-in and durable request bounds in
[live testing](live-testing.md). CI/release wiring belongs to issue #30.
