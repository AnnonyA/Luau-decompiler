# Read an identity register selection once

References inspected: Tovek `ce2ea3325547fa3896f274b68013386338039040`,
`ast/src/side_effects.rs` and `ast/src/inline_temps.rs` (MIT, copyright Jujhar
Singh and Mathias Pedersen), and official Luau 0.747
`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`, `Compiler/src/Compiler.cpp`
`compileExprAndOr` / `compileConditionValue` and `VM/src/lvmexecute.cpp`
AND, OR, JUMPIF and JUMPIFNOT. No reference implementation was copied.

The VM selects between values already stored in registers. With equal B and C,
AND and OR both copy that one register, regardless of its truthiness. Replacing
that instruction with two copies of its deferred producer can execute a call
again. Rosetta's identity substitutions exposed this when a larger prototype
caused the optional normalization pass to decline.

The independent reconstruction fix emits the source register's expression once
for equal operand registers. Calls and varargs retain explicit single-value
context; real distinct operands keep their existing selection behavior. This
does not merge expressions by textual similarity or remove separate source calls.

## Evidence and limits

The project-authored `parallel-self-copy-effects` preserves an ordered call
trace through parallel assignments, false/nil values, signed zero, retained
closures, mutable captures and table identity. Its direct reconstruction boundary
failed O1g1+x2 and O0g2+x2 before the repair and matches the official VM afterward.
Those sealed original bytecodes are retained under `tests/fixtures/register-self-copies`.
The direct-boundary driver intentionally omits normalization and cleanup to
exercise the fallback invariant. Its full first evaluation is preserved,
including two unrelated control-flow failures that this change does not claim
to repair.

Three independent source controls pass **36/36** normal and Hard production-CLI
round trips. Their small prototypes already passed the baseline Hard checks
because normalization completed. Authentic `seed1726` reproduces the full
production failure: both O1g1+x2 and O0g2+x2 improve from mismatch to pass. Its two
separate reconstruction timeouts are tracked by the loop-boundary work.

The unit oracle evaluates returned values, producer counts and return arity for
eight categories of VM value with both opcodes. It also checks the sealed real
compiler fixtures and retains two genuine identical source calls. **148/148**
focused unit tests pass, and the complete suite passes **1224/1224** tests in 125
files. TypeScript checking passes on Node 24. Detailed reports and
unchanged first failures are in `benchmarks/results/register-self-copies-2026-11-27`.
These are development regressions and controls, not a complete benchmark tier.
