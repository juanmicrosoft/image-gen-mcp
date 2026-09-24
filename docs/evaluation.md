# Bounded visual evaluation

The [fixed briefs and rubric](../evaluation/briefs.json) were declared in the
[pre-run issue record](https://github.com/juanmicrosoft/image-gen-mcp/issues/25#issuecomment-5818885330)
before the evaluated runtime requests. No output was regenerated or selected
from hidden alternatives.

Each case uses the regular real-stdio smoke harness, exactly one image request,
one shared-root in-flight operation and a durable request ledger. Configure the
runtime explicitly first. For a new purpose-specific three-request evaluation:

```sh
IMAGE_GEN_LIVE=true IMAGE_GEN_MAX_REQUESTS=3 \
  node scripts/evaluate.mjs --case generation \
  --ledger "$PWD/.local/evaluation-budget.json" --record "$PWD/.local/eval-a.json"

# Use A's actual returned artifact UUID, never a newest-image heuristic:
IMAGE_GEN_LIVE=true IMAGE_GEN_MAX_REQUESTS=3 \
  node scripts/evaluate.mjs --case edit --source-artifact A_ARTIFACT_UUID \
  --ledger "$PWD/.local/evaluation-budget.json" --record "$PWD/.local/eval-b.json"

IMAGE_GEN_LIVE=true IMAGE_GEN_MAX_REQUESTS=3 \
  node scripts/evaluate.mjs --case editorial \
  --ledger "$PWD/.local/evaluation-budget.json" --record "$PWD/.local/eval-c.json"
```

Do not reset or change an existing ledger limit. Failed/unknown attempts count.
If generation fails, do not run its dependent edit with an empty source; record
that case as not attempted. The harness rejects absent/invalid edit identities.
Use distinct exclusive record paths, preserve failed attempt evidence, and
never regenerate repeatedly until an attractive image appears.

Hard gates: exactly one fully decodable 1536x864 PNG per successful request;
source bytes/hash unchanged for edits. Visual scoring is inspection judgment,
not an objective scientific measurement: score each fixed dimension 1-5, with
every applicable dimension at least 3 for a pass. Report weak results and
non-sky lighting/reflection changes rather than promising pixel preservation.

Reproduction is probabilistic: the same brief is not guaranteed to yield the
same image or score. Model identity/version, configuration, latency, usage,
hashes and every attempt belong in a dated run record. Missing usage remains
unknown; apply [Azure-specific pricing/geography guidance](live-testing.md),
not direct OpenAI API prices or an invented fixed per-image cost.
