# Values crossing a loop boundary

References inspected: Tovek `ce2ea3325547fa3896f274b68013386338039040`
(MIT), `cfg/src/ssa/destruct.rs` and `luau-lifter/tests/register_phi_webs.rs`;
official Luau 0.747 `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
`VM/src/lvmexecute.cpp` MOVE, LOADB, NOT and FORNLOOP dispatch. The implementation
is independent; no reference source was copied.

Three related invariants govern the repair:

1. A value overwritten before every body read may have only an exit phi. Its
   declaration still belongs outside the loop, and a zero-iteration predecessor
   supplies its entry value. Loop phi declaration now includes the continuation,
   without inventing an entry evaluation when every incoming edge is internal.
2. An established SSA phi owns its final definition even if an intermediate
   write starts a debug local with another name. Debug spelling cannot replace
   the exported binding with a body-local declaration.
3. A register copy made before the loop keeps that original value. Snapshotting
   it at the first emitted body write repeats the snapshot on every iteration,
   which incorrectly makes it follow the changing accumulator. Copies of named
   cells written by the loop are now saved before entering it, and the exit
   environment retains those saved bindings.

Four project-authored fixtures exercise zero and positive iteration counts,
boolean overwrites, concatenation, numeric aliases, multiple return values and
fresh closure captures. The first two passed 7/12 before repair; the separate
copy/capture pair passed 6/12 before the snapshot change. All four pass 24/24
official O0/O1/O2, g1/g2 round trips after repair. Their source and bytecode hashes
are retained under `tests/fixtures/loop-exit-values`; first failures and paired
results are retained under `benchmarks/results/loop-exit-values-2026-11-27`.

The development check of thirteen previously failing Rosetta generated programs
improves from 43/78 to 65/78. Its remaining failures are recorded rather than
discarded. This is a targeted development result, not an all-suite score.

## Scalar calls followed by register swaps

The MOVE pack path previously treated any deferred call expression as an open
result tuple. Two adjacent MOVEs can instead implement a parallel swap after a
single-result CALL. A second local on that call then receives nil, even though
the original neighboring register still contains a value. Pack extraction now
requires the active open-result marker. Scalar calls use ordinary MOVE handling.
The official CALL result count and MOVE semantics, at the revision above, are
the reference for this independently implemented condition.

The independent scalar swap failed at all three g1 profiles before repair;
the fixed/open-return control passed six. Both now pass 12/12, and the complete
Rosetta development seed1097 passes 6/6. Sources, bytecode and first failures are
retained under `tests/fixtures/scalar-call-swap` and
`benchmarks/results/scalar-call-swap-2026-11-27`.
