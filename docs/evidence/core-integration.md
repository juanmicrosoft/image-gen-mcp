# MCP core integration — epic #3

2026-09-24. This record integrates already reviewed child work; it adds no second
implementation or new live request.

| Child | Dedicated merged PR | Acceptance evidence |
| --- | --- | --- |
| #13 typed stdio executable | [#35](https://github.com/juanmicrosoft/image-gen-mcp/pull/35) | SDK initialization/discovery, executable package scaffold, strict TypeScript |
| #14 explicit configuration/auth | [#43](https://github.com/juanmicrosoft/image-gen-mcp/pull/43) | [Configuration](../configuration.md), offline credential-selection tests |
| #15 honest diagnostics | [#44](https://github.com/juanmicrosoft/image-gen-mcp/pull/44) | [Diagnostics](../diagnostics.md); configured is not observed |
| #16 generation | [#46](https://github.com/juanmicrosoft/image-gen-mcp/pull/46) | [Actual immutable generation](mcp-generation.md) |
| #17 reference editing | [#47](https://github.com/juanmicrosoft/image-gen-mcp/pull/47) | [Actual explicit-source editing](mcp-editing.md) |

All five children are closed after independent final-commit review and merge.
`src/cli.ts` registers `get_capabilities`, `generate_image`, `edit_image` and
`get_operation`; the actual [Copilot CLI run](copilot-cli.md) exercised
generation, inspection and explicit-source editing through those tools.

The shipped scope is one local stdio process, explicit Azure CLI or API-key
selection, and only the proven 1536x864/high/PNG/n=1 profile. The reasoning agent
supplies the creative brief; there is no Astra/planning deployment, silent
credential fallback, model fallback or automatic billable retry.

This is **core integration closure**, not Milestone 1 certification. CLI-token
inference permission remains blocked in #11; actual authenticated VS Code
remains #21. The separately installed candidate generated successfully, but its
sole edit ended unknown, so #26's complete packed-client gate remains open
([package evidence PR](https://github.com/juanmicrosoft/image-gen-mcp/pull/56)).
Registry authorization/publication remains #30. Successful source-build editing
does not turn that unknown packed observation into success.
