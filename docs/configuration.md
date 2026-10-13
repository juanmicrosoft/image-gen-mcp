# Explicit runtime configuration

The server accepts environment configuration only; generation arguments cannot
override endpoint, credentials, model profile or allowed roots. There is no
implicit `.env` loading or hidden configuration-file precedence.

| Variable | Meaning |
| --- | --- |
| `IMAGE_GEN_BACKEND` | `azure` (default) or explicit experimental `copilot`; no automatic fallback. |
| `AZURE_OPENAI_ENDPOINT` | Required HTTPS `https://<resource>.openai.azure.com/` root; not a Foundry project endpoint. |
| `AZURE_OPENAI_IMAGE_DEPLOYMENT` | Required deployment alias. An alias is not proof of its model. |
| `AZURE_OPENAI_IMAGE_MODEL` | Optional explicit `gpt-image-2.5-sunburst` configured profile; other models rejected. |
| `IMAGE_GEN_OUTPUT_DIR` | Required absolute private local output directory. |
| `IMAGE_GEN_INPUT_DIRS` | Optional JSON array of additional approved absolute input directories, default `[]`. Artifact-root images are available separately by artifact ID. |
| `IMAGE_GEN_AUTH` | `azure-cli` (default) or explicit `api-key`; never an automatic chain. |
| `AZURE_TENANT_ID` | Optional tenant UUID for CLI authentication. |
| `AZURE_OPENAI_API_KEY` | Required only for API-key mode; conflicting CLI/key settings fail. |
| `IMAGE_GEN_PREVIEW` | `true` (default) or `false`; controls bounded inline image previews. Empty values are invalid. |
| `IMAGE_GEN_COPILOT_LOGIN` | Required only for Copilot mode. Exact expected signed-in GitHub login; mismatches refuse image submission. |
| `IMAGE_GEN_COPILOT_CLI_PATH` | Optional absolute Copilot runtime executable path. When omitted, the pinned official SDK resolves its bundled portable runtime. |

Azure CLI auth uses `AzureCliCredential` with audience
`https://cognitiveservices.azure.com/.default`. Run `az login` for the intended
tenant/subscription. Obtaining a token does not establish inference permission;
an earlier identity check returned HTTP 401 PermissionDenied (#11), followed by
[successful CLI-token generation/editing after an authorized grant](evidence/client-qualification.md).
API-key inference is verified separately. No fallback from CLI to a key occurs.
API-key mode requires explicitly removing CLI-only tenant configuration.

The configuration object contains a header-provider closure, not a serializable
key/token field. Never log headers or original credential exceptions. No runtime
tool should retrieve Azure management-plane keys or provision resources.
Managed identity, sovereign/custom endpoint domains and remote filesystems are
not advertised by this version.

## Experimental native Copilot mode

Copilot mode requires `IMAGE_GEN_BACKEND=copilot`,
`IMAGE_GEN_COPILOT_LOGIN` and the same private `IMAGE_GEN_OUTPUT_DIR`.
`IMAGE_GEN_INPUT_DIRS` and `IMAGE_GEN_PREVIEW` retain their storage meanings.
Azure endpoint, deployment, tenant and API-key settings do not select or
authorize this route; conflicting Azure key/auth settings are rejected.

The MCP launches an isolated official SDK client. It checks the current Copilot
login before creating the native-tool session and again immediately before the
single permitted image POST. It never extracts or forwards a token, changes the
signed-in account, borrows the parent MCP host's credentials, or falls back to
Azure. The optional CLI path must be absolute; omitting it uses the SDK's
bundled runtime rather than a machine-specific cache path.

`get_capabilities({check_credentials:true})` may start the runtime and verify
the expected account without generating an image. That result remains
nonbillable diagnostics: model, image permission, routing, response format and
billing are still unverified. See [Copilot backend](copilot-backend.md).

GUI-launched VS Code may not inherit shell variables or the shell's Azure CLI
PATH; configure the server's environment explicitly rather than assuming a shell
export reached the editor. See the separate [client examples and evidence](clients.md);
the recorded VS Code workflow is qualified only for its tested local configuration.

Tests validate explicit selection and safe errors with injected credentials,
not live permission grants. Separate [data-only inference evidence](evidence/data-only-authentication.md)
proves a scoped certificate-authenticated principal through Azure CLI; managed
identity and live expired-session behavior are not advertised.
