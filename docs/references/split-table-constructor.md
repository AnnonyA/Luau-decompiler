# List constructors spanning straight control-flow blocks

References inspected: Tovek `ce2ea3325547fa3896f274b68013386338039040`
(MIT), `luau-lifter/src/lifter.rs` SETLIST lifting; official Luau 0.747
`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`, `VM/src/lvmexecute.cpp`
SETLIST dispatch. The implementation is independent; no reference source was
copied. SETLIST mutates the existing table, including when it consumes the
dynamic top of a multiple-return call; it does not allocate another table.

An unconditional block boundary does not finish a source constructor. Previously
the emitter materialized each partial batch at that boundary, and its final open
SETLIST used a new literal. That dropped earlier fields and truncated the tail
because its first array index was no longer one.

Future list writes now follow executable straight CFG chains rather than
physical program counters. A pending constructor may cross a boundary only
when there is one successor, that successor has one reachable predecessor, and
the same table register reaches an open SETLIST before a redefinition, branch,
real join or cycle. Ordinary observations still materialize the table and scalar
field effects at their original positions. Dead predecessors do not change the
executable path. Completed open tails are committed normally.

The authored fixture has forty fixed fields, a three-result tail containing a
nil middle element, two aliases of the resulting table and a call counter. Its
first SETLIST batch is placed physically after the continuation with connecting
jumps. All six original and transformed programs agree in the official VM.
Before repair all six lose the prefix and final result; afterward all six retain
identity, length, indexed values, nil placement and the single tail call.
Originals, transformed bytecodes, source hashes and first outputs are retained
under `tests/fixtures/split-open-table` and
`benchmarks/results/split-open-table-2026-11-27`.
