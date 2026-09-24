# Azure image contract: observed and unverified

Issue #9; observed 2026-09-24 with Node 22.22.2 native `fetch`, Azure CLI
2.90.0, the isolated AIServices S0 account provisioned by #10, Sunburst model
version `2026-09-08`, GlobalStandard capacity 1, deployment alias `sunburst`.
No project endpoint, Agent Service or separate text model was used.

## Observed calls

| Operation | Auth | Options | HTTP | Result |
| --- | --- | --- | ---: | --- |
| Generate | API key | high, 1536x864, n=1, PNG | 200 | 47,506 ms; PNG fully decoded |
| Edit | API key | same options, one PNG reference | 429 | RateLimitReached; no image, usage unknown |
| Edit, explicit later submission | API key | same options/source after waiting | 200 | 55,007 ms; PNG fully decoded |
| Generate | Azure CLI token | high, 1024x1024 | 401 | PermissionDenied; keyless validation blocked in #11 |
| Invalid size probe | API key | high, 100x100 | 400 | invalid_value; no image, usage unknown |

The 429 was recorded, not hidden by a retry loop. The later request used a new
explicit output/attempt record after waiting. The durable probe budget counts
every attempt, including failures. It is a request-count bound, not a dollar cap.

Generation SHA-256:
`6ce66e077498a9959f39219bc1116624384f820cea222abc414090f5af159c76`.
Successful edit SHA-256:
`dc73c61156b845f8be972ea571c28bf73dc697410a29081ecd10b32aa0901956`.
Both files were verified and fully loaded by Pillow as RGB PNGs at **1536x864**,
and visually inspected. The edit changes the sky to coral while retaining the
observatory/mountain composition; this is an observed example, not a promise of
pixel-identical preservation.

## Exact wire contract

```text
POST https://<resource>.openai.azure.com/openai/deployments/<alias>/images/generations?api-version=2025-04-01-preview
POST https://<resource>.openai.azure.com/openai/deployments/<alias>/images/edits?api-version=2025-04-01-preview
```

Generation sends JSON `{prompt,n:1,size,quality,output_format:"png"}` and the
`api-key` header. Editing sends those fields as multipart text plus the `image`
part (PNG bytes, `image/png`, a fixed non-private filename). Do not set a manual
multipart boundary. Redirects are refused and requests are not retried.

Successful top-level keys observed: `created`, `background`, `data`,
`output_format`, `quality`, `size`, `usage`. `data` contains one image with
`b64_json`. The probe retains only safe shape/usage metadata, not raw responses.
Observed usage: generation 58 input / 1078 output / 1136 total tokens; edit 1346
input / 1078 output / 2424 total. No `x-ms-request-id` header was present in these
responses; the evidence reports null, not an invented ID.

The implementation will use a small typed REST adapter on the tested route.
This is an intentional choice for explicit retry/timeout/response limits, not a
claim that the OpenAI SDK cannot support Azure.

## Reproduction and limitations

After explicit provisioning, use the private state path:

```sh
IMAGE_GEN_LIVE=true IMAGE_GEN_MAX_REQUESTS=8 \
  node scripts/probe-azure.mjs --state "$PWD/.local/azure.json" \
  --output "$PWD/.local/probe/new-hero.png" --auth api-key
```

For an edit, add `--source` with the prior PNG. The probe retrieves the key via
the authorized management CLI and holds it only in memory; it is not the runtime
server's authentication design (inference-only users will supply configuration,
not need key-listing privileges). Azure CLI auth is a separate explicit mode;
it does not fall back to keys. An existing `.attempt.json` refuses resubmission
to the same output after ambiguous interruption.

Full image decoding/visual inspection is a separate validation step; the probe
itself checks only PNG signature/header and response size/shape. Output records
and image bytes stay in ignored `.local/`. Keep images free of sensitive data.

Only `high` at `1536x864` is live-observed here. Other sizes/qualities, masks,
multiple references, transparency and different API routes are documented or
unverified, **not** certified by this run. Region capacity and permissions may
change. A deployment alias does not establish its model identity without the
management deployment record. CLI token acquisition does not establish inference
authorization. No exact ChatGPT backend or result parity is claimed.

Source: [Azure image generation guide](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/dall-e).
