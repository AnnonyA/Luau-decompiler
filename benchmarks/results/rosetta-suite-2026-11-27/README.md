# Rosetta 3 measurement history

The later [verified four-tier report](../rosetta-final-2026-11-27/README.md) records all four strict gates passing on one engine, `ff0275e`, published as `08259cd6`. This development history preserves the earlier failures and regressions unchanged.

These reports retain both improvements and regressions. Each measured engine
revision is identified in `index.json` and its adjacent provenance file. A
measurement-only process exit does not assert an all-pass result. All counts
are based on unmodified Rosetta `80f3c13ce48dc3318d5d49f54958f580937ca8aa`,
Luau 0.747 and transform-2 with the standard six profiles for each tier.

| Engine checkpoint | Quick | Full | Hard Quick | Hard Full |
| --- | ---: | ---: | ---: | ---: |
| Original main `9d4f03f` | 511/882 | Not measured | 102/882 | Not measured |
| Published checkpoint 3, local `c5cb88e` | 882/882 | 12,098/12,276 | 842/882 | Not measured |
| Intermediate `489ce27` | Not measured | Not measured | Not measured | 11,850/12,276 |
| Regression checkpoint `764ca6d` | 868/882 | Not measured | 751/882 | Not measured |
| Intermediate `50d6d96` | 872/882 | Not measured | Not measured | Not measured |
| Checkpoint `387a3c1` | 882/882 | 12,272/12,276 | Not measured | Not measured |
| Checkpoint `84a7e16` | Not measured | Not measured | 882/882 | Not measured |
| Checkpoint `155d581` | 882/882 | 12,276/12,276 | 882/882 | 12,274/12,276 |

The complete [checkpoint-10](checkpoint-10/README.md) measures all four tiers
on the same clean engine `155d581`, published as `492773f6` with an identical
Git tree. Quick, Full and Hard Quick passed their strict gates. Hard Full
failed its strict gate with two mismatches: `mut1-316` and `mut1-478`, both
at `O0g2+x2`. There were no decompilation/recompilation failures or refusals
in this checkpoint. The raw reports preserve these failures; this is not
an all-four-tier passing result.

The separate `targeted-development` directory records checks against sources
that failed an earlier suite. Its checkpoint-6 report has 1,350/1,440 passing
Hard profiles across 240 sources, with 20 decompilation failures, one recompilation
failure and 69 mismatches. This is a development corpus, not a Hard Full score.
The source manifest retains its origin and hashes. Full-suite scores are never
inferred by adding those recovered cases to an earlier engine's result.
The checkpoint-8 replay improves the same corpus to 1,436/1,440: three
mismatches and one recompilation failure, with no decompilation failures or
refusals. Its four remaining profiles are retained with the report.

The c5 source tree is identical to published GitHub commit
`8adfb799c40f390ca9e04f700110a7ad19f6fb40`. Its required Node 20/22,
official parser/runtime, demo and strict Rosetta Quick CI checks passed. Later
engine fixes require their own integrated measurements; this historical table
does not combine tier scores into a claim that one final build passes all tiers.
Full and Hard Full each exclude the suite's six original seed1541 profiles
which exhaust the execution step budget before producing usable reference
executions; no candidate failures are excluded.

`published-comparison.json` records the exact Rosetta-published luacid.dev and
lua.expert snapshots, their creation dates, source URLs, report hashes and suite
hashes. These are published measurements, not new requests to either service.
Timing should not be compared across those remote services and our local direct
CLI runs. Accuracy comparisons require matching suite hashes and profile sets.

The later targeted check of all 51 sources failing Full at c5 is retained under
`../permuted-call-identity-2026-11-27`: 306/306 profiles pass. It is a development
regression check and does not replace a new complete Full measurement.
