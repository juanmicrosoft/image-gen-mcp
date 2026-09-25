# Nonbillable diagnostics

`get_capabilities` is available even when configuration is missing. It returns
individual `passed`, `failed` or `unverified` checks; a failed check also sets MCP
`isError`. It never submits an image request, lists resources, obtains management
keys or modifies Azure. By default it does not even acquire a CLI token.

`{"check_credentials":true}` explicitly requests credential acquisition. CLI
token acquisition is not inference authorization. In key mode this checks only
local key presence, not key validity. The selected auth mode never falls back.
Provider/credential exception text and tokens are not returned.

Deployment metadata, management access and inference stay **unverified**.
Runtime deliberately has no management-plane dependency: an inference-only user
is not incorrectly labeled as having a broken deployment. Optional management
inspection can be performed separately using the commands in
[Azure setup](azure-setup.md); those results are not inferred by this tool.
A deployment alias does not identify its model.

The reported size and quality are deliberately restricted to **1536x864/high**
in v1. Other documented model options are not yet enabled. High-quality
1536x864 generation and editing with API-key auth have [live evidence](evidence/azure-contract.md).
These are repository test observations, **not** evidence about the caller's
deployment. Configuration success does not test filesystem access, reachability
or model identity.

For a billable smoke check, follow the explicit opt-in, request ledger and
no-retry procedure in [live testing](live-testing.md) using
`scripts/probe-azure.mjs`. Diagnostic calls cannot enable that path.

## Credential failure reasons

Credential checks retain their existing status/detail fields and may add a
finite `reason`: `login_required`, `tenant_unavailable`, `session_expired`,
`cli_unavailable`, `credential_timeout`, `cancelled`, `network` or `unknown`.
Immediate image errors before submission retain code `authentication` and may
add `authReason`. Raw Azure CLI errors, tokens and tenant/account identifiers
are never included in these fields.

Only recognized SDK messages, Entra codes and structured transport/abort signals
are classified. The Azure Identity SDK can replace several underlying failures
with generic login guidance; `login_required` is **not proof** that a session
never existed rather than expired. Unrecognized or ambiguous failures remain
`unknown`; a provider's generic HTTP 401 cannot establish the root cause.
Saved failed-operation replay need not retain the immediate diagnostic reason.

See [authentication evidence](evidence/authentication.md) for live boundaries and
the [official Entra error reference](https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes)
for documented codes. Synthetic expiry cases are not live expiry evidence.

On 2026-09-25 UTC, separate real stdio diagnostic calls with an unavailable
tenant and an empty temporary Azure CLI profile returned `tenant_unavailable`
and `login_required` respectively. Both retained `inference: unverified`; no
image requests were made and the active login was not modified. The empty
profile was removed afterward. These observations do not prove live expiry,
Conditional Access behavior or every network policy.
