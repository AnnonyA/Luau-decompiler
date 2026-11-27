# Rosetta upstream snapshot remains comparable

Compared the pinned Rosetta commit [`80f3c13`](https://github.com/Scrensayol/rosetta/commit/80f3c13ce48dc3318d5d49f54958f580937ca8aa) with
[`c5a0974`](https://github.com/Scrensayol/rosetta/commit/c5a09742a72ee163901692de3ab58822fe54bfdb), published at 2026-11-27 18:47:15 UTC.
The [complete comparison](https://github.com/Scrensayol/rosetta/compare/80f3c13ce48dc3318d5d49f54958f580937ca8aa...c5a09742a72ee163901692de3ab58822fe54bfdb) contains one commit and 26 changed paths.
Verification used both the GitHub compare API and an independent bare clone. The checkout
used by measurements remains at the original pin, with no tracked changes.

## What changed

The README and result index now show separate Composite Luau and Rust backends.
The former Composite result and gallery files were replaced with files for those
two backends. Every change is confined to that documentation and those result files.

The harness source, generator, transforms, compiler binding, handwritten corpus,
library implementations/specifications, adapters, Cargo manifest and lockfile are
byte-identical. In particular, these Git object IDs are the same at both commits:

| Path | Git object SHA |
| --- | --- |
| `src` | `88865dce901130416f376810418e3cb2a6d5bee7` |
| `cases` | `f68536a04f42408f4b8847f1d656a052bd10a168` |
| `libraries` | `771769d274eb1d17e894172d2dfd66f105b241a5` |
| `adapters` | `838c1096b488b468be588e8f58abb07bd24dc5c0` |
| `.github` | `aa1463e1724aa8c9469585f9cb1c5d578d3186d3` |
| `Cargo.toml` | `4b4a5a2ccb58c86b2ed351cbf8d06afa50677acf` |
| `Cargo.lock` | `5a97128ac9a1f734cf392e0aa588293bfa16e507` |

## Published competitor reports

All eight Luacid and lua.expert reports are byte-identical. Equality was checked
both by Git blob ID and by comparing the complete bytes; their SHA-256 values,
profile lists, scores, totals, source dates and both pinned URLs are recorded in
`benchmarks/results/rosetta-upstream-2026-11-27/comparison.json`.

| Decompiler | Quick | Full | Hard Quick | Hard Full |
| --- | ---: | ---: | ---: | ---: |
| Luacid | [879/882](https://github.com/Scrensayol/rosetta/blob/c5a09742a72ee163901692de3ab58822fe54bfdb/site/results/luacid-quick.json) | [12,237/12,276](https://github.com/Scrensayol/rosetta/blob/c5a09742a72ee163901692de3ab58822fe54bfdb/site/results/luacid-full.json) | [353/882](https://github.com/Scrensayol/rosetta/blob/c5a09742a72ee163901692de3ab58822fe54bfdb/site/results/luacid-hard-quick.json) | [5,622/12,276](https://github.com/Scrensayol/rosetta/blob/c5a09742a72ee163901692de3ab58822fe54bfdb/site/results/luacid-hard-full.json) |
| lua.expert | [882/882](https://github.com/Scrensayol/rosetta/blob/c5a09742a72ee163901692de3ab58822fe54bfdb/site/results/lua-expert-quick.json) | [12,167/12,276](https://github.com/Scrensayol/rosetta/blob/c5a09742a72ee163901692de3ab58822fe54bfdb/site/results/lua-expert-full.json) | [264/882](https://github.com/Scrensayol/rosetta/blob/c5a09742a72ee163901692de3ab58822fe54bfdb/site/results/lua-expert-hard-quick.json) | [3,859/12,276](https://github.com/Scrensayol/rosetta/blob/c5a09742a72ee163901692de3ab58822fe54bfdb/site/results/lua-expert-hard-full.json) |

The four suite hashes also remain exactly equal to the decompiler repository pin:

| Tier | Suite hash |
| --- | --- |
| `quick` | `e24826907050bd1d` |
| `full` | `f0eae8ffcedd440e` |
| `hard-quick` | `9bcb49d29e867a92` |
| `hard-full` | `9921d3bde4a99bfd` |

This comparison validates the published snapshot as the same benchmark basis.
It does not claim a fresh live run of either external service or change any engine
score. Quick has 882 usable round trips; Full has 12,276, with the same six unusable
original seed1541 profiles excluded by the upstream harness.
