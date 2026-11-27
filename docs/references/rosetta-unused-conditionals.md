# Preserve evaluation when both conditional edges have one destination

References inspected: Tovek `ce2ea3325547fa3896f274b68013386338039040`,
`ast/src/side_effects.rs` (`is_total_pure`) and `ast/src/if.rs`. A condition
cannot disappear merely because its body is empty: comparisons can call
metamethods, and evaluating operands can mutate state or raise. MIT license,
copyright Jujhar Singh and Mathias Pedersen. Official Luau 0.747
`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
`Compiler/src/Compiler.cpp` `compileStatIf` and
`VM/src/lvmexecute.cpp` JUMPIF/JUMPIFNOT and relational/equality jumps were
also inspected. The VM evaluates operands/comparison even when taken and
fallthrough destinations coincide. No implementation code was copied or adapted.

The reconstruction walker previously required two distinct CFG successors
before handling a conditional instruction. A comparison or truthiness jump
with one shared destination therefore lost its evaluation. Calls feeding
that instruction were still counted as used, so their deferred expressions
also disappeared instead of becoming unused-result statements.

The independent fix handles the equal-destination case before ordinary branch
reconstruction. It emits the prelude, evaluates the condition into a discard
local and proceeds to the common destination. The allocator chooses the discard
name, preserving a real global called `_`. Ordinary cleanup may remove only
evaluations it already proves inert. No source-specific names, seed checks or
benchmark transformations participate in the implementation.

## Evidence

Three project-authored programs cover calls in empty conditions, constant
results of short-circuit expressions, closure observation, multiple-return nil
holes, table identity, ordered comparisons through `__lt`/`__le`/`__eq`, and
an error inside a protected call. The third program checks the `_` global
collision. All 18 O0/O1/O2, g1/g2 bytecodes and hashes are sealed under
`tests/fixtures/rosetta-unused-conditionals`.

The own programs improve **4/18 to 18/18**. Complete regenerated Full seeds
1551, 1715, 1746 and 1796 improve **6/24 to 24/24**: **42/42** official
compiler/VM round trips afterward. The own baseline is `46f33f4`; exact
baseline revisions, upstream integrations, source hashes, complete reports
and the first failure for each affected family are retained under
`benchmarks/results/rosetta-unused-conditionals-2026-11-27`.

Local Node 24 validation passes all 36 focused tests and TypeScript checking.
The full unit run passes 1,095/1,096; the remaining tuple-recovery presentation
assertion reproduces on the unmodified baseline and is being repaired in the
integration branch. Both complete outputs are retained with the evidence.

The separate report for seeds1356/1444 belongs to the other loop-follow and
committed-block fixes, not to this condition-evaluation change. These are
development regressions, not independent holdouts or a complete Full-tier score.
