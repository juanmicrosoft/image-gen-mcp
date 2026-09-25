# Existing-deployment onboarding

Use Node 22.22.2 or the separately recorded tested matrix, a local filesystem,
and a compatible Azure OpenAI inference deployment. The verified model profile
is `gpt-image-2.5-sunburst`; an arbitrary deployment **alias** does not prove its
model. Obtain the correct model/version and endpoint from the resource owner.
Do not create a Foundry project just to obtain an inference resource URL.

Build the source checkout using the README commands. No Azure credentials are
needed to install/build or run offline tests. Registry installation is not yet
verified; use the source route or a separately validated local tarball rather
than assuming the package/version is available.

## 1. Select configuration, not a resource-management workflow

```sh
export AZURE_OPENAI_ENDPOINT="https://YOUR-ACCOUNT.openai.azure.com/"
export AZURE_OPENAI_IMAGE_DEPLOYMENT="YOUR-DEPLOYMENT-ALIAS"
export IMAGE_GEN_OUTPUT_DIR="$PWD/.local/artifacts"
export IMAGE_GEN_PREVIEW="true"
```

These are placeholders, not live credentials. Use the inference resource root,
not `/api/projects/...`, `/openai/...` or a complete deployment route.
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

For CLI mode:

```sh
node scripts/configure-client.mjs --output "$HOME/.config/image-gen-mcp/copilot.mcp.json"
```

For API-key mode, the helper requires an explicit plaintext-storage acknowledgment:

```sh
node scripts/configure-client.mjs --output "$HOME/.config/image-gen-mcp/copilot.mcp.json" \
  --allow-plaintext-key
unset AZURE_OPENAI_API_KEY
```

The helper writes only selected runtime settings, uses an exclusive 0600 file
and never overwrites existing client configuration or registers globally. The
file contains the key in plaintext in key mode: choose a private, untracked
directory **outside the agent's workspace**, protect it, and remove/rotate it
according to your local secret policy. File permissions and `.gitignore` do not
isolate secrets from an agent/tool running as the same OS user; retain the host's
path/tool approval boundaries. It does not copy GitHub
tokens or unrelated environment variables. A different secret-manager launcher
is possible, but is not claimed as tested here.

```sh
copilot --additional-mcp-config "@$HOME/.config/image-gen-mcp/copilot.mcp.json"
```

This session-local route avoids modifying the user's existing MCP configuration.
For persistent registration, use `/mcp add` deliberately; merge settings rather
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
