# Security policy

## Reporting

Use [GitHub private vulnerability reporting](https://github.com/juanmicrosoft/image-gen-mcp/security/advisories/new).
The repository's private-reporting setting was enabled and verified on 2026-09-24.
Include the affected commit/version, reproduction, expected/observed behavior
and impact. Redact API keys, tokens, private endpoints, tenant/subscription
identifiers, prompts and images containing sensitive data.

If the private form is unavailable, open a minimal public issue asking for a
private reporting channel; do not publish vulnerability details, credentials or
private data there. No response-time SLA or security certification is claimed.

## Supported scope

Development currently targets `main`; release/support commitments will be
published with a verified release. Do not assume untested clients, operating
systems, remote filesystems or hosting arrangements are supported.

Use private local output directories, least-privilege Azure inference access
and explicit resource ownership. Never commit credentials or local Azure state.
Treat input/reference images and provider responses as untrusted data. Changes
to authentication, file access, dependencies and recovery behavior require
targeted regression evidence and the independent review required by AGENTS.md.

Keep dependency versions/lockfiles reviewable. Report dependency findings rather
than disabling checks or silently ignoring them. The MIT license is not a
warranty of fitness or a replacement for deployment-specific security review.
