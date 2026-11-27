# Restoring conditions on reconstructed loops

Reference inspection: Tovek `ce2ea3325547fa3896f274b68013386338039040`,
[`ast/src/cleanup_control_flow.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/cleanup_control_flow.rs),
under its MIT license (Jujhar Singh and Mathias Pedersen, 2024). Official Luau
`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
[`compileStatWhile` / `compileStatRepeat`](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp),
and VM truthiness jumps establish the evaluation and scope rules. This is an
independent implementation in our TypeScript AST; no reference code was copied.

Some short-circuit repeat conditions previously survived as several `if ...
then break end` statements at the end of `while true`. The source was correct,
but obscured the loop's condition and added tokens. The structural pass now
combines consecutive terminal break guards with `or` into a repeat condition.
The original order and short-circuit behavior stay intact. Locals declared in
the body remain visible through that condition, including captured cells.

A `continue` belonging to this loop can skip the old guard, whereas a repeat
continue evaluates its condition. Such loops are therefore excluded. Continues
inside nested loops do not exclude the outer conversion. Other early breaks and
returns keep their targets. The pass also moves a sequence of entry break guards
out of an otherwise unconditional while loop into its condition. It leaves a
while loop that already has a condition unchanged, keeping explicit body exits
readable. Negated ordering comparisons retain `not`, preserving NaN behavior.

The project-authored `ordered-latches` control observes predicate call order,
multiple results and nil arguments, per-iteration captured table identity,
continues that skip a latch, and NaN comparisons. Its twelve sealed normal/hard
bytecode profiles and SHA-256 manifest are under
`tests/fixtures/loop-condition-presentation`. The unchanged pinned Rosetta VM
round-trip passes all 12 profiles before and after. Similarity improves from
83.2836% to 86.0185%, and the token size ratio from 1.1342 to 1.0962.

The previously observed Rosetta `scopes` and `nan_comparisons` cases also pass
all 24 normal/hard profiles on both engines. Their mean similarity changes from
79.3429% to 81.5175%, with token ratio 1.2160 to 1.1793 and 32 added endless-loop
instances reduced to zero. These are development controls, not a new blind
benchmark. Raw reports and exact source provenance are in
`benchmarks/results/loop-condition-presentation-2026-11-27`.

All 1,345 unit tests in 135 files pass, including 23 new presentation and sealed
fixture checks. No existing assertion was weakened or removed. Full Rosetta
release measurements belong to the later integrated engine revision.
