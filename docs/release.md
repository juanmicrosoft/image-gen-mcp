# Release candidate and evidence index

## Status — 2026-09-25 UTC

`0.1.0` is a source/tarball candidate, **not a verified published npm version**.
`npm whoami` returned `ENEEDAUTH`; subsequent local registry reads failed with
connection/TLS errors. Neither scope ownership nor name availability is proved.
Issue #30 stays open pending registry authorization and installation evidence.

The repository is public and the code/documentation are MIT licensed. Service
terms and rights in generated/reference images remain separate. Do not replace
source setup with an assumed `npx` version.

## Verification pipeline

The `Offline verification` workflow runs locked dependency installation,
production-dependency audit, typecheck, offline tests, the isolated presentation
example test and real tarball installation/discovery on Ubuntu/macOS with Node
22.22.2. It checks MCP/package version agreement and retains per-run tarballs
and SHA-256/inventory evidence as workflow artifacts for 14 days.

[Run 36053657929](https://github.com/juanmicrosoft/image-gen-mcp/actions/runs/36053657929)
passed every step on both hosted platforms for candidate
`651d75ae58aa62244bd44e47dbaaddad89b5a6bc`, including normal-mode registry
dependency installation. This is distinct from the local warm-cache check.
Consult the PR/current commit checks for subsequent candidates; an earlier green
run is not proof for a different commit. Jobs have read-only repository permission, no Azure credentials,
`IMAGE_GEN_LIVE=false`, no publishing step and no image-generation requests.
There is deliberately no automatic live or publishing workflow. npm access for
dependencies/audit is expected; "offline" refers to image-provider tests, not a
general network sandbox.

Action references are immutable commits resolved from official `actions/*`
v6 tags on 2026-09-24. Locked dependencies plus the production audit provide
repeatable installation and advisory checking, not a security guarantee.
Dependency changes still need a tracked issue, dedicated PR and review.

## Evidence and support boundaries

| Surface | Dated evidence / limitation |
| --- | --- |
| Model/API/deployment | [Contract](evidence/azure-contract.md), [deployment](evidence/azure-deployment.md); no ChatGPT backend parity |
| Authentication | [Authorization record](evidence/authentication.md); key and CLI-token inference observed; strict data-only and remaining negative cases unproved |
| Actual client | [Installed-client qualification](evidence/client-qualification.md); macOS/Node 22.22.2/CLI 1.0.79 and VS Code 1.139.0; native Local recovery/editing qualified with previews off and recorded host-model boundaries |
| Artifact quality | [Fixed three-case evaluation](evidence/visual-evaluation.md); not universal visual-quality assurance |
| Reliability | [Offline fault/protocol evidence](evidence/reliability.md), [recovery](recovery.md); unknown is not free or retriable |
| Presentation | [Rendered editable deck](evidence/presentation.md); viewer/font portability not guaranteed |
| Installation | [Onboarding](evidence/onboarding.md), [later installed-client success](evidence/client-qualification.md); initial packed edit remains unknown, downstream authorization/onboarding gates remain |
| Platform support | [Distribution boundaries](distribution.md); CI is not live-client/Entra/platform certification |

**Qualification update, 2026-09-25 UTC:** the linked initial
records retain historical failures. [Later installed-client evidence](evidence/client-qualification.md)
proves CLI-token generation/editing and image access in local macOS
Copilot CLI and CLI-backed VS Code. Native Local generation succeeded; after
a host image-transport failure, preview-off recovery, editing and local-file
inspection succeeded. Host model/version boundaries are recorded separately.
The former packed edit remains unknown; stricter
data-only/negative-case authorization and registry publication remain open.
This is not a published release or an all-platform certification.

## Authorized publication checklist

Publishing is a separate, currently blocked operation, not a side effect of
building or merging. An authorized maintainer must:

1. Resolve remaining release gates or explicitly scope a separately tracked
   preview; retain the existing unknown operation/budget rather than retrying.
2. Verify npm identity, scope/package ownership and publishing permission using
   the intended registry. Configure a supported trusted publisher or protected
   credentials without committing secrets.
3. Select the reviewed commit and verify its exact workflow run passed. Download
   or build its tarball, compare the recorded checksum/inventory, and review
   package contents and release notes. Do not use an older candidate checksum.
4. Publish the reviewed tarball explicitly with public access only after
   authorization; do not overwrite/reuse an already published version.
5. Read registry metadata, install that exact version into a fresh prefix and
   repeat discovery and the approved client acceptance. Link the registry
   version, run, checksum and limitations before tagging/announcing a release.

Until those steps have evidence, use the reviewed source or a locally verified
tarball. Once a registry release exists, client commands must pin the verified
version rather than an unbounded `latest`.
