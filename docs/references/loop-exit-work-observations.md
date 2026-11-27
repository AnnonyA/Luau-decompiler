# Independent observations of a numeric loop's break tail

Base engine: `155d58129799231c26094a36e4a23d771969a1b6`.

Rosetta's two remaining Hard Full mismatches both left the result of a numeric
search loop at nil. Its early exit went through a jump adapter, a MOVE that
exported the iterator value, and the common continuation. The decoded and
normalized bytecode retained that MOVE; raw source reconstruction replaced the
adapter with `break` before visiting the assignment block. Cleanup and naming
were not the loss boundary.

The independently authored `break-tail-observations.luau` searches for a multiple
of three greater than four. It records every iteration, exports the chosen
value, snapshots it in a returned closure and returns four results including a
trailing nil. Calls with limits 0, 3, 9 and 12 observe empty entry, exhaustion and
early exits. All six ordinary and six Rosetta Hard profiles pass on the base;
these are controls, not initial failures.

The explicit layout generator relocates only the early-break work behind the
numeric latch. One adapter enters that work, and a second jump makes exhaustion
bypass it. Every original jump destination is remapped. A whole-function
parameter range remains valid; original bytecode files are unchanged.

All six original/permuted pairs execute identically in the pinned official VM.
The base decompiler fails all six permuted variants: the trace and four-result
arity remain intact, but both the exported value and its captured snapshot are
nil instead of six. The candidate preserving executable linear exit work passes
all six and retains the twelve ordinary/Hard controls. The structural tests
verify that the iterator value is written to a binding owned by the enclosing
function, and validate source/bytecode hashes and lexical bindings.

References inspected:

- Official Luau 0.747, `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`:
  `VM/src/lvmexecute.cpp` FORNPREP, FORNLOOP and CLOSEUPVALS handlers. The latch
  changes the iterator only on a step; a taken break edge must still execute
  the instructions on its path to the continuation.
- Tovek, `ce2ea3325547fa3896f274b68013386338039040` (MIT, copyright
  Jujhar Singh and Mathias Pedersen): `restructure/src/region.rs::build_exit_adapter`
  retains work and binding constraints on paths outside natural-loop nodes;
  `luau-lifter/tests/loop_shared_return.rs` and
  `loop_return_skips_loop_tail.rs` distinguish returning paths from normal exits.
- Rosetta, `80f3c13ce48dc3318d5d49f54958f580937ca8aa`, suite `rosetta-3`.

The authored source, layout generator and assertions were implemented
independently; no reference code was copied. This controls-only commit does not
modify the engine. First failures, original/permuted VM observations, candidate
observations and reports remain in
`benchmarks/results/loop-exit-work-observations-2026-11-27`.
