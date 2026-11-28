# Shared continuations within an iteration

An exit-based post-dominator can be reached only in a later loop iteration.
Using it as the current branch boundary can duplicate an otherwise shared
continuation into several alternatives. A surviving path first performs that
continuation, traverses the backedge, and only then reaches the selected guard.
The duplicated source can preserve behavior while losing the original structure.

## Bounded recovery

`findIterationContinuation` first checks whether both arms already reach the
selected boundary without leaving this iteration. If so, the existing choice
is retained. Otherwise it looks for a shared CFG block and proves that every
prefix path reaches that block or a terminal `RETURN`. Each arm must have at
least one path to the shared block. The implementation is iterative, bounded
to 512 visited blocks per walk and 32 candidate boundaries, and fails closed.

The new boundary must be dominated by the original branch, unconsumed, inside
the current loop, outside any other loop region not containing that branch,
and free of SSA phis. Prefixes cannot write the continuation's live-in
registers. Explicit loop backedges and dominance backedges are excluded;
cycles, loop escapes, nested iteration preparation, already emitted blocks and
other terminal transfers reject the recovery.

Calls, open argument/result producers, frame preparation, allocations, stores,
closure creation, capture and close operations in a prefix are excluded.
Instructions with an unknown effect classification also reject the proof.
This includes a `CLOSEUPVALS` immediately before a terminal return: it is not
silently discarded or treated as an empty adapter. Existing branch emission,
SSA owners, phi machinery and register environments remain responsible for
the instructions; the helper chooses only the shared boundary. It does not
compare names or source text, move an initializer, or synthesize a helper.

This is deliberately narrower than general loop reconstruction. In the focal
development case, O0/O1 recover the shared tail, while O2 remains unchanged
because its terminal path closes upvalues. Extending that case would require
a separate proof of cell ownership and closing behavior.

## Engineering references

The required starting reference is
[captures after SSA reconstruction](tovek-capture-reconstruction.md). This
change additionally inspected [Tovek at `ce2ea332`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040):
`restructure/src/region.rs`, especially `reaches_in_iteration`,
`build_conditional_inner` and its bounded shared-tail checks. The useful
distinction is current-iteration reachability versus exit-based post-dominance.
Its [MIT license](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/LICENSE.txt)
credits Jujhar Singh and Mathias Pedersen. No Rust implementation was copied
or adapted; this TypeScript helper is independent and uses this project's
CFG, dominance, loop, SSA and liveness representations.

The official Luau compiler and VM were inspected and used at both
[`c87565b8`](https://github.com/luau-lang/luau/tree/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f)
and [`9d7748a4`](https://github.com/luau-lang/luau/tree/9d7748a4f324213a18cb8283fa2a77c330225fa0).
`Compiler/src/Compiler.cpp::compileStatWhile` patches the condition exits
separately from the interruptible `JUMPBACK`; `compileStatReturn` preserves
requested tuple shape and open results. `VM/src/lvmexecute.cpp` supplies the
`JUMPBACK`, `RETURN` and `CLOSEUPVALS` semantics. These are the two pinned
toolchains used by the independent runtime controls.

## Validation and limits

Five project-authored sources cover early returns and effect order, fixed
return arity with a nil slot, fresh mutable captured cells created in the
shared continuation, previously captured cells and saved aliases across
reassignment, and nested loops with captures. All 60 round trips pass before
and after the change across both pins and O0/O1/O2 × g1/g2. The two admitted
sources reduce three syntactic copies of their shared effect to one. The
remaining 36 profiles retain byte-identical reconstructed source.

The unit tests separately reject cycles, other loop regions, phis, live-in
writes, consumed blocks, non-return escapes, capture/close instructions,
unknown instructions and frame/pack-producing operations. An independent
review checked the interactions with `emitRange`, `tryIf`, register writes
and alias snapshots; it found no further concrete blocker within this scope.

The [measurement record](../../benchmarks/results/iteration-continuations-2026-11-27/README.md)
contains the raw strict Quick and Hard Quick reports, provenance, focused
runtime results and first observations. These are development regressions,
not a new blind evaluation. No Full or Hard Full measurement is claimed for
this isolated change, and neither the metric nor the corpus was changed.
