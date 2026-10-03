# Copilot, Claude Code and filesystem boundaries

Start with the [single setup prompt](../README.md#get-started), sent as your message. Install the
pinned published runtime as in the README, or build a source checkout. For
registry installs, use the absolute entrypoint
`/YOUR/PREFIX/node_modules/@juanmicrosoft/image-gen-mcp/dist/cli.js` in place of
the source-checkout path in these examples. Replace every uppercase placeholder:

If npm fails and policy permits GitHub distribution, follow the
[verified bundle route](github-release-install.md). Set `command` to the
absolute bundle `image-gen-mcp` launcher and `args` to `[]`, retaining the same
client-specific environment. Use its `configure-client` launcher for the
Copilot helper; do not run a system Node or npm install inside the bundle.
For Claude Code, replace the command after `--` with the bundle launcher alone.

- [Copilot CLI](../examples/copilot-cli.mcp.json): user `~/.copilot/mcp-config.json`,
  or session-local `--additional-mcp-config @/absolute/config.json`. `/mcp add`
  is also available. The CLI uses top-level `mcpServers`.
- [VS Code](../examples/vscode.mcp.json): workspace `.vscode/mcp.json`, using
  top-level `servers`. Prefer **MCP: Open User Configuration** from the Command
  Palette for personal Azure/path settings and merge only the `image-gen` entry;
  keep workspace examples as placeholders, not committed personal configuration.
  Local VS Code 1.139.0 with built-in Copilot Chat 0.67.0
  has [backend-specific qualification evidence](evidence/client-qualification.md).
  The initial complete image run used the CLI-backed session, not native Local
  Copilot Chat. Native generation succeeded, but after inline preview approval
  a subsequent host model request failed with an upstream file-download 404.
  The example therefore sets `IMAGE_GEN_PREVIEW=false`: native recovery,
  explicit-source editing and full-resolution `view_image` access succeeded
  with previews disabled. The failed session used GPT-5.6 Sol; recovery used
  Claude Sonnet 5, so this does not isolate the cause or qualify every host
  model. Do not regenerate to fix a failed host image request.

## Copilot CLI: session-local or user setup

After setting runtime environment variables as in [setup](setup.md), the
published package includes the Copilot-specific helper:

```sh
node "$HOME/.local/share/image-gen-mcp/node_modules/@juanmicrosoft/image-gen-mcp/scripts/configure-client.mjs" \
  --output "$HOME/.config/image-gen-mcp/copilot.mcp.json"
copilot --additional-mcp-config "@$HOME/.config/image-gen-mcp/copilot.mcp.json"
```

This assumes the README installation prefix. The helper refuses to overwrite
an existing file; inspect it rather than deleting it blindly. Use `/mcp` to
inspect the server and ask for `get_capabilities`, not an automatic paid test.
For persistent registration, which is the default for the prompt-driven setup,
use `/mcp add` or merge the entry into the user configuration. Preserve other servers and tool-approval settings.
For the prompt-first CLI-auth path, set `IMAGE_GEN_PREVIEW=false` and unset
`AZURE_OPENAI_API_KEY` before running the helper. Explicitly add an isolated
`AZURE_CONFIG_DIR` to the private server `env` if used; the helper does not copy it.

### Activate in a new process and resume

Generating a session-local file does not inject it into the running agent's
tool inventory. If that host cannot dynamically reload, save an
`awaiting_restart` [setup checkpoint](setup.md#resuming-a-paused-setup), then
give the user a launch command with the actual private config path:

```sh
copilot --resume --additional-mcp-config "@$HOME/.config/image-gen-mcp/copilot.mcp.json"
```

If the entry was merged into the user `~/.copilot/mcp-config.json` instead,
relaunch with `copilot --resume` and no `--additional-mcp-config` flag.

`--resume` offers session selection; use `--resume=SESSION_ID` when the correct
ID is known. Check installed `copilot --help` if options differ. The user should
exit the old CLI and launch this from their terminal; the agent need not start
a nested interactive CLI or claim it inspected that new process.
After resuming, inspect `/mcp` and verify discovery plus `get_capabilities`.
Until then, report **configuration written; activation/discovery pending**.
If history cannot resume, a new conversation can be told to resume from the
absolute checkpoint path without repeating the full setup prompt. Revalidate
saved approval provenance before any new write; never provision again merely
because the session changed.

## Claude Code: stdio registration

This is **Claude Code**, not Claude Desktop/web. The command syntax was checked
against the [official MCP reference](https://code.claude.com/docs/en/mcp) and
installed CLI help; generation/editing in Claude Code has **not** been qualified.
Using a Claude model inside Copilot does not establish Claude Code support.

After choosing the endpoint/deployment/output path in [setup](setup.md), run
this to make the server available in every Claude Code project for your user:

```sh
claude mcp add \
  --scope user \
  --env "AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT" \
  --env "AZURE_OPENAI_IMAGE_DEPLOYMENT=$AZURE_OPENAI_IMAGE_DEPLOYMENT" \
  --env "IMAGE_GEN_OUTPUT_DIR=$IMAGE_GEN_OUTPUT_DIR" \
  --env "IMAGE_GEN_AUTH=azure-cli" \
  --env "IMAGE_GEN_PREVIEW=false" \
  --transport stdio image-gen -- \
  node "$HOME/.local/share/image-gen-mcp/node_modules/@juanmicrosoft/image-gen-mcp/dist/cli.js"
claude mcp get image-gen
```

`--scope user` stores the entry in your private user configuration and makes it
available across projects; it never writes a shared `.mcp.json`. To limit the
server to the current project only, use `--scope local` instead. At user scope
the billable image tools are offered in every project; remove the entry with
`claude mcp remove --scope user image-gen`. Inspect
`claude mcp list` first and stop if `image-gen` already exists. Confirm environment variables are populated before running the command.
Unset `AZURE_OPENAI_API_KEY` in the launch environment when using CLI auth.
If selected, add `--env "AZURE_TENANT_ID=$AZURE_TENANT_ID"` and, for an isolated
login profile, `--env "AZURE_CONFIG_DIR=$AZURE_CONFIG_DIR"` **before**
`--transport stdio`. These values are configuration, not API keys.
Do not put keys/tokens in command arguments. The final `--` separates host options
from the server command. Resolve `node` to an absolute path if the host PATH
differs; Azure CLI must also be reachable by the server.

Exit and restart `claude` (`claude --continue` resumes the last conversation),
inspect `/mcp`, and ask it to discover the four tools and call only
`get_capabilities`. Approve tools deliberately; neither registration nor
diagnostics proves inference access. Do not copy the
Copilot-specific `tools`/`timeout` properties into Claude's configuration.
If a long-running image call is interrupted, retain its UUID and recover with
`get_operation`; never treat a host timeout as permission to resubmit.

## Shared qualification and safety boundaries

See the [dated actual CLI evidence](evidence/copilot-cli.md) for the tested
version, full generation/edit/inspection workflow, preview-off behavior and
measured deadline/cancellation results. The later qualification record covers
installed CLI and VS Code with CLI authentication, distinguishing session
backends and recovery boundaries; other versions remain unverified.

The examples select CLI credentials explicitly. Inference with the tested
principal succeeded after its resource-scoped inference grant. A separate
[data-only principal proof](evidence/data-only-authentication.md) validates
inference without management access, not a new Copilot UI/auth matrix row.
Live expiry and ambiguous root causes remain unverified. Do not confuse valid configuration with
authorization. For explicit API-key mode, follow [configuration](configuration.md)
and store credentials only in a private user configuration/secret mechanism,
never a committed workspace JSON file. Runtime does not retrieve management keys.

CLI `timeout` is milliseconds; the example sets 240000, exceeding the runtime's
180-second network deadline. Actual client behavior is recorded separately,
not inferred from this setting. Cancellation can leave upstream processing and
charges unknown. Retain the operation UUID and call `get_operation` rather than
creating a new request automatically. Progress notifications are not implemented.

Approve billable tools deliberately. MCP tool annotations are hints, not a
substitute for the host's approval policy. Inspect the registered server command
and deployment before approving; a different server can perform different actions.

The client/model may receive the bounded inline JPEG preview; the full-resolution
PNG remains on the server's filesystem. A returned path is neither a user-facing
image viewer nor proof that the model inspected it. With previews off, use a
client image-reading tool against the returned path if that client supports it.
For user viewing, open the immutable PNG in a local image viewer; never resize
the original to make a preview. Presentation tools should consume the original.

Only same-machine local stdio is in scope. WSL, containers, remote VS Code,
SSH and remote MCP filesystems are unverified: their path namespaces may differ.
Do not assume a `file://` resource link automatically renders or transfers bytes.

The developer-only `scripts/client-smoke-server.mjs` is not the product entrypoint.
It explicitly gates live tests, retrieves a management key for the existing
isolated test resource, and charges every actual provider request against a
separate purpose-specific durable ledger. It must not be used to claim
inference-only authentication or shipped as the normal runtime configuration.

Sources: [GitHub CLI MCP setup](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers),
[VS Code MCP configuration](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).
