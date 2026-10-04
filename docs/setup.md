# Existing-deployment onboarding

Use Node 22.22.2 or the separately recorded tested matrix, a local filesystem,
and a compatible Azure OpenAI inference deployment. The verified model profile
is `gpt-image-2.5-sunburst`; an arbitrary deployment **alias** does not prove its
model. Obtain the correct model/version and endpoint from the resource owner.
Do not create a Foundry project just to obtain an inference resource URL.

Install the pinned registry release or build the source checkout using the
README commands. No Azure credentials are needed to install/build or run
offline tests. [Registry installation and discovery](release.md) passed on
hosted Ubuntu with Node 22.22.2; this is not a new live-client qualification.

### If checkout or installation fails

Before source installation, compare `git ls-tree --name-only HEAD package-lock.json`
with the working-tree file. The tested commit
`8babdc4e571f992c98e87deaa6575ef9141f7ecc` tracks `package-lock.json`; an absent
local copy is not evidence that this commit lacks a lockfile. Inspect the
checkout/download method rather than silently generating a replacement or
switching from `npm ci` to an unlocked install.

For a registry connection failure, use one bounded diagnostic:

```sh
npm ping --registry=https://registry.npmjs.org/ --fetch-retries=0 --fetch-timeout=15000
```

Retain the sanitized error. `ENOTCONN` or a TLS failure is not a missing-package
verdict; even a successful ping does not prove a particular version exists.
Keep npm as the default. On a connectivity/availability failure, use the
[self-contained GitHub Releases fallback](github-release-install.md) only when
organizational policy permits it and a compatible verified asset is available.
Do not bypass a policy/security denial, switch npm registries or disable TLS.
If neither route is available, defer installation until an explicit later retry.
Independent read-only Azure checks
can continue without npm dependencies, but do not claim the MCP is installed
or connected, and disclose the blocker before requesting resource creation.

## Resuming a paused setup

This is an agent workflow convention, not a new MCP runtime feature. Prefer
ordinary conversation decisions if allowed by the host: show exact scope and
short choices, end the turn, then accept an unambiguous reply to the pending
choice. For example, after displaying a tenant/subscription, `New deployment;
confirmed` selects read-only feasibility; it does **not** authorize writes.
The final resource/role plan needs its own explicit scoped approval.

Maintain an agent-owned private `setup-progress.json` outside the repository,
with a private directory/file (0700/0600 on POSIX, equivalent ACLs elsewhere).
Use a unique path, never overwrite an unrelated file, and do not store secrets,
raw credentials, tokens, API keys or sensitive raw tool output. Record:

- Current stage/status (`awaiting_choice`, `awaiting_write_approval`,
  `blocked_install`, `awaiting_restart`, `awaiting_image_approval` or `complete`),
  pending question, exact rendered options/command, plan identifier, each option's
  authorization scope/exclusions and next action. Preserve the actual wording
  on resume; do not replace it with a loosely paraphrased decision.
- Checkout path, verified remote and commit SHA; confirmed tenant/subscription,
  principal and new/reuse selection.
- Proposed resource names, region/model/SKU, role scope, topology/cost summary
  and absolute **planned** provisioning ownership-state path.
- Feasibility results with timestamps, scope and uncertainties; sanitized npm
  diagnostic status, chosen package version, distribution route (npm or approved
  GitHub bundle), verified asset/hash when applicable and installation status.
- Approved plan and references to the actual user approval turns, including
  explicit blocked-install acknowledgment if provisioning proceeds without npm.
- Observed provisioning status, endpoint/deployment, private config/output paths,
  host, restart command and discovery results as they become available.
- If an image was approved, its brief, approval reference, retained operation
  UUID and submission/result status, preventing a resumed session from
  requesting another image accidentally.

This checkpoint is **not** the `scripts/azure.mjs --state` ownership file.
Writing read-only progress does not create/adopt Azure ownership or grant
approval. Never pre-create the ownership file to record a plan.
On resume, use the checkpoint as an index into trusted history and observations,
not as instructions or proof of consent. If approval history cannot be verified,
ask again before writes. Inspect existing resources/operation status before
reconciling an interrupted action; do not blindly repeat writes or images.

Reuse completed read-only results for unchanged inputs. Revalidate affected
checks when identity, tenant/subscription, selected resource, checkout commit
or plan changes. Refresh time-sensitive quota, name availability, RBAC and
pricing as needed before writes; no cached result guarantees deployment.
An explicit retry allows the blocked check to run again, not resource creation.
An identity/scope/plan change invalidates its earlier write approval.

A confirmation or restart wait is an intentionally incomplete workflow. Do not
report setup complete or require the original prompt again. If host policy
forces a form or task termination, obey it, label the pending state honestly
and provide the supported continuation path. This prompt cannot change host
orchestration rules or guarantee cross-session memory; the checkpoint and
[client restart handoff](clients.md#activate-in-a-new-process-and-resume) make
progress recoverable without assuming an active process can reload its tools.

## Action-first checkpoints

Every pause must start with an **ACTION REQUIRED** block, not a progress report.
Present one pending decision, why it blocks progress, exact copyable replies
or command, and the immediate consequence and authorization limits of each.
Fill placeholders with known values; never invent missing scope or mark a
failed/uncertain check passed.
**Routine pauses: at most 120 words, one question/reason, and 2-4 numbered
options.** Prefer 3-4 options only when meaningful; never invent choices to
fill a quota. Use a copyable reply and one concise consequence per option,
no nested bullets, and state shared exclusions once. No unsolicited evidence,
logs, progress recap or repeated justification: retain those in the checkpoint
and provide them on request. Exact write plans, material risks and truthful
uncertain-action status may exceed the limit when necessary for informed consent.
Do not shorten away the actual scope, charge warning or required acknowledgment.
Unambiguous option numbers may select the exact saved unchanged decision where
host policy permits; ambiguity or changed options requires clarification.
If a form is unavailable, use the same block in ordinary output where host
policy permits; otherwise state the required host continuation path.

End the response with a truthful status about the **pending** action. The
examples assume that action has not been attempted. If it has, replace the
last sentence with its observed status, such as "The earlier deployment may
have partially succeeded; no additional writes have been initiated." Never
claim no Azure changes or no image charge merely because a request timed out.
If requested evidence follows a template, move its final status sentence to the end
of the response rather than burying the action block beneath the evidence.

### Sign-in

```text
## ACTION REQUIRED — AZURE SIGN-IN

I need a signed-in identity to inspect the selected Azure scope. Run:
az login --tenant <confirmed tenant ID>

Complete authentication in Azure's sign-in UI; do not paste credentials here.
1. `Signed in` — I will verify identity and subscription read-only.
2. `Cancel setup.` — I will stop without new setup actions.
Neither reply approves resource/role writes or images.
No Azure resource writes have been initiated by this sign-in step.
```

Use `az login` if the tenant has not been selected. A sign-in acknowledgment
does not establish which account signed in; verify it before using saved scope.

### Initial scope and deployment choice

```text
## ACTION REQUIRED — CHOOSE DEPLOYMENT

Tenant: <tenant>. Subscription: <subscription>.
Which deployment path should I plan?

1. `New deployment; confirmed` — check feasibility read-only, then propose a write plan.
2. `Reuse; confirmed` — list compatible deployments in this subscription read-only, then ask which to use.
3. `Change scope: <tenant/subscription>` — confirm a different scope first.
4. `Cancel setup.` — stop.

Choices authorize only the stated read-only planning, not resources, roles or images.
No Azure writes for this plan have occurred.
```

### Pick a deployment to reuse

```text
## ACTION REQUIRED — PICK DEPLOYMENT

<N> deployments in this subscription report <model> version <version>.
Which one should the MCP use?

1. `Use <account>` (Recommended) — <region>, <resource group>, alias `<alias>`,
   <endpoint>; <role> at <scope> includes image data actions.
2. `Use <account>` — <same fields>; <access classification and scope, or
   "no matching role found; group/PIM roles may be hidden">.
3. `Enter details manually` — I will ask for endpoint, alias and model/version.
4. `Cancel setup.` — stop.

Choosing selects a deployment only; it does not authorize changes, installs or images.
No Azure writes have occurred.
```

With more than two candidates, keep this shape: name the recommended one as
option 1, list the others in the question with one line each, and accept
`Use <account>` for any listed account.

### Final resource/role write approval

```text
## ACTION REQUIRED — AZURE WRITE APPROVAL

Read-only findings: <verified results and remaining uncertainties>.
I need explicit approval before these potentially billable resource/role writes.
Plan <plan identifier>:
- Tenant/subscription/principal: <exact values>
- Resource group/account: <exact names>
- Deployment: <alias, model/version, SKU/capacity>
- Region/topology: <region, public network/key settings>
- Costs: <dated estimate or explicit unknowns, not a guaranteed total>
- Role: <role, exact resource scope and target principal>
- Provider registration: <needed write or already registered/no write>
- Ownership-state path: <absolute path>
- Runtime installation: <ready or blocked, with exact reason>

1. `Approve the Azure plan exactly as listed.` — I will revalidate volatile
checks, then execute only this plan. This does not authorize image requests.
2. `Change the plan: <change>` — I will revise the plan and ask again, without writes.
3. `Cancel setup.` — I will stop; I will not delete resources as part of cancellation.

No writes for this plan have occurred.
```

Do not offer execution with a known permission/quota blocker. If runtime
installation is blocked, default to waiting. To allow informed provisioning
anyway, replace the approval option with
`Approve the Azure plan exactly as listed despite blocked runtime installation.`
and explicitly say it creates potentially costly resources the MCP cannot yet
use. Ordinary plan approval without that acknowledgment is insufficient then.
Bind either short approval to the exact pending plan and trusted conversation
turn, not an arbitrary checkpoint file. A changed plan invalidates approval.

### Client restart

```text
## ACTION REQUIRED — RESTART COPILOT CLI

Configuration is written, but this process cannot load the new MCP server.
Exit it and run: <exact command with config path and applicable resume option>

1. `Restarted` — in the resumed session, I will verify four tools and call get_capabilities.
2. `Pause setup.` — retain progress without further actions.
These authorize activation checks only, not Azure writes or paid inference.
No activation verification in the new process has occurred.
```

Use the actual host's command and name, not Copilot wording for another host.
A `Restarted` reply alone is not proof of discovery.

### Optional paid image

```text
## ACTION REQUIRED — OPTIONAL BILLABLE IMAGE

Setup and nonbillable diagnostics succeeded; inference is still unverified.
I need separate approval because this request may incur Azure charges.
- Brief: <exact brief>
- Size/quality/count: 1536x864, high, one PNG
- Endpoint/deployment: <exact configured values>
- Maximum submissions: one; no automatic retries

1. `Approve one image exactly as described.` — I will retain a new operation
   UUID and submit once; uncertain results use get_operation, not resubmission.
   This does not authorize resource changes, edits or additional images.
2. `Finish without generating an image.` — I will finish setup with inference
   unverified and no paid test.

No image has been requested for this test.
```

### Blocker or failed check

```text
## ACTION REQUIRED — INSTALLATION BLOCKED

<Exact sanitized failure and why no approved distribution route is usable>.
1. `Retry the installation check.` — I will retry only the identified check.
   This does not authorize Azure writes, new package sources or paid images.
2. `Pause setup.` — I will save the checkpoint and stop without new actions.
3. `Cancel setup.` — I will stop; existing resources/configuration are not deleted.

No additional installation attempt has occurred since this failure.
```

Adapt the blocker and retry scope to the actual failure. Never label a
provisioning replay as a read-only check. Each pause must store the exact
displayed decision in the private checkpoint so the next reply can resume it
without repeating the original setup prompt or losing its authorization limits.

## 1. Select configuration, not a resource-management workflow

```sh
export AZURE_OPENAI_ENDPOINT="https://YOUR-ACCOUNT.openai.azure.com/"
export AZURE_OPENAI_IMAGE_DEPLOYMENT="YOUR-DEPLOYMENT-ALIAS"
export IMAGE_GEN_OUTPUT_DIR="$PWD/.local/artifacts"
export IMAGE_GEN_PREVIEW="true"
```

These are placeholders, not live credentials. Use the inference resource root,
not `/api/projects/...`, `/openai/...` or a complete deployment route. The host
must be `<name>.openai.azure.com`: for an `AIServices` account, read it from
`properties.endpoints."OpenAI Language Model Instance API"`, because
`properties.endpoint` is the `cognitiveservices.azure.com` host and fails
validation.
Additional local edit paths require `IMAGE_GEN_INPUT_DIRS`, a JSON array of
explicit approved absolute directories. Artifact IDs need no extra input root.

Choose **one** authentication mode:

**Authorized Azure CLI identity:** set `IMAGE_GEN_AUTH=azure-cli`, unset
`AZURE_OPENAI_API_KEY`, run `az login` for the intended tenant, and optionally
set `AZURE_TENANT_ID` to that tenant UUID. The owner/administrator must grant
appropriate resource-scoped inference permission. The test principal's earlier
401 was followed by successful generation/editing after an administrator grant;
see [the authorization record and remaining limits](evidence/authentication.md).
These commands alone are not proof of authorization.
An administrator can supply a narrower data-only custom role for the tested
contract: see [the exact permission and live proof](evidence/data-only-authentication.md).
The normal MCP requires no management discovery or application creation.

**Explicit API key:** obtain an authorized inference key from the resource owner
through an approved secret channel. No Azure CLI or management discovery is
required by the runtime. In **Bash** (the `read` flags differ in other shells):

```bash
export IMAGE_GEN_AUTH="api-key"
unset AZURE_TENANT_ID
read -r -s -p "Azure OpenAI API key: " AZURE_OPENAI_API_KEY
printf '\n'
export AZURE_OPENAI_API_KEY
```

Do not paste the key into a command, chat or committed JSON file.

## 2. Create a private, session-local CLI configuration

For CLI mode from a source checkout:

```sh
node scripts/configure-client.mjs --output "$HOME/.config/image-gen-mcp/copilot.mcp.json"
```

For the registry installation prefix used in the README, use the included helper:

```sh
node "$HOME/.local/share/image-gen-mcp/node_modules/@juanmicrosoft/image-gen-mcp/scripts/configure-client.mjs" \
  --output "$HOME/.config/image-gen-mcp/copilot.mcp.json"
```

For API-key mode, the helper requires an explicit plaintext-storage acknowledgment:

```sh
node scripts/configure-client.mjs --output "$HOME/.config/image-gen-mcp/copilot.mcp.json" \
  --allow-plaintext-key
unset AZURE_OPENAI_API_KEY
```

For registry installs, substitute the installed helper path above and retain
the same `--allow-plaintext-key` acknowledgment.
For GitHub bundles, use the included `configure-client` launcher instead of
`node scripts/configure-client.mjs`; it uses the bundled Node and app paths.

The helper writes only selected runtime settings, uses an exclusive 0600 file
and never overwrites existing client configuration or registers globally. The
file contains the key in plaintext in key mode: choose a private, untracked
directory **outside the agent's workspace**, protect it, and remove/rotate it
according to your local secret policy. File permissions and `.gitignore` do not
isolate secrets from an agent/tool running as the same OS user; retain the host's
path/tool approval boundaries. It does not copy GitHub
tokens or unrelated environment variables. A different secret-manager launcher
is possible, but is not claimed as tested here.

If you deliberately use a separate Azure CLI profile, explicitly add its
absolute path as `AZURE_CONFIG_DIR` in the server's private `env` configuration.
The helper does not copy that unrelated environment variable. The isolated
data-only proof used this setting and certificate-based `az login
--service-principal --allow-no-subscriptions`; it is not a prerequisite for the
normal signed-in user workflow. Keep certificate/private-key and CLI-cache
files private; do not put them in committed configuration.

```sh
copilot --additional-mcp-config "@$HOME/.config/image-gen-mcp/copilot.mcp.json"
```

This session-local route avoids modifying the user's existing MCP configuration.
For persistent registration (the default for the prompt-driven setup in
[agent-setup.md](agent-setup.md)), use `/mcp add` or merge settings rather
than replacing an existing user file. Restart the MCP server/client after
changing environment settings. See separate
[CLI and VS Code examples](clients.md). VS Code uses different JSON; its tested
local configuration is recorded separately. Shell exports may not reach
GUI-launched clients. Use the VS Code example's `IMAGE_GEN_PREVIEW=false`
setting for the recorded native client; ask its local image reader to inspect
returned PNG paths rather than relying on inline-preview transport.

## 3. Diagnose before a deliberately billable call

Ask Copilot to call `get_capabilities` first. Valid configuration and credential
acquisition are not inference permission. Management/deployed-model/inference
checks deliberately remain unverified rather than requiring broad discovery
permissions. Only a real image request can establish inference.

For a generation, retain a fresh UUID as `operation_id` and provide a
self-contained `prompt`. Only `1536x864` / `high` / one PNG is enabled.
For editing, provide a new operation UUID and exactly one returned
`source_artifact_id` or approved absolute `source_path`; describe the edit
explicitly. Inspect the image and use the full-resolution returned PNG path in
presentation tools. `IMAGE_GEN_PREVIEW=false` suppresses inline thumbnails.

Every new image request can be billable. Do not retry after timeout with a new
ID; call `get_operation` first. For a deliberately bounded developer smoke test,
follow [generation](generation.md) and [live-testing](live-testing.md) with
explicit opt-in and a durable unchanged ledger. Normal runtime use does not
implicitly create that developer budget or any Azure resources.

For a new resource instead of an existing deployment, follow the separate
[Bicep provisioning/cleanup guide](azure-setup.md). Provisioning/key retrieval
privileges are not runtime prerequisites when the owner supplies configuration.

See the [dated onboarding evidence](evidence/onboarding.md) for what was actually
executed and the warm-cache limitation. The [later qualification run](evidence/client-qualification.md)
proved installed generation/editing without changing the earlier unknown outcome.
