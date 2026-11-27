# Terminal return arms behind loop-exit adapters

Inspected Tovek `ce2ea3325547fa3896f274b68013386338039040` (MIT),
`restructure/src/region.rs` around `join_return` and
`while_body_with_exit_adapter`, and official Luau 0.747
`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
`VM/src/lvmexecute.cpp` RETURN and `Compiler/src/Compiler.cpp`
`compileStatReturn`. This is an independent implementation.

Natural loops contain blocks that can return to the iteration latch. A terminal
function return therefore lies outside the loop even when it is a source arm
inside that loop. An intervening pure jump does not turn that arm into a break:
its calls, captures and return values still execute before leaving the function.

Unconditional source reconstruction already checks for an external linear
return path. The conditional exit classifier now uses the same proof before
replacing a jump-only adapter with a break. The ordinary loop continuation is
excluded from that proof, so a genuine break retains its normal continuation.

The independent example uses a linked-node search and a generic iterator with
two early returns. It observes table identity, effects in order, three results
including a nil slot, and captured closures. An authored transformation inserts
a transparent jump before each terminal arm. All six O0/O1/O2 and g1/g2 inputs
and transformations agree in the official VM. Raw reconstruction previously
failed six of six; the repair passes six of six. The small unmodified source
already passed twelve normal/Hard full-pipeline controls because normalization
can remove its simple stubs. That successful control is retained separately
from the failing raw reconstruction; normalization is allowed to decline more
complex prototypes.

Fixtures, transformation, hashes and first output are preserved under
`tests/fixtures/terminal-return-adapters` and
`benchmarks/results/terminal-return-adapters-2026-11-27`.
