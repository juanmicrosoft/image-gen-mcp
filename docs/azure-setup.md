# Isolated Azure deployment

Requires Azure CLI, Bicep and a signed-in Entra user. The identity needs resource
creation/deployment permissions and permission to assign the resource-scoped
**Cognitive Services OpenAI User** role. That role is the intended runtime role,
not permission to provision infrastructure. Do not grant subscription-wide Owner
to work around a failure.

The default `--auth azure-cli` includes that role assignment. If an administrator
cannot grant assignment rights, the separate explicit `--auth api-key` mode
omits RBAC changes and does not claim CLI inference is enabled. It still requires
authorized resource creation and, separately, key access for inference. No
automatic fallback occurs. Ask an administrator to provision the least-privilege
role before claiming keyless runtime support.

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
