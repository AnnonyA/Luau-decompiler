# Control-flow invariants exposed by Rosetta 3

The independently implemented TypeScript changes consult these exact sources:

- Tovek `ce2ea3325547fa3896f274b68013386338039040`, MIT license:
  `restructure/src/region.rs` (`read_while_candidate`, terminal ownership and
  loop continuation) and `luau-lifter/src/lifter.rs` (generic iterator triples).
- Official Luau 0.747 `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`:
  `Compiler/src/Compiler.cpp` (`compileStatWhileLocal`, `compileStatRepeat`,
  `compileStatIf`) and `VM/src/lvmexecute.cpp` (`LOP_FORGPREP_NEXT` and
  `LOP_FORGPREP_INEXT`).
- Rosetta `80f3c13ce48dc3318d5d49f54958f580937ca8aa`: unchanged compiler/VM
  harness, suite `rosetta-3`, including experimental local condition bindings.

No implementation code was copied from Tovek or Luau. The invariants are fitted
to this project's existing CFG, SSA definitions and lexical binding ownership.

1. A test before a backedge is an `until` position only when the remaining latch
   has no body work. A short-circuit entry condition can otherwise hide updates
   after the final test, and classifying it as repeat drops those updates.
2. A nested conditional must respect its enclosing region's join. Consuming a
   shared iteration tail in an inner arm and again after the outer branch doubles
   its effects. Reachability is bounded by dominator backedges, not physical PCs.
3. Every generic prep uses the generator, state and control triple. An optimized
   NEXT/INEXT instruction does not establish that all three came from one call.
   Omitting trailing call results requires the actual reaching SSA producer.
4. Repeat-condition setup belongs after continuing body alternatives rejoin.
   Reading its operand from the environment restored before an earlier branch
   can substitute a different value in the same register.
5. Intermediate read/modify/write instructions update a loop-carried lexical
   accumulator even when only the final write directly feeds the backedge phi.
   A debug range beginning between those writes cannot create a shadow cell.
6. A numeric loop whose body always breaks or returns has no reachable backedge.
   The matching FORNPREP/FORNLOOP pair still owns its zero-or-one-iteration body.
   Compiler jump threading can bypass a break-only body or leave an exit stub;
   pairing follows only NOP/JUMP control edges, never CLOSEUPVALS or register work.
   This additionally consults Tovek `find_numeric_loops` in `region.rs` and Luau
   `compileStatFor` in `Compiler.cpp`, at the exact revisions above.
7. A loop header's immediate post-dominator can be an internal predicate join.
   Its actual continuation is the first post-dominator outside the loop, not
   necessarily the exhaustion path. Inlined returns assign their result before
   jumping past the fallback, so their definitions must meet at that continuation.
   This additionally consults Tovek's `loop_continuation` and transfer-arm ownership
   and Luau's inline frame result targets and `compileInlineReturn`.
8. A single-block value dry run needs a direct edge to its claimed join. Mere
   reachability is insufficient: an intermediate test can replace a nil result
   with an `or` fallback. Unsupported multi-block value paths retain their
   ordinary statements and guards. This consults Tovek's shared-tail ownership
   and official Luau's `compileExprAndOr` at the same pinned revisions.
9. A compound while guard can have no single conditional header, and an early
   return can remove its common post-dominator. When its exits contain exactly
   one continuing block and direct terminal return blocks, that continuing
   block owns the code after the loop. The return remains attached to its body
   guard. This consults Tovek's `loop_continuation` and `is_return_block` and
   official Luau's `compileStatWhile`, independently using this project's CFG.

Five project-authored programs in `tests/fixtures/rosetta-control` are compiled
at O0/O1/O2 and g1/g2. Their hashes are recorded in the adjacent manifest.
`benchmarks/results/rosetta-control-2026-11-27/first-report.json` retains the first
comparison: base `9d4f03f` passed 12/30, the control-flow repair passed 30/30.
These are development regressions, not an independent holdout or a claim of
general CFG equivalence. Rosetta's first failures and reference inputs remain
unchanged in that evidence directory.

`terminal-numeric-for.luau` adds empty-range, break-only, nested and returning
numeric loop bodies. The first preserved official execution comparison in
`benchmarks/results/rosetta-terminal-numeric-2026-11-27` is base 0/6 and repaired
6/6. These checks include all three optimization and both debug levels.

`predicate-loop-result.luau` exercises an inlined predicate and value return
through a generic loop. Its preserved first comparison against the integrated
`05cb993` checkpoint passed 4/6 before and 6/6 after following the full
post-dominator chain; see `rosetta-loop-follow-2026-11-27` in benchmark results.

`nullable-selection.luau` checks a conditional nil value followed by a truthy
fallback in a call argument. Its first comparison against `3d0dd7c` passed 2/6
before and 6/6 after the direct-edge requirement. The preserved evidence lives
in `rosetta-nullable-selection-2026-11-27` in benchmark results.

`guarded-reservation-loop.luau` checks a compound entry guard, a returning
exhaustion branch and an outer loop tail. The first captured comparison failed
all six profiles before continuation selection was repaired; the later paired
comparison preserves the baseline and repaired executions in
`rosetta-guarded-reservation-2026-11-27`.
