<p align="center">
  <img src="assets/image-gen-mcp.png" alt="image-gen-mcp project icon" width="160" height="160">
</p>

# image-gen-mcp

A local Model Context Protocol (MCP) server for generating and editing images
through your own Azure Foundry deployment, with GitHub Copilot and editable
presentation workflows.

**Status: `@juanmicrosoft/image-gen-mcp@0.1.0` is published.** Anonymous archive
integrity, fresh registry installation and MCP discovery are
[verified](docs/release.md). The implemented
tools have [real Azure evidence](docs/evidence/azure-contract.md),
[actual Copilot CLI evidence](docs/evidence/copilot-cli.md) and a
[rendered presentation example](docs/evidence/presentation.md).
Verified paths include local macOS / Node 22.22.2 / Copilot CLI 1.0.79 and
the CLI-backed VS Code 1.139.0 session with CLI-token generation/editing from
an installed tarball. Native Local Copilot Chat has a demonstrated preview-off
recovery/edit workflow; inline previews encountered a host image-transport
failure. Do not equate the two session backends.
See the [qualification matrix and boundaries](docs/evidence/client-qualification.md).
A separate [data-only Azure principal](docs/evidence/data-only-authentication.md)
also generated and edited while an authenticated management read was denied.
Live expired-session behavior remains unverified; ambiguous diagnostics do not
claim a unique cause. Publishing-token revocation remains an
[open cleanup gate](https://github.com/juanmicrosoft/image-gen-mcp/issues/73).

The configured model profile is `gpt-image-2.5-sunburst`. V1 deliberately enables
only the live-verified **1536x864, high-quality PNG** combination: one image,
one concurrent submission, no automatic retries, prompt rewrites or model
fallback. No exact ChatGPT backend or output parity is claimed.

| Tool | Purpose |
| --- | --- |
| `get_capabilities` | Nonbillable diagnostics; keeps configured, observed and unverified facts separate |
| `generate_image` | One new immutable image, identified by a caller-retained operation UUID |
| `edit_image` | One explicit artifact or approved local PNG reference; immutable parent/child lineage |
| `get_operation` | Recover a saved result after interruption without submitting again |

## Get started

**Let your coding agent do the setup.** Use Copilot CLI, VS Code Copilot in a
local agent session, or Claude Code on the machine where the MCP will run.
Send the single prompt below as your message. No Azure portal configuration is needed:
the agent uses Azure CLI and this repository's provisioning script.
You still complete interactive sign-in and approve subscription, resource costs
and permissions. A subscription with model access/quota is required; an agent
cannot bypass an administrator or capacity restriction.

Here, **Claude means Claude Code**, not Claude web or Claude Desktop. The
Copilot workflows have [live qualification](docs/evidence/client-qualification.md);
Claude Code setup is based on its documented stdio interface, **not a live-tested
image workflow**. These instructions are for local agents, not a hosted coding
agent that cannot access your local Azure login or files.

### Ask your agent: set this up for me

Send this as your own message. Some hosts treat a bare paste as quoted content
rather than your instruction and will ask you to confirm before acting. The
detailed procedure lives in [docs/agent-setup.md](docs/agent-setup.md), so the
prompt stays short and changes with the code.

```text
Set up the image-gen MCP server from https://github.com/juanmicrosoft/image-gen-mcp
on this machine, end to end: provision (or reuse) an Azure image deployment with
Azure CLI, install the server, and register it globally (user scope) in this
coding agent.

Clone the repository to a private persistent directory and follow
docs/agent-setup.md, which links the other guides you need.

Ground rules:
- Read-only checks (tool versions, az account show, providers, quota, pricing,
  RBAC) need no Azure write approval (host tool approval still applies).
  Never ask me to paste credentials; let me run sign-in.
- Before creating any Azure resource, registering a provider or assigning a
  role, show me one plan (tenant/subscription, region, model, resource names,
  estimated cost, role and scope) and wait for my explicit approval of it.
- Use Azure CLI auth (no API keys) and, for a new deployment, the
  repository's scripts/azure.mjs.
- Install one pinned version (no @latest in the launcher) and add the server
  without overwriting other MCP servers; stop on a name conflict.
- If I need to sign in, choose, approve or restart, stop and tell me exactly
  what to do.
- Do not generate images during setup. At the end, offer one test image and
  wait for my yes.
- Finish with the installed version, configuration locations and anything
  unverified.
```

### What to expect

The agent will pause for your replies, not for another setup prompt. A short
new/reuse choice confirms the displayed scope for read-only work; a separate
precise approval authorizes the final write plan. If npm is unreachable, an approved compatible
[GitHub Releases bundle](docs/github-release-install.md) is the fallback.
If neither route works, the default is to wait, but you may explicitly approve provisioning despite the
blocked runtime installation and possible resource costs.

A private checkpoint carries progress across replies and client restarts.
Hosts may enforce forms or end each task automatically; a prompt cannot change
those runtime policies. The agent must label the workflow incomplete and provide
a supported continuation path, not treat a missing reply as approval.
The [resume guide](docs/setup.md#resuming-a-paused-setup) explains the checkpoint.
The agent can
use `az login --use-device-code` when normal interactive login is unavailable.
Sign-in may open a browser; that is authentication, not portal resource setup.
Provisioning uses the [ownership-safe source script](docs/azure-setup.md), not
the npm runtime package. The [client guide](docs/clients.md) provides commands.

The prompt selects the latest release once and installs that exact version;
starting the MCP does not trigger automatic upgrades. The manual example below
remains pinned to verified `0.1.0`; its evidence does not certify future versions.
There is no MCP OAuth login: the local server uses your authorized Azure CLI
identity. Configuration and diagnostics do not prove inference permission.
Declining the optional paid test does not prevent completing client setup.

To remove a **new, task-owned** deployment later, ask the agent to read the saved
state, show the exact resource group and deletion impact, obtain your explicit
approval, then run the documented ownership-checked cleanup command. Do not
apply that cleanup to a reused deployment.

### Manual installation alternative

For an existing compatible deployment:

Install the pinned release in a persistent directory:

```sh
npm install --prefix "$HOME/.local/share/image-gen-mcp" \
  --registry=https://registry.npmjs.org/ --ignore-scripts --no-audit --no-fund \
  @juanmicrosoft/image-gen-mcp@0.1.0
```

Or build from source:

```sh
git clone https://github.com/juanmicrosoft/image-gen-mcp.git
cd image-gen-mcp
npm ci
npm run build
```

Then follow [existing-deployment setup](docs/setup.md) to select credentials,
set the inference endpoint/deployment/output directory, and create a private
client configuration. Pin the package version and never paste a key into
shell history. The server is a stdio protocol process, not an interactive
image-generation command.

Starting from scratch? Use the separate [owner-tagged Bicep/Azure CLI setup](docs/azure-setup.md).
The normal MCP never creates resources or retrieves management keys.
The [authorization record](docs/evidence/authentication.md) explains the required
resource-scoped grant and remaining limits; a token or management access alone
is not inference permission.

Ask Copilot to generate a hero with negative space, inspect it, then explicitly
edit that artifact using a new operation UUID. Results include the immutable
full-resolution path, dimensions, hash, lineage, available usage and an optional
bounded image preview. Image requests are billable; diagnostics are not.

## Presentations, safety and evidence

The [PptxGenJS example](examples/presentation/README.md) consumes full-resolution
artifacts into three editable slides. Its dependencies stay outside the runtime.
Reference continuity is probabilistic; generated art does not replace editable text.

Read [configuration](docs/configuration.md), [client setup/limits](docs/clients.md),
[generation](docs/generation.md), [editing](docs/editing.md),
[privacy/cost/recovery](docs/operations.md) and [bounded live evaluation](docs/evaluation.md).
Previews can be disabled. Cancellation does not prove that a request stopped or
was free; retain the operation ID and inspect it before explicitly submitting again.

For contributors, `npm test` is offline and requires no Azure credentials.
See [testing](docs/testing.md), [CONTRIBUTING.md](CONTRIBUTING.md) and
[AGENTS.md](AGENTS.md) for the individual-PR, independent-review and evidence rules.
The [changelog](CHANGELOG.md) and [release evidence/gates](docs/release.md)
separate registry verification from bounded live-client evidence and remaining cleanup.

The software and documentation are [MIT licensed](LICENSE). See
[SECURITY.md](SECURITY.md). This license
does not replace Azure/OpenAI service terms or guarantee rights in generated
images or third-party source assets.
