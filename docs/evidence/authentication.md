# Authentication evidence and historical blockers

## Latest: isolated data-only proof

The [separate 2026-09-25 data-only run](data-only-authentication.md) proved
certificate-authenticated Azure CLI generation/editing with zero management
role actions and an actual authenticated ARM read denial. Temporary test
authorization and local credentials were removed and absence verified.
The same record includes the current diagnostic matrix and explicit #11
acceptance revision: live expiry remains unverified and was removed from the
v1 completion gate, not marked tested. The observations below are historical.

## Earlier post-grant observations: 2026-09-25 UTC

The original grant blocker was resolved by an authorized administrator assigning
Cognitive Services OpenAI User to the runtime user at the image-account scope.
The intended runtime identity was restored and the assignment/token checked.
CLI-token generation then succeeded; a later installed-client run also proved
editing in both Copilot CLI and VS Code. See [qualification](client-qualification.md)
for exact images, hashes, client versions and limits. No API-key fallback occurred.

The first post-grant attempt failed credential acquisition (underlying cause
unverified); its explicitly requested retry succeeded and exhausted that
two-attempt budget. Generation operation `074bd779-c592-4368-b0df-16b9373c38bc`
produced a fully decoded 1536x864 PNG with SHA-256
`ee4e34517eb05912f0421f3390170b68206c8662f738a8399ba4940a285f65c6`,
70,553 ms, usage 57 input / 1078 output / 1135 total. Nonbillable recovery
returned the same artifact. The first #11 acceptance criterion is complete.

**#11 remains open.** Read-only assignment inspection showed the runtime
identity also has inherited Contributor access; it is not a strict data-only
principal. No existing permission was removed to manufacture that proof.
The new [safe diagnostic reasons](../diagnostics.md) distinguish observed
unavailable-tenant and logged-out-profile failures. Live expiry and every
negative-case behavior remain unproved; SDK generic login guidance can collapse
different causes. The historical observations below are retained, not current
claims that no administrator grant or CLI success has occurred.

An additional local transport-denial experiment on 2026-09-25 used an explicitly
nonfunctional synthetic key and a loopback proxy that rejects CONNECT without
forwarding. The real stdio generation call returned `error.code: outcome_unknown`
and its operation remains unknown. The harness wrongly expected `network` in
that primary field, rather than inspecting the existing separate
`failureCategory`; it failed before retaining the full result. This does **not**
prove missing diagnostic metadata. Issue #68 tracks the corrected validation;
this is not live Azure firewall evidence.
The initial control-only harness hung on socket teardown and was stopped before
any MCP submission. The corrected harness consumed its separate one-attempt
ledger; no automatic retry or reset was performed.

## Initial observations

Issue #11 is **not complete**. Observed 2026-09-24 with Azure CLI 2.90.0:

- API-key generation and single-reference editing succeeded on the
  [recorded image contract](azure-contract.md).
- The current signed-in user's token was acquired for
  `https://cognitiveservices.azure.com/`, but its generation request returned
  HTTP 401, provider code `PermissionDenied`.
- The CLI-auth provisioning path failed at
  `Microsoft.Authorization/roleAssignments/write`. No broader role, alternate
  identity or subscription was selected. Explicit API-key provisioning is
  separate and does not resolve this authorization failure.

An administrator must grant the intended resource-scoped inference role before
CLI-authenticated generation can be demonstrated. Runtime uses
`AzureCliCredential` only, scope
`https://cognitiveservices.azure.com/.default`, and the optional explicitly
configured tenant. No `DefaultAzureCredential` chain or automatic key fallback
is used. Configuration tests prove selection; they do not prove live permission.

## Candidate role, not a proof of least possible privilege

Read-only verification:

```sh
az role definition list --name "Cognitive Services OpenAI User" \
  --query '[0].{name:roleName,permissions:permissions}'
```

The returned built-in role includes
`Microsoft.CognitiveServices/accounts/OpenAI/images/generations/action` and
other inference data actions. Its ID is
`5e0bd9bd-7b93-4f28-af87-19fc36ad61bd`. It does **not** grant role assignment or
management key listing, but does include `Microsoft.CognitiveServices/*/read`
and role-definition/assignment reads. Therefore it is not a strict
zero-management-access role, and is not evidence for the separate
inference-only-principal acceptance criterion. Exact edit authorization and a
data-only custom role remain unverified; do not infer them from a role name.

An authorized administrator can grant the built-in role at the **account**
scope (placeholders below; no actual grant was executed):

```sh
az role assignment create \
  --assignee-object-id YOUR_USER_OBJECT_ID --assignee-principal-type User \
  --role 5e0bd9bd-7b93-4f28-af87-19fc36ad61bd \
  --scope /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/YOUR_GROUP/providers/Microsoft.CognitiveServices/accounts/YOUR_ACCOUNT
```

Do not grant subscription Owner/Contributor to fix runtime inference. After
the administrator action and propagation, explicitly run a new bounded
CLI-auth smoke request under the [live-testing procedure](../live-testing.md).
A real successful PNG and sanitized status/usage record are required to close
the CLI generation criterion. A separate appropriately authorized data-only
principal is required to prove inference without management permissions.

## Failure evidence boundaries

Configuration validation rejects malformed tenant UUIDs. Credential acquisition
errors give sanitized `az login`/tenant guidance. Provider `PermissionDenied`,
authentication failure and transport errors have separate error categories in
the offline tests. These are not live demonstrations of every expired-login,
wrong-tenant or network-denial scenario. A generic 401 alone cannot reliably
identify which credential problem occurred; the runtime must not invent that
diagnosis or expose raw credential exception text.

Remaining acceptance: successful CLI inference; isolated data-only principal;
live expired-login/wrong-tenant/network-denial differentiation. They are blocked
or unverified, not replaced by the successful API-key result. Managed identity
is not an advertised authentication mode.
