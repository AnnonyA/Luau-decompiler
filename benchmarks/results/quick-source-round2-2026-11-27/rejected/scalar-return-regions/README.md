# Rejected bounded recovery of scalar search regions

This experiment is **not part of the released engine**. Its base is the
integrated checkpoint `eba3c9971283a322e2e300834a6cc95fdd437b9c`.

## Decision

The candidate produced **882/882 byte-for-byte identical Quick outputs** to
that checkpoint: similarity remained **77.63762703152742%**, a gain of **0.0
percentage points**. No corpus, scorer, options or admission guards were
changed to make this feature activate. The experiment is rejected for
integration because it provides no benefit toward the current Quick goal.

Independent review also found an AST transformation defect. If one identifier
object for the synthetic loop flag is reused in a later read outside the
region, the candidate's node-identity membership test mistakenly considers
both lexical occurrences consumed. The transformed program prints `3, nil`
instead of `3, false` in all **12/12** official compiler profiles. This is an
authored **AST DAG counterexample**, not a demonstrated end-to-end failure
from a bytecode input. It remains unfixed in this rejected prototype and is
preserved in `ast-dag-review.tar.gz` and `ast-dag-summary.json`.

## Bounded hypothesis

A retained local helper contains one generic-for loop with one guarded scalar
return and a literal fallback. Its inlined caller stores the scalar, clears a
synthetic loop-tail flag, breaks, and guards the fallback with that flag.
The experiment recognizes this complete region and restores a scalar call.

The proof deliberately accepts only a fresh literal array of primitive
entries, primitive inert arguments, a stable helper within its existing
function activation, one result, and uncaptured result/flag bindings. It
rejects arbitrary iterators, calls, metamethod-capable operands, nested loops,
return packs, and new helper captures. It does not rely on recompilation
inlining the new call or request optimization level 2.

The positive authored control activates the pass: a search over
`{2, nil, 6}` is reconstructed as `find({2, nil, 6}, 6)`. Therefore the zero
Quick delta is an absence of accepted Quick regions, rather than an entirely
inactive implementation. Arrays already materialized into bindings and
helpers not admitted by the existing bytecode-line evidence remain outside
this prototype. No estimate of future gain follows from those omissions.

## First independent native observations

The three project-authored sources were compiled and sealed before modifying
the engine. Their 36 bytecodes are 3 sources × 2 official Luau revisions ×
O0/O1/O2 × g1/g2. All 36 original executions succeed.

| Engine | First matching stdout/stderr/status | Total |
| --- | ---: | ---: |
| Integrated baseline | 36 | 36 |
| Experimental candidate | 36 | 36 |

The sources cover primitive search results, false/nil values, holes, effectful
arguments, an iterator observing its caller name, multiple-return packs,
nested loops, captured result cells, aliases and a rebound helper. The valid
end-to-end controls and the independent AST DAG counterexample are different
test populations; the latter is not hidden by the former's pass count.

`baseline-first.json.gz`, `candidate-first.json.gz` and their observation
archives preserve the first results, generated sources, compiled bytes,
commands, stdout and stderr. `fixtures/manifest.json` records the sealed
input and original source hashes. `reproduce-native.py` is the exact script
used; its recorded workspace paths identify its dependencies.

## Quality and provenance

`exact-output-comparison.json.gz` contains all 882 input identities and output
hash pairs, without original Rosetta source. `quick-comparison.json.gz`
contains only quality metrics and metadata. Both replay receipts retain the
unchanged empty query and options, compiler counts, engine snapshots and
scorer process status. A quality replay is not a behavioral release test.

The baseline JavaScript tree hash is
`6b7265185633c57656004439768262cc09b7167e90b2ba19ebe766c509bce9e5`;
the candidate replay hash is
`309b5a9bc4a4780f05c92752e5a62fa878dcdfef144cd2c4d4a536f9c3a39925`.
The two native observation snapshot manifests retain per-file hashes too.
`experiment.patch` contains the isolated engine diff; it is evidence, not an
approved patch to apply to the release.

Inspected official Luau revisions:

- `9d7748a4f324213a18cb8283fa2a77c330225fa0`.
- `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`.

The compiler's `tryCompileInlinedCall` gates and Tovek's
`ast/src/deinline_safety.rs` at
`ce2ea3325547fa3896f274b68013386338039040` were used as engineering references.
Tovek's license is MIT. The experimental TypeScript implementation is
independent; no competitor implementation was copied or adapted.
