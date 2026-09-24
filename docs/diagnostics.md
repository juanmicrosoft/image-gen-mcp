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
