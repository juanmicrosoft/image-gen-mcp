# Isolated data-only authentication and final onboarding boundaries

Issue #71, supporting #11/#28/#26; observed 2026-09-25 UTC on macOS arm64,
Node 22.22.2, npm 10.9.7, Azure CLI 2.90.0 and `@azure/identity` 4.13.3.
No runtime implementation changed for this proof.

## Tested installed artifact

The normal installed executable came from reviewed source
`43066c5817d314a9375a2e0db36a0f946deed198`, with tarball SHA-256
`0ed0b8c6d67141c0f03a16a7be33f0b33b68677f809e108ea44d24b6ddd39d68`
(71 files). The package verifier installed it outside the checkout with
`npm install --prefix <fresh-prefix> --ignore-scripts --no-audit --no-fund
--offline <tarball>`, then checked the executable, tool discovery, version
agreement, inventory and relative documentation links.

This local install used a warm cache; it is not registry publication or a
cold-machine install claim. Hosted Ubuntu/macOS
[CI 36159068876](https://github.com/juanmicrosoft/image-gen-mcp/actions/runs/36159068876)
separately passed normal dependency installation and package verification for
that source. Subsequent documentation/test changes require a new tarball hash.

## Authorization isolation

An explicitly signed-in administrator used a separate Azure CLI configuration
directory. The original runtime user's login and subscription were unchanged.
The administrator created a uniquely named temporary single-tenant application,
service principal and one-day certificate credential. No client secret was used.

The custom role had exactly:

```json
{
  "Actions": [],
  "NotActions": [],
  "DataActions": [
    "Microsoft.CognitiveServices/accounts/OpenAI/images/generations/action"
  ],
  "NotDataActions": []
}
```

Its assignable scope was the existing test resource group; its **only assignment
was at the existing image-account resource**, not subscription scope.
Administrator readback inspected the role and principal's assignments including
inherited assignments: one assignment, no management actions or other roles.
This is stronger evidence than checking the role definition alone.

The CLI generated a different role UUID than the input `Id`. The harness stopped
on its assertion before creating any assignment. It then read back the uniquely
named role, checked its ownership description and permissions, saved the actual
UUID and created the sole grant. It did not create a replacement role.

The principal signed in to its own empty CLI profile using:

```sh
AZURE_CONFIG_DIR="/PRIVATE/TEST-PROFILE" az login \
  --service-principal --username "TEST-APPLICATION-ID" \
  --certificate "/PRIVATE/TEST-LOGIN.pem" --tenant "TENANT-ID" \
  --allow-no-subscriptions
```

The PEM contained the private key plus public certificate, with restrictive
permissions; neither was printed or committed. Subscription discovery returned
only a tenant-level account. This did not prevent image token acquisition.

## Actual management denial and successful inference

An initial `az rest` command stopped locally with "Subscription not found";
that is **not** proof of ARM denial. A separate `AzureCliCredential` then acquired
an ARM token in memory and made the exact account GET directly over HTTPS.
The response was HTTP **403**, code **`AuthorizationFailed`**, identifying the
expected principal, exact account scope and
`Microsoft.CognitiveServices/accounts/read`. No token was placed in command
arguments, output or retained evidence.

The installed `scripts/configure-client.mjs` produced a fresh private
configuration selecting `azure-cli`, the tenant, endpoint, deployment and output
root. No API-key field or fallback existed. The test launcher explicitly passed
the isolated `AZURE_CONFIG_DIR`: the helper intentionally copies only selected
runtime settings, not arbitrary environment variables. This extra profile
selection is disclosed, not an undocumented default for fresh users.

Real stdio discovery found four tools. `get_capabilities` acquired a CLI token
while correctly leaving management metadata and inference **unverified**.
The normal installed MCP then performed these two bounded requests:

| Action | Operation | Artifact | Elapsed | Usage input/output/total |
| --- | --- | --- | --- | --- |
| Generate | `ce0a28e4-0841-4048-81de-7cc8917f01a1` | `f0d36fc0-5dc0-4aaa-96a2-ba50fe7ba4da` | 45,427 ms | 39 / 1078 / 1117 |
| Explicit-source edit | `5f03c7fe-659f-4f61-93a7-7209f0c8c72e` | `87b90e1e-2a77-45ff-bb78-6120b1f2a605` | 55,551 ms | 1336 / 1078 / 2414 |

Generation SHA-256:
`4e618bef24a33f831e2e73e0911db47d293536f889c78196d8f9766e4ad2614d`.
Edit SHA-256:
`0e705e2a930f0aab165b14f3cb00725f66ad69cd3708dfd511eac8821c44598e`.

Both PNGs fully decoded at 1536x864. The edit's source ID/hash match the original,
whose image hash remained unchanged. Nonbillable status lookup recovered both
successful artifacts. Previews were disabled. A new predeclared ledger finished
**2/2**, one generation and one edit, with no retry, fallback or alteration of
older ledgers/unknown operations.

For this tested model/version/API contract, the single image-generation data
action sufficed for **both** generation and the edits endpoint. This is a
demonstrated sufficient narrow role, not a universal least-permission guarantee
for every Azure route, model, policy or future API version.

## Verified cleanup

The administrator removed only the task-owned assignment, custom role, service
principal and application, checking identity/name/scope ownership first.
Subsequent assignment/role/application/service-principal listings returned zero
matching active objects. The private key, combined login PEM, public certificate
and isolated CLI credential cache were deleted and their absence checked.
The user's original runtime login/subscription and existing inference deployment
were preserved. Cloud deletion is not a claim about immediate revocation of all
previously issued tokens or directory retention/purge policy.

## Diagnostic matrix and explicit acceptance refinement

| Evidence | Observed safe result | Limit |
| --- | --- | --- |
| Real unavailable-tenant diagnostic | `tenant_unavailable` | Not every wrong-tenant/Conditional Access case |
| Real empty CLI profile | `login_required` | Not proof that a previous session never expired |
| Earlier provider HTTP 401 `PermissionDenied` | `permission` | Authorization denial, not a uniquely proven missing-role root cause |
| Controlled loopback connection refusal | Primary `outcome_unknown`, separate `failureCategory: network` | Not an Azure firewall-policy test; billing remains unknown |
| Synthetic recognized Entra expiry codes | `session_expired` | Not a live expired-session experiment |
| Real SDK with synthetic AADSTS700082 plus generic `az login` guidance | `login_required` | SDK discarded the specific cause before MCP classification |

See the retained [authentication history](authentication.md),
[controlled network proof and corrected initial assertion](network-denial.md)
and [safe diagnostic contract](../diagnostics.md).

In pinned `@azure/identity` 4.13.3, `AzureCliCredential.getToken` checks stderr
for generic `az login` guidance and replaces it with its public login message.
`test/auth-reasons.test.mjs` now exercises that real SDK through stdio with a
temporary fake CLI: the same synthetic expiry code maps to `session_expired`
without that guidance and `login_required` with it. No real Azure login or
provider request occurs in that regression.

Issue #11 originally demanded distinguishable expired-login, wrong-tenant,
missing-role and network-denial causes. Its recorded, independently reviewed
acceptance-design revision explicitly **removes live-expiry validation from the
v1 completion gate**. It does not claim that test passed. Recognized signals are
classified conservatively; ambiguous/SDK-collapsed failures remain unknown or
qualified login-required, without leakage, fallback, automatic resubmission or
broad runtime-role advice. **Live expired-session behavior remains unverified
and is not advertised.**

## Onboarding and platform matrix

This run proves an installed, CLI-token, data-only runtime can generate/edit
without management discovery. It is an SDK-driven stdio acceptance run, **not**
another native Copilot UI test or proof of fresh human-user Azure sign-in.
[Separate actual-client qualification](client-qualification.md) records the
fresh Copilot CLI/VS Code profiles, normal user CLI credential home, native
preview-off recovery and host-model/version limits.

[Earlier onboarding](onboarding.md) separately executed a fresh source clone,
the documented private-config helper and API-key runtime without management
access; [deployment evidence](azure-deployment.md) covers the from-scratch
Bicep/reconciliation/owner-scoped cleanup path. Together these records bound
#28/#26 acceptance; they do not erase the original unknown packed edit or claim
Windows, WSL, remote filesystem, every Node/client version, cold local install
or public npm publication. Issue closure requires final independent review and
merged evidence, not this document alone.
