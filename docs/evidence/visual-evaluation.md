# Visual evaluation run: 2026-09-24

Issue #25. macOS arm64, Node 22.22.2, Sunburst deployment model/version
`gpt-image-2.5-sunburst` / `2026-09-08`, GlobalStandard, East US2,
API `2025-04-01-preview`; high-quality 1536x864 PNG, one reference for editing.
Deployment model/version comes from the provisioning record, not the alias.
Global processing is not guaranteed to stay in East US2.

The [rubric/briefs were fixed before A/B/C](https://github.com/juanmicrosoft/image-gen-mcp/issues/25#issuecomment-5818885330).
The [versioned case file](../../evaluation/briefs.json) retains the actual briefs
and scale. A/B used the real-stdio smoke harness; C used `scripts/evaluate.mjs`,
which invokes that same harness. The original shared ledger ended **8/8**, with
concurrency one and no automatic retries or hidden regenerations.

## All attempts in that ledger

| # | Purpose | Result | Latency ms | Usage input/output/total |
| --- | --- | --- | ---: | --- |
| 1 | Preliminary API-key generation | HTTP 200 | 47506 | 58 / 1078 / 1136 |
| 2 | Preliminary edit | HTTP 429 RateLimitReached | 837 | Unknown |
| 3 | Explicit later preliminary edit | HTTP 200 | 55007 | 1346 / 1078 / 2424 |
| 4 | CLI-token generation | HTTP 401 PermissionDenied | 918 | Unknown |
| 5 | Deliberately invalid-size API probe | HTTP 400 invalid_value | 459 | Unknown |
| 6 | Evaluated A: MCP observatory hero | Succeeded | 55045 | 58 / 1078 / 1136 |
| 7 | Evaluated B: explicit A-to-coral edit | Succeeded | 55245 | 1346 / 1078 / 2424 |
| 8 | Evaluated C: editorial optical forms | Succeeded | 52828 | 51 / 1078 / 1129 |

Rows 1-5 establish feasibility and failures; they are not retrospectively scored
as fixed-rubric passes. Failed responses are not assumed free. Separate actual
Copilot-client validation used its own declared two-request ledger, accounted
for in [client evidence](copilot-cli.md); those are not hidden quality candidates.

## Hard gates and inspection judgments

All A/B/C outputs fully decoded as single 1536x864 PNGs. B's persisted source
hash matches A, and A's original image and manifest remained unchanged.
Every output was inspected, including limitations. Scores below are explicit
inspection judgments, not measured universal model capability.

| Output | Composition | Negative space | Palette | No unwanted text/artifacts | Edit preservation | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| A | 5 | 5 | 5 | 4 | N/A | Pass |
| B | 5 | 5 | 4 | 4 | 4 | Pass |
| C | 4 | 5 | 5 | 4 | N/A | Pass |

The predeclared pass threshold is at least 3 in every applicable dimension.
A provides broad navy left-side space and a cyan observatory at right.
B preserves the recognizable observatory/mountain layout and left-side space,
but changes reflections, illumination and cloud details outside a literal sky
mask. C supplies coral/cyan layered optical forms with strong left-side space;
the largest form is full-bleed/cropped at the right edge. It is an editorial
illustration, not a physically validated optical schematic. No lettering or
logos were visible. These limitations remain even though the rubric passed.

Verified full-resolution SHA-256:

- A: `f746ff5c0489c96576a893ebabdfb93acc5572770ede43e44f83740943261512`
- B: `9d6b659b4a2008d701fbaf023779f3c7226698f9cf11beb241009e981904e360`
- C: `7301ed3a4fe953e4d3cf999affd37a82b8d9320c9042fffd369ea71dcb0ca645`

Originals, manifests, attempt/result files and ledgers remain in private ignored
`.local/`. Safe provider request IDs were available for A/B/C. Usage counters
are observed, not inferred; aggregate counters alone are not a contract-specific
invoice. Pricing claims refer to the [dated Azure retail evidence](../live-testing.md),
not direct OpenAI pricing.

Remediation for a weak result is to record the failure, adjust the brief in a
new version and obtain a separately bounded evaluation plan—not keep retrying
inside this exhausted run. There is no claim of exact ChatGPT routing, identical
outputs, guaranteed style consistency or pixel-preserving edits.
