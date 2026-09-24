# Runtime generation evidence

Issue #16, observed 2026-09-24 on macOS arm64, Node 22.22.2, official MCP SDK
1.30.0 and the isolated Sunburst deployment described in the
[Azure contract](azure-contract.md).

`scripts/smoke-mcp.mjs` launched the built `dist/cli.js` through the real SDK
stdio transport, then called `generate_image` once using explicit API-key
configuration. Request 6 of the existing 8-request feasibility/runtime ledger
was consumed before the tool call. No retries occurred.

Observed result: `succeeded`; **55,045 ms** end-to-end; a fully decoded immutable
**1536x864 PNG**, quality `high`, plus one bounded JPEG MCP image-content preview.
SHA-256:
`f746ff5c0489c96576a893ebabdfb93acc5572770ede43e44f83740943261512`.
Returned/persisted usage: 58 input, 1078 output, 1136 total tokens. A safe provider
request ID was present. The model evidence field correctly says `configured`,
not inferred from the deployment alias or upgraded to observed API identity.

Visual inspection found the cyan observatory at right, layered teal mountains
and broad dark navy negative space at left, without visible lettering. This is
one observed result, not a general quality guarantee. The predetermined
multi-brief evaluation remains issue #25.

The private attempt/result files and original image remain in ignored `.local/`.
No prompt, credential, private subscription state, full image or preview base64
is committed. The public non-sensitive brief and reproduction procedure are in
[generation guidance](../generation.md). The returned filesystem path is not
evidence that a Copilot client has inspected the image; that is issue #21.

Offline protocol tests additionally prove unsupported options fail before
provider submission, prompts remain unchanged, identical-operation replay
submits only once, usage survives restart, ambiguous errors preserve uncertainty
and category, and preview opt-out does not return image content.
