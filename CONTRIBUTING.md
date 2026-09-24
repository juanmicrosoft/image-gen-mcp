# Contributing

Read [AGENTS.md](AGENTS.md) before planning or changing anything.

1. Put each activity in a milestone, an epic and a bounded child issue with
   dependencies, exclusions, acceptance criteria and an evidence baseline.
2. Create an issue-specific branch and one dedicated PR for that issue. Do not
   bundle implementation or closure of multiple issues into one PR. Epics get
   their own integration/evidence closure PR after their child work.
3. Implement and verify the issue's exact acceptance criteria. Record commands,
   results, source links, versions and relevant limitations without secrets.
4. Once ready, obtain independent adversarial review of the issue and final
   diff. Record reviewer, SHA, findings and dispositions. Address feedback,
   rerun affected validation and obtain follow-up review for material changes.
5. Merge only after the evidence/review/check gates pass. Keep issues open for
   outstanding post-merge deployment, publication or acceptance checks.

## Local development

Node >=22.22.0 is declared in `package.json`. From a clean checkout:

```sh
npm ci
npm run typecheck
npm test
npm pack --dry-run
```

Normal tests are offline. Live work additionally requires explicit opt-in,
request bounds and the durable budget helper described in
[live-testing.md](docs/live-testing.md); never run paid inference automatically
on pull requests. No credentials are required by the offline suite.

Use strict types, precise errors, and existing helpers. Add regression tests for
fixed behavior; do not hide failures with defaults or broad success fallbacks.
Proposed functionality is not a verified fact. Record unresolved assumptions in
issues and validate them before claiming support.

Contributions to the software/documentation are under the [MIT license](LICENSE).
Only contribute source and assets you have rights to distribute. The software
license does not change Azure/OpenAI service terms or warrant ownership,
clearance, or exclusivity of generated images or third-party source assets.

Report suspected vulnerabilities through [SECURITY.md](SECURITY.md), not a public
issue containing exploit details or private data.
