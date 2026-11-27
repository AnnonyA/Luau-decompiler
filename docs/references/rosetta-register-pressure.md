# Fixed call-result aliases and active local limits

References inspected for this independent TypeScript change:

- Official Luau 0.747, `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`:
  `Compiler/src/Compiler.cpp` `compileStatLocal`, `compileExprListTemp` and
  `pushLocal`; `VM/src/lvmexecute.cpp` CALL result-count handling, NEWCLOSURE
  VAL/REF captures, and CLOSEUPVALS.
- Tovek, `ce2ea3325547fa3896f274b68013386338039040`, MIT license, copyright
  Jujhar Singh and Mathias Pedersen: `ast/src/copy_cleanup.rs` exact binding,
  mutation and capture restrictions; `ast/src/inline_temps.rs` callback mutation
  and evaluation-position checks.
- Rosetta, `80f3c13ce48dc3318d5d49f54958f580937ca8aa`, suite `rosetta-3`.

No reference implementation code was copied or adapted. This uses the existing
TypeScript lexical binding analysis and changes only the late local-lifetime
pass.

## Failure and invariant

At O2 with debug information, a wide result tuple can be reconstructed as a
multi-local CALL followed by debug-name copies of its first or last slots.
Even where Luau can reuse the same runtime register for an immutable copy,
`pushLocal` still enforces the active lexical-local limit. Additional copied
names plus argument temporaries can therefore make valid bytecode produce
source that exceeds 200 locals.

In a block with at least 128 direct local declarations, the repair recognizes
an immediately adjacent single-local copy from a fixed multi-local call result.
The source slot must have exactly that one read, no writes, no captures, and
belong to that immediately preceding declaration. The destination name must not
already occur in the producer's tuple. The slot then declares the destination
directly and the redundant copy statement disappears.

The destination retains its own spelling, annotation, later writes and closure
references. Its mutable cell is not substituted with a supposedly immutable
source alias. The producer's initializer and complete result list remain
unchanged, so evaluation order, nil slots and fixed result arity are preserved.
There is no intervening code over which the destination's name could move.
Literal function initializers are excluded, since rebinding them can change
observable function debug names. Repeat-body lifetime handling is unchanged.

## Evidence

The project-authored `wide-call-results.luau` uses nine fixed tuples of 21 values,
mutable captured endpoints, ordered sums and multiple returns with nil holes.
On base `e006c1e370a6aee98ba0a6200b78fa23b69375ce`, it passes five of the six
O0/O1/O2, g1/g2 profiles; O2g2 fails recompilation with the active-local limit.
All six original bytecode profiles and hashes are sealed beside the source.
The first failure and unmodified baseline report are retained in
`benchmarks/results/register-pressure-2026-11-27`.

The repaired engine passes all six profiles of that program and all six of
Rosetta's existing `register_pressure` case: **12/12** official compiler/VM
round trips, with no mismatches, recompilation failures or refusals. The
candidate report covers both programs; the baseline report covers only the
project-authored program. These are development regressions, not independent
holdouts or a complete Rosetta score.

Unit regressions retain aliases with extra reads, writes, captures, intervening
effects and destination-name collisions. They also check mutable destination
captures, initializer scope, fixed tuple slots, annotations, function debug-name
exclusions and active-local counts for every sealed compilation profile.
