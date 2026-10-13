# Experimental native GitHub Copilot backend

This backend is implemented and tested with offline SDK fixtures. It has not made a paid native Copilot image request, so stock Copilot CLI and Agency-launched Copilot CLI remain unqualified. Azure is still the default, backwards-compatible backend and retains its existing evidence.

## Configuration

Required:

```text
IMAGE_GEN_BACKEND=copilot
IMAGE_GEN_COPILOT_LOGIN=YOUR-GITHUB-LOGIN
IMAGE_GEN_OUTPUT_DIR=/ABSOLUTE/PRIVATE/OUTPUT/DIRECTORY
```

Optional:

```text
IMAGE_GEN_COPILOT_CLI_PATH=/ABSOLUTE/PATH/TO/COPILOT
IMAGE_GEN_INPUT_DIRS=["/ABSOLUTE/APPROVED/INPUT/DIRECTORY"]
IMAGE_GEN_PREVIEW=false
```

Omit `IMAGE_GEN_COPILOT_CLI_PATH` to use the runtime bundled/resolved by the pinned `@github/copilot-sdk`. Do not point at an SDK cache path. Copilot mode does not accept an Azure API key or another `IMAGE_GEN_AUTH` selection and never falls back to Azure.

Use [the native example](../examples/copilot-native.mcp.json) as a private session configuration. For stock Copilot CLI, pass it with `--additional-mcp-config` while qualifying the backend. A deliberate user-wide merge into `~/.copilot/mcp-config.json` is also possible, but exposes the billable tools to every CLI session.

For Agency-launched Copilot CLI, pass the same entry to the Copilot child's session-scoped MCP configuration. Do not register it as a global/crew MCP. Exact Agency argument propagation is a live qualification item, not an offline claim.

## Authentication and routing boundary

The MCP parent account is not automatically inherited as an authorization guarantee. The backend starts an isolated official SDK client with logged-in-user authentication, then:

1. checks that the runtime reports exactly `IMAGE_GEN_COPILOT_LOGIN`;
2. creates a session offering only the native `image_generation` tool;
3. initializes and invokes that tool directly, without a chat/model turn;
4. checks the account again immediately before forwarding the image POST;
5. permits metadata GET `/models` and exactly one matching generation or edit POST only on the exact first-party plan API origins `https://api.githubcopilot.com`, `https://api.individual.githubcopilot.com`, `https://api.business.githubcopilot.com` and `https://api.enterprise.githubcopilot.com`;
6. blocks websocket inference, chat endpoints, redirects, retries, a second POST and generation/edit route substitution.

The server never extracts or forwards credentials, signs in, changes accounts, or tries another model/backend. A mismatch or refreshed stale identity refuses submission.

## Request and artifact behavior

Copilot discovery offers `auto`, `1024x1024`, `1536x1024` and `1024x1536` sizes, plus `auto`, `low`, `medium` and `high` quality. Explicit values are sent unchanged; `auto` values are omitted from native arguments. Successful output must be one bounded strict PNG with observed dimensions, reported quality and PNG output format. A missing or inconsistent option is a provider-output failure, not a guessed value.

Editing writes the one approved source PNG into a private temporary directory under `IMAGE_GEN_OUTPUT_DIR`, passes only that path, and removes it during cleanup. Saved artifacts preserve immutable source hash/artifact lineage. Copilot manifests record backend/account and actual dimensions. Model is recorded only when all reported Copilot token details consistently name one model; otherwise it is `unknown` with unverified evidence. Missing usage stays unknown. Reported `copilot_usage.total_nano_aiu` is stored as `usage.ai_credits = total_nano_aiu / 1e9`; it is service-reported usage, not an invoice deduction.

Operation fingerprints include backend and expected account. Reusing an operation UUID with Azure, another expected login or changed arguments is a conflict. A committed artifact is replayed without another request. An interrupted/unknown outcome is retained and never automatically resubmitted.

## Diagnostics and remaining unknowns

`get_capabilities` is nonbillable. With `check_credentials:true`, it may start the Copilot runtime and confirm the expected login, but always leaves inference unverified.

Offline tests cover account absence/mismatch/refresh, portable and explicit runtime selection, native-tool absence, exact arguments, generation/edit routing across the exact documented plan API origins, rejection of arbitrary Copilot subdomains, no chat turn, one-POST enforcement, websocket/route blocking, cancellation, bounded/malformed output, policy/error redaction, usage/model uncertainty, cleanup failures, lineage, fingerprint conflicts and durable unknown-outcome recovery.

A metadata-only live preflight with the pinned SDK default runtime observed `GET https://api.enterprise.githubcopilot.com/models` succeed with zero image POSTs. GitHub's first-party [Copilot allowlist reference](https://docs.github.com/en/copilot/reference/copilot-allowlist-reference) documents separate individual, business and enterprise plan-routing domains. This establishes routing compatibility only, not image inference support.

Still live-unverified:

- stock and Agency image-tool execution after launcher propagation;
- native image permission and policy behavior for the intended account;
- actual generation/edit response fields and editing input semantics;
- service-selected values for `auto`;
- model and `total_nano_aiu` presence/meaning;
- cancellation timing after provider acceptance;
- billing and output parity with any other Copilot surface.

Do not claim live support from configuration, account diagnostics or offline fixtures. Paid qualification must use fresh operation UUIDs, an explicit request budget and separate approval.
