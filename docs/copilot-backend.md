# Source-candidate native GitHub Copilot backend

This backend exists only in the current source candidate; it is not contained in the already-published `0.1.0` package. It is tested with offline SDK fixtures and blocked from paid qualification pending fresh review. It has not made a native Copilot image request, so stock Copilot CLI and Agency-launched Copilot CLI remain unqualified. Azure is still the default, backwards-compatible backend and retains its existing evidence.

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

The MCP parent account is not automatically inherited as an authorization guarantee. The backend starts one private official SDK stdio client, creates one session, performs only the supported session credential pin described below, and then exposes no account-switching or external mutation surface:

1. requires the runtime's current global status to identify `IMAGE_GEN_COPILOT_LOGIN` as a local OAuth `user`, rejecting `gh-cli`, environment-token and other modes because this integration will not read their tokens;
2. creates a session offering only the native `image_generation` tool;
3. reads the session's credential-free active-account metadata and passes only `{type:"user", host, login, copilotUser}` to `session.rpc.gitHubAuth.setCredentials`; the official `UserAuthInfo` contract keeps the bearer token in the runtime secret store, and the pin must report both `success:true` and `copilotUserResolved:true`;
4. verifies the pinned session's `session.rpc.gitHubAuth.getStatus()` host/login/auth type after the pin and again inside the HTTP bridge immediately before forwarding the image POST;
5. initializes and invokes the native tool directly, without a chat/model turn, with an explicit invocation gate open only around the owned `session.rpc.tools.execute` call; a different request-context session ID is rejected when the runtime supplies one;
6. permits metadata GET `/models` and exactly one matching generation or edit POST only on the exact first-party plan API origins `https://api.githubcopilot.com`, `https://api.individual.githubcopilot.com`, `https://api.business.githubcopilot.com` and `https://api.enterprise.githubcopilot.com`;
7. blocks URL credentials, query strings, fragments, websocket inference, chat endpoints, redirects, retries, a second POST and generation/edit route substitution.

Runtime 1.0.96 omits `context.sessionId` on the direct native image POST, so the candidate does not fabricate one or claim request-context identity proof. Instead it relies on the official secret-free `UserAuthInfo` session pin, repeated session-scoped status verification, the private one-client/one-session transport and the explicit native-invocation gate; a supplied foreign session ID is rejected. The SDK HTTP bridge necessarily carries runtime-authorized headers. This integration does not manually read, export or replace bearer tokens, sign in, switch global accounts, or try another model/backend. A pin failure, unresolved Copilot metadata or session-status mismatch refuses submission. This repair requires fresh independent review before any paid request.

Native permission handling uses only modern decision variants. It returns `approve-once` for the one `image_generation` custom-tool request and for each read callback whose `path` exactly equals the canonical staged reference while the owned invocation gate is active and `managedApprovalRequired` is false. Runtime 1.0.96 reads that same staged reference twice, so each exact read receives its own one-request approval; this is not a session-wide or directory approval. Foreign paths, foreign sessions, managed approvals, duplicate custom-tool requests, reads outside the active invocation and every other permission request receive `reject`.

## Request and artifact behavior

Copilot discovery offers `auto`, `1024x1024`, `1536x1024` and `1024x1536` sizes, plus `auto`, `low`, `medium` and `high` quality. Explicit values are sent unchanged; `auto` values are omitted from native arguments. Successful output must be one bounded strict PNG with observed dimensions, reported quality and PNG output format. A missing or inconsistent option is a provider-output failure, not a guessed value.

Editing writes the one approved source PNG into a private temporary directory under `IMAGE_GEN_OUTPUT_DIR`, passes only that path, and removes it during cleanup. Saved artifacts preserve immutable source hash/artifact lineage. Copilot manifests record backend/account, `authSource:"user"`, the observed session `copilotPlan` when present, and actual dimensions; they do not store the full Copilot-user payload, email, token or provider quota. Model is recorded only when all reported Copilot token details consistently name one model; otherwise it is `unknown` with unverified evidence. Missing usage stays unknown. Reported `copilot_usage.total_nano_aiu` is stored as `usage.ai_credits = total_nano_aiu / 1e9`; it is service-reported usage, not an invoice deduction.

Operation fingerprints include backend and expected account. Reusing an operation UUID with Azure, another expected login or changed arguments is a conflict. A committed artifact is replayed without another request. An interrupted/unknown outcome is retained and never automatically resubmitted.

## Diagnostics and remaining unknowns

`get_capabilities` is nonbillable. With `check_credentials:true`, it creates a tool-free private session, performs the same secret-free OAuth-user pin, and reports only expected login, `authSource` and observed `copilotPlan`; it always leaves inference unverified.

Offline tests cover global-account/session-account divergence, session-status mismatch/refresh, foreign and runtime-omitted request session IDs, the owned invocation gate, portable and explicit runtime selection, native-tool absence, exact arguments, generation/edit routing across the exact documented plan API origins, rejection of arbitrary Copilot subdomains, URL credentials/query/fragment denial, no chat turn, one-POST enforcement, websocket/route blocking, bounded response parsing/PNG validation/cleanup, cancellation, malformed output, policy/error redaction, usage/model uncertainty, cleanup failures, lineage, fingerprint conflicts and durable unknown-outcome recovery.

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
