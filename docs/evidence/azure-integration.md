# Azure integration and remaining gate — epic #2

**Update:** [Later qualification](client-qualification.md) resolves the
resource-scoped grant and CLI-token generation/editing observations.
[Subsequent isolated data-only evidence](data-only-authentication.md) records
generation/editing, authenticated ARM denial, cleanup and the explicit
diagnostic-acceptance refinement; live expiry remains unverified.

## Historical integration record

2026-09-24. **This epic remains open.** Its dedicated integration PR records
completed work and the authorization blocker without weakening acceptance.

| Child | Dedicated PR | State and evidence |
| --- | --- | --- |
| #9 model/API contract | [#40](https://github.com/juanmicrosoft/image-gen-mcp/pull/40) | Closed; [real generation/editing contract](azure-contract.md) |
| #10 isolated deployment | [#38](https://github.com/juanmicrosoft/image-gen-mcp/pull/38) | Closed; [Bicep/reconciliation/populated cleanup](azure-deployment.md) |
| #11 least privilege | [#45](https://github.com/juanmicrosoft/image-gen-mcp/pull/45) | Partial merged; [authorization evidence and admin handoff](authentication.md) |
| #12 cost/geography/bounds | [#34](https://github.com/juanmicrosoft/image-gen-mcp/pull/34) | Closed; [cost and bounded testing policy](../live-testing.md) |

The existing subscription hosted a real East US2 GlobalStandard deployment of
`gpt-image-2.5-sunburst` version `2026-09-08`. Explicit API-key generation and
editing succeeded; the active owner-tagged test account remains available.
The separate populated cleanup account was deleted without purge. Runtime tools
do not provision resources or discover management keys.

Current-principal CLI-token inference returned 401 `PermissionDenied`.
Attempting role assignment was denied; no identity/subscription switch or
privilege workaround was performed. An authorized administrator must provide the
intended grant and enable the separate least-privilege proof. The candidate
OpenAI User role includes management reads, so its existence alone cannot prove
strictly data-only access.

Retail prices are dated public observations, not invoice guarantees;
GlobalStandard placement is not an East US2-only processing promise. Existing
live ledgers retain successes, failures and unknown outcomes and must not be
reset to make acceptance green. The authorization gate and epic stay open until
the missing authorized inference evidence exists.
