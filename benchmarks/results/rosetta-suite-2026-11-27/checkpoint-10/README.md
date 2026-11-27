# Checkpoint 10: complete measurements, two Hard Full failures

These four reports all measure the clean local engine
`155d58129799231c26094a36e4a23d771969a1b6`, whose tree is identical to published
GitHub commit `492773f6dfabe4b41d9853b627a3a260e15c8f34`:
`d9207b84ee4650e0eb24b711fc863e835f0afeea`.
The adjacent provenance files preserve exact commands, source/build hashes,
runtime identity, process outcomes and validation. `manifest.json` records
the SHA-256 of all eight unchanged report/provenance files.

| Tier | Score | Strict all-pass gate | Failure counts |
| --- | ---: | --- | --- |
| [Quick](annonyA-quick.json) | 882/882 | Passed | Zero |
| [Full](annonyA-full.json) | 12,276/12,276 | Passed | Zero |
| [Hard Quick](annonyA-hard-quick.json) | 882/882 | Passed | Zero |
| [Hard Full](annonyA-hard-full.json) | 12,274/12,276 | **Failed** | Two mismatches |

Hard Full has no decompilation failures, recompilation failures or refusals.
Its two mismatches both use `O0g2+x2`:

- `mut1-316`: line 3 should contain `4\tnil`, but contains `nil\tnil`.
- `mut1-478`: line 2 should contain `4\tnil`, but contains `nil\tnil`.

Rosetta's underlying benchmark process returned zero, but the strict runner
correctly rejected the incomplete 12,274/12,276 result. Its provenance status
is `failed`. This checkpoint does **not** pass all four tiers.

Full and Hard Full each include six upstream `seed1541` original/profile
pairs marked unusable because the input exhausts the execution step budget.
The raw `u` verdicts and their details remain unchanged. Each full tier has
12,282 scheduled pairs and 12,276 graded pairs; no candidate failure is excluded.

Later directed repairs are development regression evidence. They cannot replace
a fresh complete measurement of the corrected engine. The first four-tier
result remains preserved here without rewriting either residual mismatch.
