# Source-candidate native GitHub Copilot backend

This backend exists only in the current source candidate; it is not contained in the already-published `0.1.0` package. Offline fixtures and four correlated live image cases now cover stock directly launched and isolated Agency-launched generation/editing on local macOS. Azure is still the default, backwards-compatible backend and retains its existing evidence. The live evidence qualifies only the exact versions, source revisions, OAuth-user/Enterprise-plan account and session-scoped launcher isolation recorded below; it does not publish the backend or replace final review and upstream release decisions.

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

Omit `IMAGE_GEN_COPILOT_CLI_PATH` to use the runtime bundled/resolved by the pinned `@github/copilot-sdk`. The integration always constructs `RuntimeConnection.forStdio(...)`, including when the path is omitted, so ambient `COPILOT_SDK_DEFAULT_CONNECTION=inprocess` cannot move this security boundary into a shared in-process runtime. Do not point at an SDK cache path. Copilot mode does not accept an Azure API key or another `IMAGE_GEN_AUTH` selection and never falls back to Azure.

Use [the native example](../examples/copilot-native.mcp.json) as a private session configuration. The qualified stock path passed it with `--additional-mcp-config` to a directly launched runtime with exact MCP grants. A deliberate user-wide merge into `~/.copilot/mcp-config.json` is possible but unqualified and exposes the billable tools to every CLI session.

The qualified Agency path used Agency `2026.10.12.4` with `--no-aec --no-default-mcps --no-config-plugins`; its Copilot child used `--no-custom-instructions --disable-builtin-mcps --available-tools mcp:*`, the same session-scoped configuration and exact MCP grants. Do not register it as a global/crew MCP.

## Authentication and routing boundary

The MCP parent account is not automatically inherited as an authorization guarantee. The backend starts one private official SDK stdio client, creates one session, performs only the supported session credential pin described below, and then exposes no account-switching or external mutation surface:

1. requires the runtime's current global status to identify `IMAGE_GEN_COPILOT_LOGIN` as a local OAuth `user`, rejecting `gh-cli`, environment-token and other modes because this integration will not read their tokens;
2. creates a session offering only the native `image_generation` tool;
3. reads the session's credential-free active-account metadata and passes only `{type:"user", host, login, copilotUser}` to `session.rpc.gitHubAuth.setCredentials`; the official `UserAuthInfo` contract keeps the bearer token in the runtime secret store, and the pin must report both `success:true` and `copilotUserResolved:true`;
4. verifies the pinned session's `session.rpc.gitHubAuth.getStatus()` host/login/auth type after the pin and again inside the HTTP bridge immediately before forwarding the image POST;
5. initializes and invokes the native tool directly, without a chat/model turn, with an explicit invocation gate open only around the owned `session.rpc.tools.execute` call; a different request-context session ID is rejected when the runtime supplies one;
6. permits metadata GET `/models` and exactly one matching generation or edit POST only on the exact first-party plan API origins `https://api.githubcopilot.com`, `https://api.individual.githubcopilot.com`, `https://api.business.githubcopilot.com` and `https://api.enterprise.githubcopilot.com`;
7. blocks URL credentials, query strings, fragments, websocket inference, chat endpoints, redirects, retries, a second POST and generation/edit route substitution.

Runtime 1.0.96 omits `context.sessionId` on the direct native image POST, so the candidate does not fabricate one or claim request-context identity proof. Instead it relies on the official secret-free `UserAuthInfo` session pin, repeated session-scoped status verification, the private one-client/one-session transport and the explicit native-invocation gate; a supplied foreign session ID is rejected. The SDK HTTP bridge necessarily carries runtime-authorized headers. This integration does not manually read, export or replace bearer tokens, sign in, switch global accounts, or try another model/backend. A pin failure, unresolved Copilot metadata or session-status mismatch refuses submission.

Native permission handling uses only modern decision variants. It returns `approve-once` for the one `image_generation` custom-tool request and for each read callback whose `path` exactly equals the canonical staged reference while the owned invocation gate is active and `managedApprovalRequired` is either omitted or `false`. Runtime 1.0.96 reads that same staged reference twice, so each exact read receives its own one-request approval; this is not a session-wide or directory approval. Foreign paths, foreign sessions, `managedApprovalRequired:true` or malformed values, duplicate custom-tool requests, reads outside the active invocation and every other permission request receive `reject`.

## Request and artifact behavior

Copilot discovery offers `auto`, `1024x1024`, `1536x1024` and `1024x1536` sizes, plus `auto`, `low`, `medium` and `high` quality. Explicit values are sent unchanged; `auto` values are omitted from native arguments. Successful output must be one bounded strict PNG with observed dimensions, reported quality and PNG output format. A missing or inconsistent option is a provider-output failure, not a guessed value.

Editing writes the one approved source PNG into a private temporary directory under `IMAGE_GEN_OUTPUT_DIR`, passes only that path, and removes it during cleanup. Saved artifacts preserve immutable source hash/artifact lineage. Copilot manifests record backend/account, `authSource:"user"`, the observed session `copilotPlan` when present, and actual dimensions; they do not store the full Copilot-user payload, email, token or provider quota. Model is recorded only when all reported Copilot token details consistently name one model; otherwise it is `unknown` with unverified evidence. Missing usage stays unknown. Reported `copilot_usage.total_nano_aiu` is stored as `usage.ai_credits = total_nano_aiu / 1e9`; it is service-reported usage, not an invoice deduction.

Operation fingerprints include backend and expected account. Reusing an operation UUID with Azure, another expected login or changed arguments is a conflict. A committed artifact is replayed without another request. An interrupted/unknown outcome is retained and never automatically resubmitted.

## Diagnostics and remaining unknowns

`get_capabilities` is nonbillable. With `check_credentials:true`, it creates a tool-free private session, performs the same secret-free OAuth-user pin, and reports only expected login, `authSource` and observed `copilotPlan`; that diagnostic alone leaves inference unverified.

Offline tests cover global-account/session-account divergence, session-status mismatch/refresh, foreign and runtime-omitted request session IDs, the owned invocation gate, portable and explicit runtime selection, native-tool absence, exact arguments, generation/edit routing across the exact documented plan API origins, rejection of arbitrary Copilot subdomains, URL credentials/query/fragment denial, no chat turn, one-POST enforcement, websocket/route blocking, bounded response parsing/PNG validation/cleanup, cancellation, malformed output, policy/error redaction, usage/model uncertainty, cleanup failures, lineage, fingerprint conflicts and durable unknown-outcome recovery.

## Live qualification

The [public qualification record](https://github.com/ourostack/image-gen-mcp/tree/feat/copilot-backend/evaluation/copilot-native) contains the synthetic prompts, versions, mixed candidate revisions, operation/artifact lineage, source hashes and retained outputs for four successful MCP invocations:

| Launcher/action | Result | Service-reported image usage |
| --- | --- | ---: |
| Stock generate | 1312×1199 PNG, observed `gpt-image-2.5-sunburst`, `low` | 0.661 credits |
| Stock edit | 1312×1199 PNG, same scene with watering can changed from silver to blue, `medium` | 2.622 credits |
| Agency generate | 1312×1199 PNG, observed `gpt-image-2.5-sunburst`, `low` | 0.661 credits |
| Agency edit | 1312×1199 PNG, same scene with watering can changed from silver to blue, `medium` | 2.622 credits |

Total service-reported image usage was 6.566 credits. These values are not invoice deductions, and host chat/orchestration usage is separate. The session reported the Enterprise plan through the pinned OAuth-user metadata.

The source boundary is intentionally mixed: stock generation used `1027224ba3dc992dc261fa16738c86a809be37fb`; stock edit and both Agency cases used `49e36bfbb70fd841fb44908c56436f17006bbd2f`. The later revision contains the selected-reference read compatibility fix; generation was unaffected. Raw CLI/MCP sessions and identity details remain private.

The stock runtime was invoked directly with only the session-scoped test MCP. Agency used the isolation flags documented above. No Ouro configuration, persistent/global registration, default MCP set, config plugin, account switch or Azure provisioning participated.

Still live-unverified:

- cancellation timing and usage after provider acceptance;
- invoice impact or monetary cost;
- other operating systems, remote/WSL/container filesystems, clients and launcher configurations;
- other Copilot plans, authentication modes and accounts;
- persistent/global MCP installation or Ouro/default-MCP/config-plugin combinations;
- consistency of service-selected `auto` dimensions, quality, model and usage metadata across future requests;
- output parity with any other Copilot surface.

Do not extrapolate the four successful cases beyond their recorded scope. Configuration, account diagnostics and offline fixtures remain insufficient without correlated live evidence. Final review, upstream maintainer judgment and release/versioning choices remain separate gates.
