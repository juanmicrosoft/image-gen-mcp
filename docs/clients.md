# Copilot clients and filesystem boundaries

Build the checkout first; npm publication is not yet established. Copy and
replace every uppercase placeholder in the appropriate example:

- [Copilot CLI](../examples/copilot-cli.mcp.json): user `~/.copilot/mcp-config.json`,
  or session-local `--additional-mcp-config @/absolute/config.json`. `/mcp add`
  is also available. The CLI uses top-level `mcpServers`.
- [VS Code](../examples/vscode.mcp.json): workspace `.vscode/mcp.json`, using
  top-level `servers`. This configuration is **unverified in this environment**,
  not a claim that the full workflow or deadline works there.

See the [dated actual CLI evidence](evidence/copilot-cli.md) for the tested
version, full generation/edit/inspection workflow, preview-off behavior and
measured deadline/cancellation results. Other versions remain unverified.

The examples select CLI credentials explicitly. Successful inference with the
current principal remains blocked in #11; do not confuse valid configuration
with authorization. For explicit API-key mode, follow [configuration](configuration.md)
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
