# Live tests: cost, consent and geography

Live inference is never part of the default offline test command. A live runner
must use `scripts/lib/live-budget.mjs`, set `IMAGE_GEN_LIVE=true`, explicitly set
`IMAGE_GEN_MAX_REQUESTS`, and reuse its absolute ledger path across restarts.
Each callback submits **one request for one image**. One ledger permits only one
in-flight callback. Separate ledgers are separate budgets, not an account-wide
spending limit; do not create another ledger to bypass an exhausted run.

The ledger reserves before submission, including failed/ambiguous calls.
Interrupted locks or pending files require operator inspection, not automatic
deletion/retry. Do not remove the lock until the previous process is stopped and
the upstream outcome is understood; cancellation does not prove nonbilling.
SDK/HTTP retries must be disabled by every live runner. The helper bounds request
count, not money or server-side execution time.

## Pricing evidence (2026-09-24)

The official [Azure Retail Prices API](https://prices.azure.com/api/retail/prices)
returned these East US 2 `Azure OpenAI Media` Global Sunburst meters, effective
2026-09-01. Query:

```sh
curl --get --fail --silent --show-error \
  --data-urlencode "\$filter=contains(meterName, 'sunburst') and armRegionName eq 'eastus2'" \
  https://prices.azure.com/api/retail/prices
```

| Meter suffix | USD per 1M tokens |
| --- | ---: |
| txt inp Gl | 5.00 |
| txt cd inp Gl | 1.25 |
| img inp Gl | 8.00 |
| img cd inp Gl | 2.00 |
| img opt Gl | 30.00 |

These are public retail observations, not a quote for a particular agreement,
currency or subscription. Recheck [Azure pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/)
before a run. The public pricing page rendered placeholders during inspection;
the table above came from Azure's retail API, not OpenAI's direct API price list.
No fixed per-image cost is asserted: output tokens vary. Missing provider usage
means **unknown**, not zero. Billing and estimates must be labeled separately.
Budget alerts are not hard caps.

## Data-processing boundaries

[Microsoft's data/privacy documentation](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/data-privacy)
states that Global deployments may process prompts/responses in any geography
where the model is deployed; choosing East US 2 does not constrain inference to
that region. The document distinguishes processing from data at rest, and
describes safety evaluation and abuse monitoring. It states that Azure-hosted
models do not send data to OpenAI's services or train foundation models on
customer data without permission/instruction. This is not a zero-retention
promise. Check applicable service terms, organizational policy and geography
requirements before choosing GlobalStandard.

Use synthetic non-sensitive briefs for tests. Copilot may separately receive
prompts/previews in its context and transcript; Azure ownership does not imply
that every copy remains inside the Azure resource.

## Permission and capacity gates

Before provisioning, check the selected subscription, resource provider,
regional model/version/SKU, creation permissions and quota. Catalog presence
and quota `Count` are not guaranteed capacity or requests-per-minute. If blocked,
record the exact sanitized failure and request the required access/quota; do not
switch subscription, model or processing geography automatically.

Offline verification: `node --test test/live-budget.test.mjs`.
