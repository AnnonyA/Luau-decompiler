# Rosetta 3 source similarity results

These results use one frozen engine and the unchanged pinned Rosetta corpus. All four strict behavioral gates pass. The source-quality figures below belong to this measured engine, not an earlier diagnostic.

- Local engine: `326d85ed21c0a7bef6dcd07a26e38b49f0148a84`.
- Git tree: `596bd4510ff32ebb978dbfaf15d9814dbcc1b198`.
- Source SHA-256: `a34c6a6bad5fba17fa20fe7329fb448cf97952390a826a4185884b329cdc616b`.
- Built distribution SHA-256: `54cdc0eda358e7f06430db3d17bef3099b80bec39924347759946e06e7a7f921`.
- Rosetta pin: `80f3c13ce48dc3318d5d49f54958f580937ca8aa`.

Published engine: [`f9543bbb26615f50aa599cead318beb0f9a6e7a0`](https://github.com/AnnonyA/Luau-decompiler/commit/f9543bbb26615f50aa599cead318beb0f9a6e7a0). This evidence does not claim a merge or certify a later documentation head.

## Exact global measurements

| Tier | Behavioral passes | Baseline similarity | Measured similarity | Change, points | Baseline size | Measured size |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| [quick](annonyA-quick.json) | 882/882 | 72.2958506% | 76.9282710% | +4.6324204 | 1.1000265 | 0.9927496 |
| [full](annonyA-full.json) | 12,276/12,276 | 70.2723884% | 73.9126054% | +3.6402169 | 0.9666591 | 0.8755173 |
| [hard-quick](annonyA-hard-quick.json) | 882/882 | 71.8146284% | 76.3929140% | +4.5782856 | 1.1077325 | 0.9979335 |
| [hard-full](annonyA-hard-full.json) | 12,276/12,276 | 69.8927880% | 73.5312923% | +3.6385044 | 0.9718250 | 0.8771821 |

Similarity is the arithmetic mean of normalized-token alignment ratios over passing profiles. Size is the smoothed geometric mean of output/original token counts, not bytes or lines. All unrounded values, the other quality fields and the raw input hashes are in [comparison.json](comparison.json). No speed claim is made.

Full and Hard Full schedule 12,282 profiles. The six original seed1541 profiles exhaust the original VM step budget, leaving 12,276 usable profiles; they are explicitly reported as unusable rather than engine passes. Quick is a subset of Full, so the four counts are not independent samples.

The [sealed baseline](../rosetta-final-2026-11-27/README.md) engine is `ff0275ea025f150d73aa29e10f3f2b7b0111907a` with source SHA-256 `5f30831cc22670b8ab20822aa5a7a8d26785d8228e7408070669e6ada5dfd965`. Its raw-report and provenance hashes are recorded separately from the current results.

The size target is not improved uniformly. full: 87.55173% of original tokens geometrically, hard-full: 87.71821% of original tokens geometrically. These ratios move farther below 1 than the baseline; they must not be described as closer to the original size. A global ratio also cannot establish the size of any individual output.

The measured tiers have not reached 82.2% or 90% similarity. These remain engineering targets.

## Behavioral breakdown

| Tier | Cases | Libraries | Generated | Mutants |
| --- | ---: | ---: | ---: | ---: |
| quick | 246/246 | 36/36 | 300/300 | 300/300 |
| full | 246/246 | 36/36 | 5,994/5,994 | 6,000/6,000 |
| hard-quick | 246/246 | 36/36 | 300/300 | 300/300 |
| hard-full | 246/246 | 36/36 | 5,994/5,994 | 6,000/6,000 |

| Compiler/transform profile | quick | full |
| --- | ---: | ---: |
| O0g1 | 147/147 | 2,046/2,046 |
| O1g1 | 147/147 | 2,046/2,046 |
| O2g1 | 147/147 | 2,046/2,046 |
| O0g2 | 147/147 | 2,046/2,046 |
| O1g2 | 147/147 | 2,046/2,046 |
| O2g2 | 147/147 | 2,046/2,046 |

| Compiler/transform profile | hard-quick | hard-full |
| --- | ---: | ---: |
| O0g1+x1 | 147/147 | 2,046/2,046 |
| O1g1+x2 | 147/147 | 2,046/2,046 |
| O2g1+x3 | 147/147 | 2,046/2,046 |
| O0g2+x2 | 147/147 | 2,046/2,046 |
| O1g2+x3 | 147/147 | 2,046/2,046 |
| O2g2+x1 | 147/147 | 2,046/2,046 |

The machine-readable report also gives every section/profile cell. There are no new behavioral regressions against the sealed all-passing baseline.

## Published peers and comparable populations

| Tier | Peer | Peer passes / usable | Common passes | Peer own-pass similarity | Peer size | Source-quality populations identical? |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| quick | [luacid](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-quick.json) | 879/882 | 879 | 81.9176416% | 0.8961542 | No |
| quick | [lua-expert](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-quick.json) | 882/882 | 882 | 80.3179104% | 0.8802898 | Yes |
| full | [luacid](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-full.json) | 12,237/12,276 | 12,237 | 78.3191835% | 0.8011965 | No |
| full | [lua-expert](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-full.json) | 12,167/12,276 | 12,167 | 76.2844762% | 0.7736133 | No |
| hard-quick | [luacid](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-hard-quick.json) | 353/882 | 353 | 76.9726643% | 1.0520338 | No |
| hard-quick | [lua-expert](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-hard-quick.json) | 264/882 | 264 | 78.4064053% | 0.9185846 | No |
| hard-full | [luacid](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/luacid-hard-full.json) | 5,622/12,276 | 5,622 | 73.3241774% | 0.9815170 | No |
| hard-full | [lua-expert](https://github.com/Scrensayol/rosetta/blob/80f3c13ce48dc3318d5d49f54958f580937ca8aa/site/results/lua-expert-hard-full.json) | 3,859/12,276 | 3,859 | 74.6595729% | 0.8086054 | No |

Quick and lua.expert share the complete 882/882 passing population, so their aggregate source-quality measurements are comparable. In other rows the published peer aggregate covers that peer's own passes, while this engine covers all usable profiles. The exact common population is counted and hashed, but its quality cannot be recovered from these aggregate-only JSON files. Those rows support a coverage comparison, not a fair source-quality ranking or a source-quality win claim.

On that common Quick population, this engine scores 76.9282710% and lua.expert scores 80.3179104%; the difference is -3.3896394 percentage points.

The peer figures are published measurements from the pinned repository, not new requests to the services. Exact raw-report hashes are in comparison.json; prefixes and creation times below identify each input.

| Peer / tier | Report created (UTC) | Report SHA-256 prefix | Corpus hash |
| --- | --- | --- | --- |
| luacid / quick | 2026-11-26T14:50:42Z | `f6643dcc0ff0e0e2` | `e24826907050bd1d` |
| lua-expert / quick | 2026-11-26T14:41:27Z | `986203adbb2b6720` | `e24826907050bd1d` |
| luacid / full | 2026-11-26T18:45:15Z | `d625ffa9666675ac` | `f0eae8ffcedd440e` |
| lua-expert / full | 2026-11-26T16:06:58Z | `66242dfd1b1b48b2` | `f0eae8ffcedd440e` |
| luacid / hard-quick | 2026-11-26T15:08:03Z | `d419982abdff9bbe` | `9bcb49d29e867a92` |
| lua-expert / hard-quick | 2026-11-26T14:48:57Z | `c4c3d231673c6ee8` | `9bcb49d29e867a92` |
| luacid / hard-full | 2026-11-26T22:32:51Z | `2493c9d24ccd1b77` | `9921d3bde4a99bfd` |
| lua-expert / hard-full | 2026-11-26T17:22:33Z | `7d3f5893dac81679` | `9921d3bde4a99bfd` |

## Scope and limits

The pinned strict JSON exposes quality only at the global level. Its profile list and section/test verdicts support behavioral breakdowns, but do not provide individual quality. Accordingly, this report does not invent per-profile quality, per-section quality, quality regressions for individual programs, or our quality on a smaller peer intersection. Earlier per-profile diagnostics explain reconstruction opportunities but are not relabeled as final results.

Independently authored sources with different normalized token sequences can compile to identical bytecode after constant folding, dead-code elimination, erased type syntax or inlining. That rules out a universal guarantee of exact original-source recovery. It does not establish a numerical ceiling for this corpus, or prove that 82.2% or 90% is impossible.

The corpus is public and was used during development. Passing it is a finite behavioral result, not proof for every Luau program. Latest-head CI and any later documentation publication are tracked separately. Source/data identities and input SHA-256 values are included for review; the peer rows link the pinned public reports.
