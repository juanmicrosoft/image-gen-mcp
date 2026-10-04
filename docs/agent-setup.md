# Agent setup procedure

This is the procedure a coding agent follows when the user sends the
[README setup prompt](../README.md#ask-your-agent-set-this-up-for-me). The
prompt states the goal and ground rules; this file holds the detail so the
prompt can stay short and this procedure can change with the code.

The user's goal is a working image-gen MCP **registered globally (user scope)
in the host they are talking to**, backed by a new or reused Azure deployment
configured through Azure CLI, without Azure portal configuration.

Pause for sign-in, required choices, explicit approvals or blockers, then
continue after they are resolved. Use the
[action-first checkpoint templates](setup.md#action-first-checkpoints) at every
pause, and keep the [private setup-progress checkpoint](setup.md#resuming-a-paused-setup)
so a reply or restart resumes the pending decision instead of restarting setup.
Never override the host's mandatory approval or task-lifecycle rules. A
confirmation wait is an incomplete checkpoint, not successful setup. If a form
reports the user unavailable, do not keep calling it; use the text checkpoint
where the host permits it.

## 1. Prepare the environment and Azure plan

Use an isolated private checkout, verify its remote is
`https://github.com/juanmicrosoft/image-gen-mcp.git` and report the resolved
commit SHA. Read [AGENTS.md](../AGENTS.md), [azure-setup.md](azure-setup.md),
[setup.md](setup.md), [clients.md](clients.md) and
[live-testing.md](live-testing.md) before Azure actions.

### Tools

Check Node (tested 22.22.2), npm, Azure CLI and Bicep. If something is missing,
propose the official installation command for the user's OS before installing
it. The Azure provisioning script uses Node built-ins and `az`; it does not
need `npm ci` or an installed MCP runtime. Before any source dependency install,
follow the lockfile check in [setup.md](setup.md#if-checkout-or-installation-fails);
do not generate or modify manifests or lockfiles without approval.

If public npm access fails, run the single bounded `npm ping` diagnostic from
[setup.md](setup.md#if-checkout-or-installation-fails) and report the sanitized
error. Keep npm as the default; for a connectivity/availability failure, try the
[GitHub Releases bundle](github-release-install.md) only if organizational
policy permits it. Do not switch registries, disable TLS checks, bypass a
policy denial or fall back on integrity/security errors. Independent read-only
Azure checks may continue, but report runtime installation as blocked until
one route succeeds.

### Scope and sign-in

Run `az account show` first and display only the current tenant and
subscription. If the user needs another one, summarize counts by tenant and
show a small filtered selection; do not dump the full subscription inventory.
If sign-in is needed, start `az login` and let the user complete it; never ask
for credentials in chat.

The first decision is only tenant/subscription confirmation and new deployment
versus reuse. A reply such as `New deployment; confirmed` or `Reuse; confirmed`
authorizes read-only feasibility only, **not** resource creation or roles.
Read-only identity/provider/model/quota/pricing/RBAC checks may run before this
choice against the displayed subscription, subject to host tool approval. Do not enumerate other
subscriptions or assume results carry over after a scope change. If the user
already gave an unambiguous scope and path, reuse it instead of asking again.
Use supported commands from the installed `az` version; for gaps, `az rest` may
use a documented ARM endpoint and API version, cited rather than guessed.

### Reuse

Discover candidates in the confirmed subscription, read-only, and let the user
pick one instead of asking them to type an endpoint and alias:

```sh
az cognitiveservices account list --subscription <id> \
  --query "[?kind=='OpenAI' || kind=='AIServices'].{id:id, name:name, rg:resourceGroup, location:location, endpoint:properties.endpoints.\"OpenAI Language Model Instance API\"}"
az cognitiveservices account deployment list --subscription <id> -g <rg> -n <account> \
  --query "[].{alias:name, model:properties.model.name, version:properties.model.version, sku:sku.name, state:properties.provisioningState}"
az ad signed-in-user show --query id -o tsv
az role assignment list --assignee <object id> --include-inherited --include-groups \
  --scope <account id> --query "[].{role:roleDefinitionName, scope:scope}"
az role definition list --name "<role>" --query "[0].permissions[0].dataActions"
```

- Offer only deployments whose **deployment record** reports the supported
  model and version (`gpt-image-2.5-sunburst`, `2026-09-08`) with a succeeded
  state. Never infer the model from the alias.
- Use the `OpenAI Language Model Instance API` endpoint
  (`https://<name>.openai.azure.com/`) for both `OpenAI` and `AIServices`
  accounts. Do not use `properties.endpoint`: for `AIServices` accounts it is
  the `cognitiveservices.azure.com` host, which the runtime rejects.
- Classify access by **data actions**, not role names or management rights.
  A role counts as likely inference access only if its `dataActions` cover
  `Microsoft.CognitiveServices/accounts/OpenAI/images/generations/action`
  (for example **Cognitive Services OpenAI User**, or a wildcard such as
  `Microsoft.CognitiveServices/*` in **Foundry User**), at the account or any
  parent scope. Owner and Contributor have no data actions. Name the role and
  its scope. Say that PIM-eligible roles and deny assignments are not shown,
  so "no matching role" means unknown, not denied. Only a real image request
  proves inference.
- For each candidate show account, resource group, region, endpoint, alias,
  model and version, and the access classification. Present them with the
  [pick-deployment template](setup.md#pick-a-deployment-to-reuse). With more
  than two candidates, recommend one, list the rest in the question, and keep
  manual entry and cancel as options. Always include a manual-entry option for
  resources in other subscriptions or ones the user cannot list. If none is
  found, say so and offer manual entry or a new deployment.
- Stay inside the confirmed subscription. For manually entered details, verify
  the model/version when authorized, otherwise get confirmation from the owner.

Do not modify an existing resource or treat its alias as proof of its model.

### New deployment

Use `scripts/azure.mjs` and `infra/main.bicep` from the checkout, not an
improvised deployment ([azure-setup.md](azure-setup.md)). Explain the proposed
region, model, public-network/key-enabled development topology, expected costs
and the required resource-creation plus role-assignment permissions. Before
proposing writes, check identity, subscription, provider registration,
model/version/SKU/quota, topology, current pricing, proposed names and effective
RBAC. Contributor alone does not grant role-assignment write permission. Mark
any unverified check or estimate explicitly; do not claim guaranteed capacity
or cost, and do not silently switch model or region.

Use `--auth azure-cli`, an explicitly confirmed subscription, unique account and
dedicated resource-group names, and an absolute private `--state` path. Do not
grant subscription-wide Owner or fall back to API keys on failure. If access or
quota is blocked, report the exact blocker and required admin action.

### Write approval

After read-only feasibility, present one consolidated
[write-approval checkpoint](setup.md#final-resourcerole-write-approval) under a
stable plan identifier. This is a second, distinct authorization; the earlier
new/reuse choice never substitutes for it. If runtime installation is blocked,
wait by default; the user may explicitly approve provisioning anyway using the
blocked-install acknowledgment described there. Account switching, a retry
request, silence or an unavailable form is not approval. Do not create
resources, register providers, assign roles or write ownership state before
approval, and reconfirm if the plan changes.

Keep ownership state for recovery/cleanup, including after partial failure.
Never delete/adopt unrelated resources or reset state to bypass ownership. Read
back deployment success and save the endpoint, deployment and output directory
in private local configuration, not source control. Do not expose keys/tokens
or generate images at this stage, and do not claim inference is tested.

## 2. Install the runtime and register it globally

Use the Azure configuration established above without asking the user to
re-enter it.

### Identify the host

Identify the host application and use its supported MCP configuration format.
Configure only this host, not every installed client. Do not infer the host
from the AI model name: a Claude model inside Copilot still needs Copilot
configuration. If the host is ambiguous, unsupported or its configuration is
inaccessible, ask before changing it.

### Install a pinned version

Use npm first. Resolve the latest version with:

```sh
npm view @juanmicrosoft/image-gen-mcp dist-tags.latest --registry=https://registry.npmjs.org/
```

Report the exact version and check its release notes, Node requirements and
setup compatibility. If lookup fails or compatibility is unclear, do not guess a
version or downgrade. Install that exact version with `--ignore-scripts` in a
persistent local prefix. Do not use a floating `@latest` command in the MCP
launcher or silently upgrade an existing installation; ask before replacing it.

For the [bundle route](github-release-install.md), download the bundle and
checksum for the exact resolved version and OS/architecture (or, if npm could
not resolve a version, the latest non-prerelease GitHub release). Verify the
checksum, provenance and compatibility before extraction. GitHub source
archives and npm tarballs are not dependency-complete bundles. Keep the bundle
at a persistent path and use its launcher, bundled Node and `configure-client`
helper; do not run `npm install` inside it. If no route works, checkpoint
installation as blocked for a later explicit retry. If the release lacks a
compatible asset or verification fails, stop with the precise blocker; do not
choose an older release silently.

### Register at user scope

Use `IMAGE_GEN_AUTH=azure-cli`, `IMAGE_GEN_PREVIEW=false` and an absolute
private output directory; do not pass `AZURE_OPENAI_API_KEY` in CLI-auth mode.
Pass the endpoint, deployment and any explicit tenant, plus `AZURE_CONFIG_DIR`
if an isolated Azure CLI profile was used. Use the absolute installed entrypoint
(or bundle launcher) and make sure the process can find `node` and `az`.

Inspect existing client configuration first. Add only the `image-gen` entry,
preserve other servers and host approval policies, and stop on a name conflict.
Keep personal configuration outside source control. Register at the host's
**user (global) scope** unless the user asks for something narrower:

- **Claude Code:** `claude mcp add --scope user --transport stdio` with explicit
  `--env` values ([clients.md](clients.md#claude-code-stdio-registration)).
  Do not copy Copilot-only `tools`/`timeout` fields.
- **VS Code:** merge into the user MCP configuration (**MCP: Open User
  Configuration**); do not commit personal settings in `.vscode/mcp.json`.
- **Copilot CLI:** generate the entry with the installed `configure-client.mjs`
  helper (or the bundle's `configure-client` launcher), then merge only that
  entry into `~/.copilot/mcp-config.json` or use `/mcp add`. The helper refuses
  to overwrite, so write it to a new private temporary file and merge only the
  `image-gen` entry; delete that temporary file once the merge is verified.
  A session-local
  `--additional-mcp-config` file remains available if the user prefers it.

### Activate and verify

Reload or restart the host as needed and show the exact step; do not assume
the running agent can reload its own tool inventory. Checkpoint as awaiting
restart, using the [client restart template](setup.md#client-restart) and the
[Copilot resume guidance](clients.md#activate-in-a-new-process-and-resume).
For Claude Code, ask the user to exit and run `claude --continue` (or start
`claude`), then inspect `/mcp`; see
[Claude Code registration](clients.md#claude-code-stdio-registration). In the
resumed host, read the checkpoint and continue discovery rather than
reprovisioning or repeating configuration.

Verify that the client discovers `get_capabilities`, `generate_image`,
`edit_image` and `get_operation`. Call only `get_capabilities` and explain any
unverified inference/permission checks. If you cannot inspect the client
session, give the user the exact check to run rather than claiming it is
connected. Do not request an image or auto-approve billable tools.

## 3. Offer an optional one-image test

After connection and nonbillable diagnostics succeed, report setup complete
with inference still unverified, then use the
[optional paid image checkpoint](setup.md#optional-paid-image). Unless the user
chooses a different brief, propose a 1536x864 high-quality PNG of a lighthouse
on a quiet rocky coast at dawn, with open sky on the left for a title. If they
decline, finish without images. Silence or re-pasting the setup prompt is not
approval.

Only after explicit approval, create a fresh operation UUID, retain it before
submission and generate once with the configured deployment. Do not retry,
edit, switch models or submit again automatically. If the outcome or transport
is uncertain, call `get_operation` with the same UUID. On success, inspect the
saved full-resolution PNG with a local image-reading tool if available and
show its path; if you cannot inspect it, say so and do not claim visual quality.

Finish with the installed version, configured host and scope, private
configuration/state paths, verification results and remaining limitations.
At user scope, note that the billable tools are available in every project for
that user, and give the host's removal command (for Claude Code,
`claude mcp remove --scope user image-gen`).
Never describe a blocked or unverified step as completed.
