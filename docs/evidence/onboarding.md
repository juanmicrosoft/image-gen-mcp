# Onboarding evidence and limits

**Update:** [Later qualification](client-qualification.md) proves CLI-token
generation/editing in both installed local clients. The initial warm-cache
and unknown-edit observations below remain historical facts.
[Subsequent data-only onboarding](data-only-authentication.md) also proves the
installed runtime needs no ARM read access, with isolated profile selection
disclosed. It does not relabel service-principal sign-in as fresh human-user
onboarding. Final closure depends on independent review of these combined,
bounded records, not a claim that every platform/auth combination works.

Issue #28, 2026-09-24, macOS arm64, Node 22.22.2, npm 10.9.7.

A fresh, separate Git clone of the PR candidate branch was created outside the
working checkout. `npm ci --offline --no-audit --no-fund`, `npm run build` and
`npm run typecheck` completed successfully. The explicit offline flag used an
existing warm dependency cache because registry connection/TLS checks failed;
this is not a cold-network installation claim. Normal network installation
remains the guide's default, not an offline guarantee for a new machine.

All 18 emitted JavaScript/declaration files matched the separately installed
tarball's compiled files byte-for-byte. The bundled private client-config helper
was executed with explicit API-key mode and a supplied key, producing an
exclusive 0600 file outside the actual client's workspace. The selected
environment fields were used by the normal installed server, with empty HOME
and a first-in-PATH Azure CLI denial sentinel.

That actual fresh-profile Copilot session discovered the tools and generated a
fully decoded immutable 1536x864 PNG. The Azure CLI sentinel was never invoked:
the runtime needed no management discovery/key retrieval. The test operator
obtained the key separately, as a resource owner can supply configuration to an
inference-only runtime. This does **not** prove a strict data-only Entra principal
or CLI-token authorization.

The session's sole edit later ended `outcome_unknown` with no saved result.
Its two-request ledger remains exhausted and no image was resubmitted. A
subsequent nonbillable actual CLI session recovered/viewed the saved generation
and accurately retained the edit's unknown/billing state. The temporary
plaintext key configuration was removed, and both original test processes were
confirmed stopped. A successful complete packed-edit workflow remains #26.

The helper's offline regression covers key-storage consent, secret-free console
output, selected environment fields, 0600 permissions and refusal to overwrite.
The guide explicitly warns that same-user agents are not isolated by filesystem
permissions or `.gitignore`.

From-scratch Bicep deployment/reconciliation and populated owner-scoped teardown
have separate [Azure deployment evidence](azure-deployment.md). Source-build
generation/editing/inspection and an editable presentation have separate
[CLI](copilot-cli.md) and [presentation](presentation.md) evidence; they are not
substituted for the failed packed edit.

CLI-token inference (#11), authenticated VS Code (#21), complete packed
validation (#26), cold-network installation and npm publication (#30) are not
promoted to verified by this setup record. The documented API-key setup and
non-management runtime path have direct evidence; unresolved acceptance stays
visible in the milestone.
