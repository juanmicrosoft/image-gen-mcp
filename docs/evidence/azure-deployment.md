# Isolated deployment evidence

Issue: #10. Date: 2026-09-24. Azure CLI 2.90.0, Bicep 0.47.16,
Node 22.22.2 on macOS.

- `az bicep build --file infra/main.bicep --outfile <outside-repository.json>`
  succeeded.
- Default CLI-auth ARM validation failed on
  `Microsoft.Authorization/roleAssignments/write`. No role was assigned.
  Keyless/inference-only-principal verification remains blocked in #11.
- Explicit `--auth api-key` provision mode succeeded in a new, uniquely tagged
  resource group in the selected subscription: AIServices S0, Sunburst
  `2026-09-08`, GlobalStandard capacity 1, no project or Agent Service.
- An identical second provision command succeeded (owned-resource
  reconciliation). No key retrieval or inference occurred during these checks.
- The cleanup command deleted a separately created, empty, owned scratch group
  after exact-ID confirmation and ownership checks. The first attempt exposed
  unsupported `az group --ids` arguments; the corrected implementation uses
  explicit name/subscription and checks the returned ID. The repeated cleanup
  succeeded and `group exists` returned false.
- Follow-up verification provisioned a second **populated** disposable account
  and Sunburst deployment using the same template, then deleted its exact owned
  resource group and waited until `group exists` returned false. The original
  inference account was retained. No soft-deleted account was purged.
- Offline mocked-CLI regression cases prove that an expected account ID with
  foreign/missing ownership tags or the wrong resource type reaches neither
  ARM deployment nor group deletion. Both group and account ownership are
  checked; matching names alone are insufficient.

Resource/subscription identifiers and ownership tokens remain in ignored local
state, not this public evidence. Reproduction commands are in
[the setup guide](../azure-setup.md); choose your own unique names and
subscription. The populated-group result verifies teardown of the template's account and
deployment, not purge of a soft-deleted account. The original active test
account remains available for image/runtime validation; its eventual cleanup
must be separately confirmed.

An ARM deployment is not proof of the image API contract, runtime authorization,
model quality or client compatibility. Those acceptance gates remain separate.
