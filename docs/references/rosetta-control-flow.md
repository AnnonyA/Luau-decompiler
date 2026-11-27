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

Five project-authored programs in `tests/fixtures/rosetta-control` are compiled
at O0/O1/O2 and g1/g2. Their hashes are recorded in the adjacent manifest.
`benchmarks/results/rosetta-control-2026-11-27/first-report.json` retains the first
comparison: base `9d4f03f` passed 12/30, the control-flow repair passed 30/30.
These are development regressions, not an independent holdout or a claim of
general CFG equivalence. Rosetta's first failures and reference inputs remain
unchanged in that evidence directory.
