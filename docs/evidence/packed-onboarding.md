# Clean packed onboarding: observed successes and unresolved edit

Issue #26; 2026-09-24, macOS arm64, Node 22.22.2, npm 10.9.7,
Copilot CLI 1.0.79 with `--no-auto-update`.

The inspected candidate contained 58 allowlisted files; checksum:
`fc6e00ff6847f471c25857949863f2dd0b7ed4080389f8d25ba08629758ef78e`.
This identifies the tested candidate, not a published or final release tarball.
Later documentation additions change package hashes; rerun the verifier for the
actual release artifact.

## Installation and packaging

`npm run verify:package -- --output "$PWD/.local/packages" --offline` built and
installed the actual tarball in a fresh temporary prefix **outside the checkout**.
Only the ordinary installed dependencies were available to that server. The
real npm bin had execute permission, initialized over stdio and exposed all four
tools. All installed relative Markdown links resolved.

The first packaging attempt caught unwanted nested presentation dependencies
from a directory-wide allowlist. Explicit example filenames fixed it; subsequent
inspection contained no nested `node_modules`, private configuration, `.local`,
generated images/decks or credentials. An intentionally stale `dist` probe was
removed by the clean build before packing. Dependency installation used the
existing warm npm cache after registry TLS/`ENOTCONN` errors; cold-network
installation is not established by this run.

## Actual fresh-profile client run

The bundled onboarding helper produced an exclusive 0600 configuration with
explicit API-key mode. The normal **installed** `dist/cli.js` ran behind a
developer request-counting proxy, not a substituted provider implementation.
Copilot had a new profile/workspace, and the server had a separate empty HOME.
An `az` denial sentinel was first in its PATH: it was never invoked. The test
operator supplied the key separately; the runtime needed no management discovery
or key retrieval. The temporary plaintext key configuration was removed afterward.

A separate fixed two-request ledger ended **2/2**:

| Operation | Observed result |
| --- | --- |
| Generate | Succeeded in 55,918 ms; one 1536x864 PNG; usage 30 input / 1078 output / 1108 total |
| Edit that explicit artifact | `outcome_unknown` / timeout; no committed edit artifact; usage/billing unknown |

Saved generation SHA-256:
`52b3af77acf235b28db202e39639c40ae8d4b9deb0b6e8134b6601ab2381e1ee`.
The edit's recorded wall-clock elapsed time was 755,777 ms despite configured
network/client deadlines; the cause is **unverified**. Do not interpret these
best-effort timers as hard wall-clock or billing bounds. The parent client
watchdog ended the session. Both recorded test processes were confirmed stopped.

No retry or new image request was made. A separate actual CLI session, exposing
only `get_operation`, recovered the saved generation and inspected its original
PNG using `view`. It described the observatory/telescope, starfield, mountains
and pines; the unknown edit remained unknown, with no image or invented success.
This used no image credentials, invoked no Azure CLI and left the ledger at 2/2.

## Acceptance boundaries

Installation/discovery, native image decoding/persistence, successful packed
generation, private configuration and local recovery/file access have evidence.
**A successful fresh packed edit/full matrix is not proven; issue #26 remains
open.** Earlier source-build editing evidence is not relabeled as this result.
CLI-token inference, strict data-only Entra authorization, VS Code and registry
publication remain separate open gates.

Private logs, operation states, image bytes, ledgers and package evidence are
retained under ignored `.local/`. No raw client reasoning, credential value or
private subscription state is published in this record.
