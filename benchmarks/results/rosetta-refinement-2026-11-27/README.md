# LUVEX Quick reconstruction refinement

**Quick source similarity improved from 76.92827095114995% to
77.49586128999316%, while all 882 behavioral pairs pass. The 100% source
similarity target remains unmet.** This report measures Quick only; it does
not replace the earlier Full or Hard results.

## Integrated result

| Measure | Published baseline | This Quick checkpoint |
| --- | ---: | ---: |
| Behavioral passes | 882/882 | **882/882** |
| Source similarity | 76.92827095114995% | **77.49586128999316%** |
| Geometric normalized-token ratio | 0.9927495865084095 | **0.9820264838255065** |
| Excluded or unusable Quick originals | 0 | **0** |

The similarity gain is **0.56759033884320 percentage points**. The token ratio
is approximately 98.20% of the original; it is not a file-byte measurement.
Behavioral equivalence on this finite corpus and source similarity are distinct
measurements. No competitor was rerun, and no new ranking is claimed.

The [raw Rosetta result](quick-final/annonyA-quick.json),
[provenance](quick-final/annonyA-quick.provenance.json),
[compact summary](quick-final/summary.json) and
[hash manifest](quick-final/SHA256SUMS) preserve the exact execution. The
[previous four-tier report](../rosetta-source-similarity-2026-11-27/README.md)
remains the historical baseline.

## Engine changes

- Recover shared short-circuit guards from CFG/SSA evidence, emitting a body
  once while preserving conditional evaluation and live values.
- Preserve copied register values before the first reference capture opens
  their source cell to writes from child functions.
- Restore a complete constant table template's original key order without
  reordering nonconstant evaluations or changing its allocation shape.
- Retain the preceding boolean-selection, primitive-region, parallel-store,
  iteration-continuation and runtime-call improvements. Constructor repairs
  preserve loader values, key identity and observable function names.

These are general transformations and correctness fixes. The engine never
reads benchmark sources, expected outputs, program names or mutation labels.
Default options, the Rosetta scorer, corpus, deadlines and validators remain
unchanged. Individual candidate gains are not added together: the table above
comes from one strict execution of the combined engine.

## Validation of the measured engine

| Gate | Result |
| --- | ---: |
| Strict Quick, original six profiles | **882/882** |
| Unit tests, Node 20.20.2 | **1,917/1,917**, 157 files |
| Unit tests, Node 22.23.5 | **1,917/1,917**, 157 files |
| Demo build and worker/startup tests | Build passes; **6/6** tests |
| Integrated native controls, two official compiler/VM pins | **96/96** profile checks |

The native controls execute the sealed original bytecode and the recompiled
output with exact stdout, stderr and return-status comparisons. They exercise
guard effects and rollback, captures and retained copies, table iteration,
function identities and scalar/multiple-return behavior. The 96 checks include
the shared `rejected-state` fixture in both guard and capture archives; there
are **72 distinct compiler-pin/input-hash pairs**, not 96 independent sources.
[Native summary](quick-final/native-summary.json),
[complete observations](quick-final/native-observations.tar.gz), and
[member hashes](quick-final/native-members.json.gz) retain that distinction.

First independent failures remain in their original feature reports. The
integrated capture fix now closes the four failures that were still present
in the isolated shared-guard candidate. This does not relabel its earlier
32/36 result.

## Provenance and reproduction

- Published measured engine: [`d3660e3`](https://github.com/AnnonyA/Luau-decompiler/commit/d3660e3c6b0db9426eb079d62ca313462edab831), with a Git tree verified identical to the measured local revision.
- Measured local revision: `232332339cf07211e791a6a67bd395a2031b20a5`.
- Measured Git tree: `14632ab47e761ef11e2d4c669743f08082181223`.
- Engine source SHA-256: `e075f486e9f0fd2c5fb9e6ccab80797b495e778b9742e602404a3ed8baecaff4`.
- Built distribution SHA-256: `e462be288491b55f4abaa5db89e06494576e7bf4a1bb8ba90cd9895c72a3804a`.
- Rosetta: `80f3c13ce48dc3318d5d49f54958f580937ca8aa`, suite `rosetta-3`.
- Quick suite hash: `e24826907050bd1d`; 147 programs at six profiles.
- Rosetta compiler/VM: Luau 0.747, `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`.
- Additional native pin: `9d7748a4f324213a18cb8283fa2a77c330225fa0`.
- Benchmark runtime: Node 22.23.5, three workers, clean immutable checkout.

```sh
node scripts/bench-rosetta.mjs --rosetta-dir /path/to/pinned-rosetta \
  --tier quick --threads 3 --gallery --out /path/to/new-result-directory
```

The publication contains these engine sources unchanged, followed by evidence
and documentation. The recorded checkout was clean before measurement; later
report additions do not alter that recorded state.

## Remaining work and rejected experiments

The remaining gap includes optimized-away expressions and dead code, copied
helper regions, call boundaries needed to preserve runtime observations, and
structural differences that are not yet reconstructed. The
[remaining-region analysis](../../../docs/references/remaining-inline-recovery.md)
and [Quick investigation](../../../docs/references/quick-remaining-gaps.md)
distinguish observed opportunities from proved rewrites.

A wide-argument folding prototype initially gained 0.04137 points but failed
all six compilations of an independently authored register-pressure control.
The corrected conservative version gained only 0.00498 points. The entire
feature was rejected; its first failures, source pairs and measurements are
[preserved](development/wide-arguments-rejected/decision.json). Other rejected
projections likewise remain separate from the accepted engine.

[Authored bytecode-collision examples](../source-recoverability-2026-11-27/README.md)
demonstrate that different token sequences can compile to identical input.
This rules out a general promise of exact source recovery; it does **not**
establish a numerical ceiling for this particular Rosetta corpus. Neither
90% nor 100% source similarity is claimed by this checkpoint.
