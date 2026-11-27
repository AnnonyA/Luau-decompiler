# Preserve short-circuit paths to a repeat backedge

References inspected for this independent TypeScript repair:

- Official Luau 0.747, `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`:
  `Compiler/src/Compiler.cpp`, `compileConditionValue` and `compileStatRepeat`;
  `VM/src/lvmexecute.cpp`, JUMPIF/JUMPIFNOT truthiness and JUMPBACK.
- Tovek, `ce2ea3325547fa3896f274b68013386338039040`, MIT license, copyright
  Jujhar Singh and Mathias Pedersen: `restructure/src/region.rs`,
  `build_conditional_inner` and `reaches_in_iteration`. These distinguish
  within-iteration joins and guard paths from the next iteration's header.
- Rosetta `80f3c13ce48dc3318d5d49f54958f580937ca8aa`, rosetta-3, Luau 0.747.

No reference implementation code was copied or adapted. The repair uses the
project's existing dominator tree and source-level exit/continue reconstruction.

## Failure and invariant

A compound `until` condition can branch directly to the pure backedge when
an earlier `and` operand is false. The final condition block therefore need
not execute on every iteration. Emitting that block as an unconditional `until`
test previously changed both control flow and observable calls: a skipped
truthy NaN ended the loop early, or a skipped `finish()` call ran anyway.

Before moving a condition block out of the body, `emitRepeat` now requires it
to dominate the latch. Otherwise each original conditional exit/continue stays
inside the repeat body, with `until false` as the fallthrough. Existing cleanup
can subsequently recover a short-circuit expression when it proves safe. No
new expression is speculated, no call changes evaluation position, and body
locals retain their repeat scope. The dominating-test path remains unchanged.

## Sealed regressions and observations

The baseline is source commit `40ff1d5cc6fd6677a9687b2230f158d5dec2e2a1`.
All project-authored programs are sealed with original source, six O0/O1/O2,
g1/g2 bytecodes and SHA-256 hashes under `tests/fixtures/rosetta-repeat-paths`.

| Program | Baseline | Candidate | Contract observed |
| --- | ---: | ---: | --- |
| `repeat-short-circuit-latch` | 4/6 | 6/6 | Three iterations, captured outer counter, ordered trace, nil/multiple returns |
| `repeat-gated-call-effects` | 2/6 | 6/6 | `finish` skipped when `ready` is false, zero truthiness, call order, table alias identity |
| `compound-repeat-gates` | 6/6 | 6/6 | Fresh mutable captured body cells and nil/multiple returns |
| Rosetta generated `seed1086` | 4/6 | 6/6 | Complete generated source and trace |
| **Total** | **16/24** | **24/24** | Official compiler/VM round trips |

The unmodified first failing reports, complete input/output traces and candidate
report are retained in `benchmarks/results/rosetta-repeat-paths-2026-11-27`.
The complete generated inputs come from `rosetta gen 1042` and `rosetta gen 1086`,
not the failure gallery. Their origin and hashes are recorded beside them.

`seed1042` is a separate cleanup failure: reconstruction before cleanup passes
all six official profiles, while the supplied full-pipeline baseline fails O0.
Its first failure and raw-reconstruction observation are preserved here for the
coordinated NameInference repair. This bounded emitRepeat change does not claim
to repair that separate naming issue by itself.

Unit tests verify sealed bytes, lexical scope and both short-circuit outcomes
with observable mock callees; official execution covers full program behavior.
Measurements used Node 24 locally. These are development regressions, not
independent holdouts or a completed Rosetta tier score.
