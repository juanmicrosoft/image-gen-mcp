# Explicit runtime configuration

The server accepts environment configuration only; generation arguments cannot
override endpoint, credentials, model profile or allowed roots. There is no
implicit `.env` loading or hidden configuration-file precedence.

| Variable | Meaning |
| --- | --- |
| `AZURE_OPENAI_ENDPOINT` | Required HTTPS `https://<resource>.openai.azure.com/` root; not a Foundry project endpoint. |
| `AZURE_OPENAI_IMAGE_DEPLOYMENT` | Required deployment alias. An alias is not proof of its model. |
| `AZURE_OPENAI_IMAGE_MODEL` | Optional explicit `gpt-image-2.5-sunburst` configured profile; other models rejected. |
| `IMAGE_GEN_OUTPUT_DIR` | Required absolute private local output directory. |
| `IMAGE_GEN_INPUT_DIRS` | Optional JSON array of additional approved absolute input directories, default `[]`. Artifact-root images are available separately by artifact ID. |
| `IMAGE_GEN_AUTH` | `azure-cli` (default) or explicit `api-key`; never an automatic chain. |
| `AZURE_TENANT_ID` | Optional tenant UUID for CLI authentication. |
| `AZURE_OPENAI_API_KEY` | Required only for API-key mode; conflicting CLI/key settings fail. |
| `IMAGE_GEN_PREVIEW` | `true` (default) or `false`; controls bounded inline image previews. Empty values are invalid. |

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

GUI-launched VS Code may not inherit shell variables or the shell's Azure CLI
PATH; configure the server's environment explicitly rather than assuming a shell
export reached the editor. See the separate [client examples and evidence](clients.md);
the recorded VS Code workflow is qualified only for its tested local configuration.

Tests validate explicit selection and safe errors with injected credentials,
not live permission grants. Issue #11 retains stricter data-only and negative-case
validation limits; the original resource-scoped grant blocker was resolved.
