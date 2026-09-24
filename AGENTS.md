# Repository instructions

These rules apply to all work in this repository, including planning,
implementation, documentation, infrastructure, tests, and releases.

## Capture all planned work in GitHub

- Capture every plan activity in a GitHub milestone, an epic, and an actionable
  child issue before starting the activity. Do not leave required work only in
  chat, a local checklist, or a pull request description.
- Use milestones for deliverable outcomes, epic issues for workstreams, and
  native GitHub sub-issue relationships for actionable work. Assign the epic and
  every child issue to the relevant milestone.
- Give each issue a bounded objective, scope and exclusions, dependencies,
  acceptance criteria, an evidence baseline, and a validation approach.
- Record newly discovered work and blockers in issues. Update dependencies and
  acceptance criteria when evidence changes the plan; do not silently expand
  scope or claim unsupported behavior.
- Keep epic child lists and milestone state accurate. Close a milestone only
  when its issues and epics have met their acceptance criteria and their
  dedicated PRs have merged.

## One issue, one dedicated pull request

- Make changes on an issue-specific branch, never directly on `main`.
- Create an individual PR for each issue. Link its issue in the PR description
  and use a closing reference only when all acceptance criteria are satisfied.
  One PR must not implement or close multiple issues.
- An epic is also an issue: its dedicated closure PR records integration
  evidence, completed child work, and remaining limitations. It does not
  rebundle implementation from child PRs.
- If work is too broad for one coherent PR, split it into child issues before
  implementation; each resulting issue gets its own PR.
- Do not close an issue merely because code was written or a PR opened. Verify
  its acceptance criteria and merge its dedicated PR first. If publishing,
  deployment, or another acceptance step follows merge, keep the issue open
  until that step has evidence.

## Adversarial review before merge

- Once the PR is ready, run an independent adversarial review of both the issue
  and the proposed solution. Review the issue's assumptions, completeness and
  acceptance criteria as well as the final diff, integrations, failure modes,
  tests, documentation, and evidence.
- Record the reviewer, reviewed commit SHA, findings, and their dispositions in
  the PR. A separate reviewer or independent agent must perform this review;
  the implementer's own check is not a substitute.
- Address every finding. Fix valid findings and validate the fixes. Explain
  rejected findings with evidence. Do not dismiss feedback solely as an
  opinion or silently defer required acceptance work.
- Rerun affected checks after changes. Obtain a follow-up independent review
  when changes materially affect the reviewed behavior or resolve a blocking
  finding; identify exactly which final commit the review covers.
- Merge only after acceptance evidence is complete for the merge stage,
  adversarial feedback is addressed, required checks pass, and no unresolved
  blocking findings remain. Honor any additional GitHub review/protection rules.

## Evidence-backed claims and plans

- Back every factual claim with evidence: reproducible commands and relevant
  results, precise code/test references, inspected artifacts, or authoritative
  documentation. Link the evidence from the relevant issue or PR and record
  dates, versions, and environment details when they affect the result.
- If evidence is missing, perform the research, experiment, test, or inspection
  needed to validate the claim. Until then, label it unverified; do not present
  a proposal, assumption, estimate, or opinion as a proven fact.
- Distinguish verified observations, documented capabilities, user requirements,
  design decisions, and hypotheses. Design decisions must state their rationale
  and validation criteria; uncertain decisions need an explicit validation
  issue and must not bypass dependent implementation gates.
- High-quality plans are grounded in proven facts. Include validation work for
  unknowns, make dependent work conditional on its results, and revise the plan
  when evidence disproves an assumption.
- Verify the exact claim, not a proxy. A catalog entry is not a successful
  deployment; quota is not throughput; a token is not inference permission; a
  successful API response is not a valid image; a saved path is not proof that
  Copilot can inspect it; a development build is not a clean package install.
- Report failures, limitations, unknown outcomes, skipped checks, and blocked
  acceptance criteria plainly. Do not describe future acceptance checkboxes as
  completed functionality, or claim success without reproducible support.
- Keep evidence safe: redact secrets and personal configuration, avoid raw
  sensitive prompts/images/responses, and do not commit credentials. Summaries
  must retain enough detail to reproduce the check without exposing secrets.

## Current scope and operational boundaries

- Milestone 1 is tracked at
  <https://github.com/juanmicrosoft/image-gen-mcp/milestone/1>.
- The planned product is an MIT-licensed local stdio image-generation MCP using
  the user's Azure inference deployment. GPT-Image-2.5-Sunburst is the selected
  candidate, subject to the Azure feasibility issues; do not claim identical
  ChatGPT routing or results. No Astra or separate prompt-planning model.
- Keep provisioning separate from runtime tools. Do not change unrelated Azure
  resources or silently switch subscriptions, regions, identities, or models.
- Billable validation requires explicit opt-in and bounded requests/concurrency.
  Do not assume retrying, timing out, or cancelling a request avoids charges.
- Do not implement deferred features without first updating the issue-backed
  scope. Verify the current GitHub backlog rather than treating this summary as
  a substitute for acceptance criteria.
