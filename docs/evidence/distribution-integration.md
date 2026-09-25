# Distribution integration and release gates — epic #7

**Update:** [Later qualification](client-qualification.md) proves CLI-token and
VS Code installed-client paths. Initial unverified rows below are historical;
registry authorization and original remaining dependency gates stay open.

2026-09-24. **This epic remains open.** Public source and a tested tarball are not
a published npm release, and registry authorization is unavailable.

| Child | Dedicated PR | Evidence |
| --- | --- | --- |
| #27 MIT/contribution/security | [#39](https://github.com/juanmicrosoft/image-gen-mcp/pull/39), closed | Root LICENSE, CONTRIBUTING.md and SECURITY.md |
| #28 proven setup guide | [#55](https://github.com/juanmicrosoft/image-gen-mcp/pull/55) | Fresh source clone/build, private selected-field client config, normal API-key runtime without management discovery |
| #29 operations/privacy | [#52](https://github.com/juanmicrosoft/image-gen-mcp/pull/52), closed | [Retention, privacy, billing and recovery](../operations.md) |
| #30 CI/release | [#57](https://github.com/juanmicrosoft/image-gen-mcp/pull/57), partial | Actual CI passed; registry publication remains blocked |
| #32 supplied icon | [#33](https://github.com/juanmicrosoft/image-gen-mcp/pull/33), closed | Original icon preserved in assets and README |

The [actual GitHub Actions run](https://github.com/juanmicrosoft/image-gen-mcp/actions/runs/36053657929)
for candidate `651d75ae58aa62244bd44e47dbaaddad89b5a6bc` passed both Ubuntu and
macOS jobs: dependency installation/audit, typecheck, offline tests, isolated
presentation test and actual tarball installation/discovery/version checks.
The workflow contains no Azure secrets, image requests or publishing step.
This is not live-client certification on both platforms.

`npm whoami` returned `ENEEDAUTH`, and subsequent registry reads failed with
connection/TLS errors. Scope ownership/name availability and registry
installation are not proved. No tag/publication announcement or silent
credential workaround substitutes for them. Issue #30 records the authorized
publication checklist and retains its missing gate.

The fresh packed edit remains unknown under #26, separate from successful
source-build editing and installed generation. Setup documentation discloses
the CLI-token/VS Code limitations rather than promising unsupported combinations.
All remaining original child/release gates must have evidence before this epic
or Milestone 1 can close.
