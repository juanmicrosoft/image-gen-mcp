# Controlled transport refusal and uncertainty diagnostics

Issue #68; observed 2026-09-25 UTC, macOS arm64, Node 22.22.2. This validates
the existing runtime contract at `f8f5ebc5f2835c7408af5b2cae52c491048b48b7`;
no runtime change was needed.

## Initial probe correction

A loopback proxy rejected CONNECT with HTTP 403 and never forwarded requests.
The first control-only harness hung after destroying sockets and was stopped
before MCP submission. A corrected harness performed one real stdio
`generate_image` attempt, then incorrectly asserted `error.code: network`.
It actually observed `error.code: outcome_unknown`, which is the intended
completion category. The assertion ran before result persistence: its separate
`failureCategory` was **not retained**, so that run does not prove the field
was absent or wrong. Operation `67b21171-343d-46ff-a8ac-522b63810538` remains
unknown and its ledger remains exhausted at 1/1.

A later non-MCP control observed a nested `UND_ERR_ABORTED` for CONNECT 403.
That is neither proof of ordinary connection refusal nor a reconstruction of
the unsaved MCP response. Ambiguous causes remain conservatively classified.

## Separate bounded connection-refusal proof

A new purpose-specific one-attempt ledger was declared, without resetting the
old ledger or resubmitting the old operation. The test reserved then closed a
loopback listener and configured the child Node process's HTTP/HTTPS proxy to
that unavailable local port, with `NO_PROXY` empty and `--use-env-proxy`.
A non-image control first confirmed actual `ECONNREFUSED`. The normal compiled
stdio MCP then used an explicit **nonfunctional synthetic key**, not Azure CLI
credentials. No proxy process forwarded requests to Azure.

The harness saved the complete tool/status results before assertions:

| Field | Observed |
| --- | --- |
| Operation | `6da5ccc0-cff5-4da0-bae5-c85b45f7f3f6` |
| MCP `isError` | `true` |
| `error.code` / `error.outcome` | `outcome_unknown` / `unknown` |
| `failureCategory` | `network` |
| `error.automaticRetry` / `error.billing` | `false` / `unknown` |
| Nonbillable `get_operation` | `outcome_unknown`, no artifact |
| Request ledger | 1/1, no generation retry |

The runtime deliberately does not infer free billing from what this harness
knows about the local connection. This is controlled local transport refusal,
**not** an Azure firewall-policy test, inference authorization proof, live
expired-session proof or certification of every proxy/network environment.

`test/generation.test.mjs` separately exercises reset/refusal, timeout, abort and
ambiguous nested abort causes through the actual image tool handlers. It asserts
the primary category, separate diagnostic, text/structured agreement, redaction,
unknown status, and no additional submission after a fresh runtime replays the
same operation. Replay cannot recover a cause that was not persisted.
