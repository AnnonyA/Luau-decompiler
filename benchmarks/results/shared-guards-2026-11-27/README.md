# Shared short-circuit bodies: Quick observations

The bounded CFG change emits one original common body behind an `or` guard
instead of duplicating it in two source branches. See the
[proof and pinned references](../../../docs/references/shared-guards.md).
The work follows the active Quick-only scope; no Full or hard suite was run.

## Strict result and exact metric

| Measurement | Passed | Source similarity | Token ratio |
|---|---:|---:|---:|
| Diagnostic base `2b2f5b4` | Not a behavioral measurement | 77.2670081278% | 0.9865955905 |
| Strict Quick, base plus shared-guard change | 882/882 | 77.4395572963% | 0.9831333064 |

All 246 case profiles, 36 library profiles, 300 generated profiles and 300
mutant profiles passed. Mismatch, decompile, recompile, refusal and unusable
counts are zero. The strict validator checked totals and suite identity in
addition to the process exit status. The strict result agrees with the exact
diagnostic replay: 76 profiles improved and none lost similarity, a mean gain
of 0.1725491685 percentage points. The ratio is output tokens relative to
original tokens; a smaller ratio does not by itself mean more faithful source.

The run measured the working implementation before its evidence commit, as the
provenance explicitly records:

- Base revision: `2b2f5b4d3b0cb83102ad83183ff2d6aaa3c556fa`.
- Engine source SHA-256: `8bbf321b80ab21dd2ca5651a9ac0d54f07a9736fddb430404f9c4d7162e80827`.
- Built distribution SHA-256: `146bd95fa2a0f4bb7c0e5bbcb0a1ed32849e04471f1ed683f3ad109bebfa954d`.
- Rosetta pin: `80f3c13ce48dc3318d5d49f54958f580937ca8aa`; Quick hash `e24826907050bd1d`.
- Runtime: Node 22.23.5; default decompiler options, direct process invocation.

The complete [raw result](annonyA-quick.json),
[provenance](annonyA-quick.provenance.json),
[diagnostic comparison](diagnostic-comparison.json) and
[runner log](strict-quick.log) are preserved unchanged.

## Authored behavior and first failures

The two positive sources test lookup and comparison order, short-circuiting,
exceptions, NaN, a generic loop's existing follow phi, table updates and fixed
return arity including nil. They pass all 24 combinations of two pinned
official compiler/VM revisions and O0/O1/O2 with g1/g2, before and after the
change. See [first observations](authored-first-baseline.json),
[candidate observations](authored-isolated-candidate.json), and the
[comparison](authored-comparison.json).

The rejection source additionally covers a closure that mutates captured state
and a nested loop creating cells. It exposed four pre-existing failures among
its 12 profiles: a saved copy was made to read the later mutated cell. The
isolated candidate has the same four failures, with byte-identical output for
all 12 profiles of that source. Consequently the complete authored table is
**32/36**, not 36/36. The separate fix is
`b63f3a32b8359a4256bbaaea393cb4541da2934a`; it is not included in the source
hash or results in this directory. The final integration must validate that
fix together with this change.

Independent review found an additional defect in the first uncommitted
prototype: rejecting a second guard that needed a stored read left that block
marked as emitted. The small synthetic
[first observation](rollback-first-observation.json) is retained. The fixed
[observation](rollback-corrected-observation.json) produces the exact baseline
source, including the stored property read and both callback paths. The
corresponding regression and proof exclusions are in `shared-guards.test.ts`.

All original authored bytecodes and source hashes are in
[`tests/fixtures/shared-guards`](../../../tests/fixtures/shared-guards/manifest.json).
The focused tests include 49 proof/rejection checks and 36 immutable fixture
checks, plus the 101 previous continuation checks: **186/186 passed**.
The complete unit suite also passed: **1,870/1,870 tests in 154 files**,
recorded in [unit-all.log](unit-all.log).
Independent review approved the final bounded CFG, state restoration and
short-circuit contract. It did not approve broader geometry or opcode coverage.

These results establish this measured Quick behavior and bounded improvement.
They do not establish 100% source recovery or a new result for another tier.
