# Quick source round 2 — integrated results

The integrated engine improves Rosetta 3 Quick source similarity from
**77.49586128999316% to 77.63762703152742%**, a gain of
**0.14176574153426 percentage points**. Strict Quick and Hard Quick each pass
**882/882** original profiles. The **100% source target remains unmet**.

These runs measure local revision `eba3c9971283a322e2e300834a6cc95fdd437b9c`.
The immutable GitHub engine commit
[`4193d35293b1e9ed7313944ab02d98821a48a795`](https://github.com/AnnonyA/Luau-decompiler/commit/4193d35293b1e9ed7313944ab02d98821a48a795)
has the exact same tree, `39d7488ed74721a378d1a9658af7b778588d19ba`.
Original receipts retain the measured local revision; documentation published
on top of that engine does not replace its identity. This round began on
November 27; the integrated runs completed on November 28, 2026 UTC.

## Strict Rosetta results

| Measurement | Previous Quick | Integrated Quick | Integrated Hard Quick |
| --- | ---: | ---: | ---: |
| Behavioral passes | 882/882 | **882/882** | **882/882** |
| Source similarity | 77.49586128999316% | **77.63762703152742%** | **77.02314934425073%** |
| Output/original normalized tokens | 98.20264838255065% | **97.74616147072638%** | **98.29621600704698%** |
| Decompile, recompile, mismatch or refusal results | 0 | **0** | **0** |
| Unusable or excluded originals | 0 | **0** | **0** |

The baseline is `fc6e10a88bfc97a04c53e6a2651977e5c6b50051`. The baseline strict run uses Node **24.22.3**; integrated Quick and Hard Quick
use Node **22.23.5**. They retain unchanged default options and the pinned
Rosetta scorer.
Rosetta revision is `80f3c13ce48dc3318d5d49f54958f580937ca8aa`, suite
`rosetta-3`, Luau **0.747**, transform `transform-2`; suite hashes are
`e24826907050bd1d` for Quick and `9bcb49d29e867a92` for Hard Quick.

[Quick baseline](raw/baseline-quick/annonyA-quick.json),
[integrated Quick](raw/integrated-quick/annonyA-quick.json), and
[integrated Hard Quick](raw/integrated-hard-quick/annonyA-hard-quick.json)
are unmodified benchmark results. Their adjacent provenance files record
commands, immutable engine/source hashes, process exit status, corpus pins,
forbidden-override checks and all-pass validation. Normalized-token ratios
are not file sizes, and behavioral passes do not imply identical source.
These are finite-corpus results.

**Full and Hard Full were not rerun for this engine.** Their
[historical four-tier results](../rosetta-source-similarity-2026-11-27/README.md)
remain attributed to their original revisions.

A paired diagnostic replay of the same 882 Quick bytecodes finds **427 higher,
361 equal and 94 lower** source scores; 521 output texts change. The aggregate
matches the strict Quick result. `diagnostic/paired-quality.json.gz` retains
input/output hashes and both quality vectors without copying original Rosetta
source. The separate baseline receipt is the 77.49586128999316% baseline:
the older 72.29585% `baselineQuality` and `deltas` embedded inside replay
receipts are historical and are not used for this comparison. Replay rows
remain marked `behaviorVerified: false`; the strict runs establish the
behavioral results above.

## Engine changes

- Present adjacent, private named closures in matching record fields only when
  lexical binding, use count, capture identity and ordered creation permit it.
  Preserve uniform groups of named exports and potentially throwing table
  stores before closure creation.
- Recover a scalar conditional value from a private literal default followed
  by one guarded store, preserving lazy effects, false/nil distinctions and
  NaN-sensitive comparisons.
- Present supported `%*` formatting as interpolation while preserving scalar
  contexts and parser-valid escapes; retain terminal loop-exit guard structure.
- Refresh the environment used by repeat-loop conditions so a previous call's
  boolean result is not reused as the next callee.
- Preserve prototype names through aliased exports and existing closure
  factories/dispatchers without allocating a record or introducing a frame.
  Exact-name declarations require a proof that they do not bind a previously
  free reference with the same name.

These are general bytecode/AST transformations. No original-source lookup,
benchmark identifier rule, scorer change or exclusion was added.

## Native controls on the integrated engine

All rows below were re-executed against the same frozen integrated engine,
not inferred from component branch results. Each original bytecode is compared
with recompiled output using exact exit status, stdout and stderr on its
matching native VM. Both official Luau pins are used:
`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f` and
`9d7748a4f324213a18cb8283fa2a77c330225fa0`.

| Authored controls | Valid originals | Baseline matches | Integrated matches |
| --- | ---: | ---: | ---: |
| Interpolation and format semantics | 24 | 24 | **24** |
| Loop exits, repeat conditions and captures | 24 | 12 | **24** |
| Guarded literal values, effects and scope | 24 | 24 | **24** |
| Named table closures, aliases and return packs | 36 | 24 | **36** |
| Closure names with a homonymous free global | 12 | 0 | **4** |
| Closure allocation with GC stopped after loading | 8 | 8 | **8** |
| **Total valid profiles** | **128** | **92** | **120** |

The **eight failures remain pending** in the homonymous-global group. O0
still emits allocator-suffixed function names; O2 still loses the factory's
name and identity in a separate repeated-record path. All four O1 profiles
match. The report does not claim universal debug-name or closure-identity
recovery.

All eight valid allocation profiles report `allocation 0`. The **four O0
allocation originals are invalid** because their own assertion assumes cached
function identity. Their original errors and bytecode hashes are retained,
but they are excluded from the 128 valid inputs and have no candidate PASS.
The allocation host stops collection after loading and uses the official
`gcinfo` builtin; its source and exact executable hashes are recorded.

`native/` contains current integrated summaries and receipts.
`native/observations.tar.gz` retains authored sources, hashes, commands,
observations and reconstructed outputs, with a compressed content index.
It excludes engine distributions, snapshot bundles and host executables.
These are development controls, not an independent held-out corpus.

## Local validation and remaining gates

| Local check | Node 20.20.2 | Node 22.23.5 |
| --- | ---: | ---: |
| Unit tests | **2,037 / 162 files** | **2,037 / 162 files** |
| Type checking and build | **Pass** | **Pass** |
| Benchmark harness tests | **69/69** | **69/69** |
| Demo build and worker/startup tests | **Pass, 6/6** | Not separately rerun locally |

Node 20 used an isolated, lockfile-pinned offline install. The demo's static
engine matched its built distribution and recorded the integrated revision.
Exact commands, statuses and compressed logs are in `validation/`. The
[hash-convention receipt](validation/node20/hash-conventions.json) confirms
that the Node 20 and Node 22 builds contain the same JavaScript files; the
original receipt hashes use different serialization conventions.

This package makes **no GitHub Actions or browser CI pass claim**. The local
browser test was blocked because the Chromium launcher lacked its executable.
The shared LunaUX 22-input gate was not run because its pinned checkout was
absent; both omissions are preserved in the Node 20 receipt. Exact-revision
CI must satisfy the required remote gates before merging.

Strict timing includes Node startup and direct CLI decompilation for each
bytecode. The raw Quick run took 83.38 seconds versus 78.94 seconds for the
baseline; Hard Quick took 69.07 seconds. The baseline and candidate use different Node versions, and concurrent local
validation can affect elapsed times. These single measurements establish no
performance improvement or regression guarantee.

## Retained first failures and rejected work

Component reports remain unchanged and preserve the initial observations:

- [Named-table closure ordering](../named-table-closures-2026-11-27/README.md),
  including the nil/NaN-key cache-priming counterexample.
- [Expression presentation](../expression-presentation-2026-11-28/README.md),
  including the first repeat-condition failures and rejected interpolation
  parser output.
- [Guarded literal selects](../guarded-literal-selects-2026-11-27/README.md),
  including sealed effect/capture/arity controls.
- [Closure debug names](../closure-debug-preservation-2026-11-28/README.md),
  including the rejected table wrapper that added 31 KiB in the allocation
  control, the first native failures and the still-pending homonym cases.

Two primitive-helper recovery experiments changed none of the 882 Quick
outputs and were excluded. Their experiment commit `7c1c8e1` remains separate
from the accepted engine. A further
[scalar-return-region experiment](rejected/scalar-return-regions/README.md)
also produced 882 identical outputs and was rejected. Its 36/36 authored
end-to-end controls do not erase a separate, unfixed AST DAG counterexample
that fails all 12 compiler profiles. Neither experimental population is
counted in the accepted engine's 128 native controls; its isolated commit
`bb314c1ae926e91204ba7f033cc7e287a5a55962` is not part of the measured engine.
No observed failure was erased or relabeled as a pass. `SHA256SUMS` covers
every file in this package.
