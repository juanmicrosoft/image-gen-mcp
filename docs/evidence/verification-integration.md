# Verification integration — epic #6

**Update:** [Later installed-client qualification](client-qualification.md)
proves successful editing and image access in both local clients without
changing the earlier unknown operation. #26 retains its original dependencies;
the initial record below remains historical.

2026-09-24. **This epic remains open** because the complete fresh packed-client
acceptance in #26 is missing.

| Child | Dedicated PR | Evidence |
| --- | --- | --- |
| #23 unit/stdio contracts | [#49](https://github.com/juanmicrosoft/image-gen-mcp/pull/49), closed | [Testing policy](../testing.md), [failure/protocol record](reliability.md) |
| #24 fault injection | [#50](https://github.com/juanmicrosoft/image-gen-mcp/pull/50), closed | [Real subprocess kill/replay/lock and persistence checks](reliability.md) |
| #25 bounded visual quality | [#51](https://github.com/juanmicrosoft/image-gen-mcp/pull/51), closed | [Predeclared three-case rubric and independent inspection](visual-evaluation.md) |
| #26 clean installed client | [#56](https://github.com/juanmicrosoft/image-gen-mcp/pull/56), partial | Installation/discovery/generation proved; only packed edit unknown |

The local candidate validation ran strict typecheck, 44 offline tests and the
isolated presentation test successfully. The real package verifier installed
outside the checkout, checked the executable, all four tool names, package
inventory and relative documentation links. That latest installation used an
explicit warm npm cache; it is not a cold-network or all-platform claim.

The packed live session made two bounded image attempts: generation succeeded;
the edit ended `outcome_unknown`, without a committed artifact. Its recorded
wall-clock duration exceeded the configured deadlines; the cause is unverified.
A nonbillable actual CLI session recovered/viewed the generation and preserved
the unknown edit. No budget reset, hidden retry or replacement operation made
that failed acceptance green.

The three fixed visual cases and source-build edit are not substitutes for
successful packed editing or broad visual-quality guarantees. Offline fetch
guards are not network sandboxes; process-kill tests are not power-loss or
distributed-filesystem certification. #26 and this epic remain open until
their original missing client acceptance has independently reviewed evidence.
