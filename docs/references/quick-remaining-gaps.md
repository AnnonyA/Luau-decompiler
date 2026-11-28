# Remaining Quick similarity gaps

Status: read-only investigation closed on 2026-11-28. **100% source similarity
has not been reached.** These measurements do not establish that it is
impossible. Subsequent integrated results require their own independent
reports; none is inferred from these projections.

## Measured baseline

The unchanged strict Quick run of `885eb08` passed **882/882** profiles with
**77.25692801599871%** similarity and **0.9854781501051265** normalized token
ratio. The independent diagnostic replay reproduced the similarity exactly.
Token ratio describes normalized tokens, not file bytes. The
[archived baseline receipt and provenance](../../benchmarks/results/quick-remaining-gaps-2026-11-28/README.md)
identify the full commit, original result hash and immutable engine snapshot.

## Rejected non-adjacent temporary folding

The census considered a single-use temporary whose consumer follows one or
more writes to other private locals in the same block. It projected all
**300 generated profiles**; the remaining **582 Quick profiles** were left
unchanged when calculating the global mean. Original source was used only by
the unchanged Rosetta scorer, never to choose a transformation.

| Diagnostic projection | Moved declarations | Affected profiles | Global similarity delta |
| --- | ---: | ---: | ---: |
| Primitive result, intervening inert stores | 17 | 13 | +0.00111444 pp |
| Also allow unknown result types | 46 | 37 | +0.00447028 pp |
| Also cross potentially effectful stores | 1,063 | 226 | +0.02321059 pp |

**None is runtime-certified or an engine change.** The third projection is
intentionally unsafe sensitivity, not an implementation proposal. The second
also leaves result lifetime and runtime equivalence unproved. Even the first
requires authored execution controls before it could become a candidate.
All three fall far below the **0.5 global percentage point** threshold chosen
to justify another substantial analysis pass. This closes this bounded
approach; it is not a universal upper bound on future temporary recovery.

The diagnostic retained source/debug declaration evidence, the existing
folded-expression weight limit of 40, and the baseline evaluation-prefix and
scalar list-tail rules. It rejected captured or rewritten temporaries,
control-flow gaps, unresolved operand bindings, writes to operand bindings,
and function/table/vararg allocations in the moved expression. Primitive
types came from actual literals, immutable initializers and numeric-for
bindings, not annotations. These restrictions explain why apparently large
temporary counts do not translate into a large proven opportunity.

The [compact evidence](../../benchmarks/results/quick-remaining-gaps-2026-11-28/README.md)
retains the executed script, all 300 numeric records, transformation events,
input/output hashes, exact aggregate calculations and the original run log.
The first complete source/output records remain intact at the recorded
scratch paths; they are not duplicated in this archive.

## Earlier hypotheses and semantic controls

The broader fixed-arity, pure-helper call analysis was already rejected:
its older `850211e` diagnostic gained only **0.03276733 pp** while duplicating
the existing `ClosureEffects.neutral` proof with about 180 analysis lines.
It was not behaviorally verified and is not part of the engine. See the
[original decision](../../benchmarks/results/variadic-call-boundaries-2026-11-27/diagnostic-only/decision.json)
and [call-boundary notes](compact-call-boundaries.md). No new version of that
experiment was run for this note.

Correctness repairs remain worthwhile independently of similarity. The
separate first-REF-capture repair preserves a copied value before a closure
can mutate its source. Its unchanged authored controls improved from
**24/36 to 36/36** across both native Luau pins, and **1,804/1,804** unit tests
passed. Its isolated Quick diagnostic gained **0.00047125 pp** over `885eb08`;
that is not a strict result for the next combined engine. The
[repair report](../../benchmarks/results/ref-alias-promotion-2026-11-27/README.md)
preserves the initial failures and exact observations.

The [earlier inlined-region investigation](remaining-inline-recovery.md)
documents a larger unresolved family, using its own older baseline. Restoring
whole copied regions still needs explicit proofs for effects, arity, frames,
environments, capture inventories and closure identity. Incidence alone does
not justify a transformation. No Full or Hard benchmark was added in this
investigation; the current priority remains Quick.
