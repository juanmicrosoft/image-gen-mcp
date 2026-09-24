# Authentication evidence and administrator blocker

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
