# Iterator entry is a control-flow edge

References inspected: Tovek `ce2ea3325547fa3896f274b68013386338039040`
(MIT), `luau-lifter/src/lifter.rs` iterator-origin mapping and FORGPREP lifting;
official Luau 0.747 `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
`VM/src/lvmexecute.cpp` FORGPREP, FORGPREP_INEXT, FORGPREP_NEXT and FORGLOOP
dispatch. The repair is independently implemented; no reference code was copied.

All three preparation instructions unconditionally transfer to the iterator
step. A fabricated fallthrough edge to the next physical instruction corrupts
dominance and loop ownership when blocks have been permuted. The CFG now has
only the actual preparation edge. Reconstruction finds the body through the
paired FORGLOOP's successful-iteration edge, and that edge need not decrease the
program counter. A standalone forward FORGLOOP without a preparation is not
enough to infer a generic loop.

The authored `collect` fixture is compiled at O0/O1/O2 and g1/g2. Its straight
iterator blocks are permuted into preparation, continuation, iterator step,
body, with explicit connecting jumps. The original and permuted programs agree
in the official VM in all six profiles. Before this repair, reconstruction
returns zero for nonempty inputs in all six; after it, all six print the correct
`10, 0, 7` observations. The permutation retains a valid full-function parameter
debug range so the CFG is tested without relying on physical-layout cleanup.

A second authored fixture checks zero iterations, nested iterators, fresh
closure captures, effect order and an open multiple-return observation. Both
authored fixtures pass 12/12 ordinary and 12/12 Hard round trips. The separate
development seed1633 still fails one Hard profile after this bounded repair;
its 5/6 result is retained explicitly. These are targeted checks, not a suite
score. Sources, bytecodes and hashes are in `tests/fixtures/generic-entry-layout`;
paired VM observations and first failures are in
`benchmarks/results/generic-entry-layout-2026-11-27`.

## Numeric entry adapters

FORNPREP's successful edge can lead through a pure JUMP before the actual body.
Both preparation lookup and bound recovery now follow that proven control-only
chain and require the same iterator base register at FORNLOOP. Observable
instructions, including CLOSEUPVALS, are never skipped. Tovek's numeric iterator
pairing and the official FORNPREP/FORNLOOP dispatch at the revisions above were
inspected for this independent implementation.

The authored numeric sum fixture is compiled in all six profiles and permuted
with an explicit entry adapter. The original and transformed bytecode agree in
the official VM, while the first decompilation loses the entire loop and return
in 6/6 profiles. After repair all six print `0, 1, 15`. Its first failures,
unchanged bytecodes and hashes are retained under `numeric-entry-layout` in the
fixture and result directories. Development seed1633 now reaches its later
observations but still has a value mismatch; that result remains recorded.
