# Governance epic acceptance

Epic: [#1](https://github.com/juanmicrosoft/image-gen-mcp/issues/1).
Recorded: 2026-09-24.

## Completed child work

[#8](https://github.com/juanmicrosoft/image-gen-mcp/issues/8) was delivered by
[PR #31](https://github.com/juanmicrosoft/image-gen-mcp/pull/31), merged as
`006bcc1dcbeb4fdb326effef44ba17b628ab505d`. It added the root `AGENTS.md` rules
for milestone/epic/issue planning, per-issue PRs, independent adversarial review,
finding dispositions, and evidence-backed factual claims.

The PR records the independent review, two findings (CI acceptance ordering and
Azure evidence traceability), their fixes and the final approval of the reviewed
commit. No application completion was claimed.

## Reproducible integration checks

```sh
gh issue view 8 --repo juanmicrosoft/image-gen-mcp --json state
gh pr view 31 --repo juanmicrosoft/image-gen-mcp --json state,mergeCommit
gh api repos/juanmicrosoft/image-gen-mcp/issues/1/sub_issues
gh api 'repos/juanmicrosoft/image-gen-mcp/contents/AGENTS.md?ref=main'
```

Observed: child #8 closed, PR #31 merged, native parent relationship present,
and `AGENTS.md` available on the default branch. PR #31 also contains the full
read-only structural verifier for the milestone's issue references and graph.
Counts there are dated snapshots; future issues can change them.

## Limitations

Repository instructions establish a contributor/agent workflow; they are not
GitHub branch protection or an automatic proof of compliance. Every subsequent
PR still needs its own review and evidence. This epic does not establish Azure
feasibility, working image generation, client support, package publication or
completion of the other milestone epics.
