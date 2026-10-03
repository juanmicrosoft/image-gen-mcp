# Isolated Azure deployment

For an agent-driven experience, send the [single README setup prompt](../README.md#get-started)
as a message to your local coding agent. It can run the commands below through Azure CLI;
no Azure portal resource setup is required. You still complete interactive
sign-in and explicitly approve the subscription, topology/costs and permission
changes. Missing model access/quota or role-assignment rights requires the
resource owner/administrator; automation cannot bypass those gates.

Provisioning uses `scripts/azure.mjs` and `infra/main.bicep` from a trusted source
checkout. They are intentionally not shipped as npm runtime commands. The
script's default CLI-auth provisioning path expects an interactive Entra user
(`az ad signed-in-user show`), not a service-principal login.
It uses only Node built-ins plus `az`: npm dependency installation is not a
prerequisite for Azure feasibility or provisioning. A blocked registry must
still be disclosed before approving resources whose runtime cannot yet install.

Show the current subscription first and filter any larger inventory rather
than sending it all to the conversation. Check installed CLI help before using
an unfamiliar subcommand; a missing read-only command may be replaced with
`az rest` against an official documented ARM endpoint/API version, not a guessed
API. Keep the actual writes in the reviewed provisioning flow below.

After read-only feasibility, consolidate proposed writes into one approval
request with exact tenant/subscription/principal, resource names, region,
model/SKU, topology/costs, role scope and private state path. Include provider
registration only if needed. The initial short new/reuse choice confirms the
displayed tenant/subscription for read-only work, not resource creation.
Prefer conversational replies when the host permits them. Final write approval
must identify the exact plan; if a required form is unavailable, preserve a
pending checkpoint and offer text options only where host policy permits.
Resume on the next explicit response rather than restarting the workflow.
Do not count switching accounts or asking to retry as approval to provision.
An incomplete permission/quota check must remain an explicit blocker or
uncertainty, never be silently marked passed.

Registry failure does not prevent Azure provisioning technically. Try the
[approved GitHub bundle fallback](github-release-install.md) for runtime
installation first when possible. If neither distribution route works, the default
workflow waits, but the user may explicitly approve creating resources despite
blocked MCP installation and possible costs. Include that acknowledgment in the
final write approval; neither the initial scope choice nor a generic retry is
sufficient. Preserve the blocked runtime status and do not use arbitrary
package sources or bypass organizational policy.
Read-only progress belongs in the [separate setup checkpoint](setup.md#resuming-a-paused-setup);
only the provisioning script creates ownership state after approval, before
resource creation.

Requires Azure CLI, Bicep and a signed-in Entra user. The identity needs resource
creation/deployment permissions and permission to assign the resource-scoped
**Cognitive Services OpenAI User** role. That built-in role includes management
reads as well as inference permissions; it is not a strict data-only role or
permission to provision infrastructure. Do not grant subscription-wide Owner
to work around a failure.

The default `--auth azure-cli` includes that role assignment. If an administrator
cannot grant assignment rights, the separate explicit `--auth api-key` mode
omits RBAC changes and does not claim CLI inference is enabled. It still requires
authorized resource creation and, separately, key access for inference. No
automatic fallback occurs. An administrator must grant inference access before
CLI-token runtime use. A separate [tested data-only custom role](evidence/data-only-authentication.md)
has zero management actions and one image data action; the provisioning template
does not silently substitute that role for its documented built-in default.
See the [authentication history](evidence/authentication.md) for earlier denials
and the explicit live-expiry diagnostic limitation.

Read [cost/geography guidance](live-testing.md) first. This template deliberately
uses a public-network, key-enabled `AIServices` S0 account and a pinned Sunburst
GlobalStandard deployment (capacity 1); it is a local-development topology, not
a private-network production configuration. No Foundry project, Agent Service,
storage account or hosted application is required by this template.

```sh
az login
az account show --query '{id:id,state:state}'
# Select YOUR intended subscription ID and globally unique account name:
node scripts/azure.mjs --action provision \
  --subscription YOUR_SUBSCRIPTION_ID --group rg-image-gen-mcp-test \
  --name YOUR_UNIQUE_ACCOUNT_NAME --state "$PWD/.local/azure.json" \
  --location eastus2 --confirm provision
```

The script checks provider registration, model/version/SKU and reported quota,
refuses adoption of existing unowned resource groups, saves private ownership
state before creation, validates Bicep, and deploys. ARM validation/deployment is
the final permissions/capacity check: catalog presence is not a guarantee.
Rerun with identical arguments/state to reconcile the owned deployment.
Do not commit the local state (it contains subscription/resource identifiers,
not credentials). The script never retrieves API keys.

If deployment fails after group creation, keep the state. Fix the reported
permission/capacity problem and rerun, or clean up the owned group. If group
creation itself failed after state was written, inspect whether the group exists
before retrying; do not delete the state blindly. Version changes or a different
region require an explicit new plan, not automatic fallback.

Cleanup requires an exact confirmation copied from the local `groupId`:

```sh
node scripts/azure.mjs --action cleanup --state "$PWD/.local/azure.json" \
  --confirm /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/rg-image-gen-mcp-test
```

Cleanup checks the owner token and refuses groups containing unexpected
resources. It waits for deletion and does not purge soft-deleted Cognitive
Services accounts; account-name reuse may require Azure-specific recovery or a
new unique name. Remove private state only after inspecting the final outcome.

Schema source: [Microsoft.CognitiveServices/accounts 2025-06-01](https://learn.microsoft.com/en-us/azure/templates/microsoft.cognitiveservices/2025-06-01/accounts).
The template pins its API/model versions; live evidence is recorded separately.
