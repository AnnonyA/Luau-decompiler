# Call and constructor boundaries exposed by Rosetta

References inspected for this independent TypeScript repair:

- Official Luau 0.747, `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`:
  `VM/src/lvmexecute.cpp` `LOP_NAMECALL`, `LOP_CALL` and `LOP_SETLIST`;
  `Compiler/src/Compiler.cpp` `compileExprListTemp` / `compileStatLocal`;
  `Ast/src/Parser.cpp` contextual `continue` parsing.
- Tovek, `ce2ea3325547fa3896f274b68013386338039040` (MIT, copyright
  Jujhar Singh and Mathias Pedersen): `luau-lifter/src/lifter.rs` NAMECALL/CALL
  pairing and SETLIST lowering; `ast/src/assign.rs` target/read ordering;
  `ast/src/inline_temps.rs` capture-aware motion checks; and
  `ast/src/formatter.rs` `is_valid_name`.
- Rosetta, `80f3c13ce48dc3318d5d49f54958f580937ca8aa`, suite `rosetta-3`.

No reference implementation code was copied or adapted. The repairs preserve
existing facts in this engine's register environment and pending table stack.

## Invariants

1. A NAMECALL placeholder is consumed by its paired CALL. A later CALL may use
   the function returned by that method, even when the deferred expression is
   still a `method-call` node. The existing `methodSelf` marker now distinguishes
   the placeholder from that result. This preserves both argument lists, the
   second call's side effects and the returned value pack.
2. Fixed-size SETLIST writes into an existing table. If a previous keyed write
   already materialized the constructor, its array slots are assigned on the
   same table; it is not replaced with a new array literal. The existing pending
   constructor path remains unchanged. General open-tail SETLIST on an already
   materialized table is outside this particular repair.
3. Pending allocations and fields are emitted before RETURN. Appending an unused
   constructor after the terminator both changed evaluation and produced invalid
   source. Flushing before the return retains the same builder semantics.
4. `continue` is a contextual keyword. Luau accepts it as a global, local,
   parameter, field and method name. Actual reserved words remain rejected.

## Evidence

The four project-authored sources in `tests/fixtures/rosetta-semantics` were
compiled using the official pinned compiler at O0/O1/O2, each with g1/g2. Rosetta
executed original and reconstructed bytecode for all 24 combinations. The base
`9d4f03fde53d611aef91028a2b1f7529b2f4ffaa` passes 8/24; this repair passes 24/24.
The first failures and both summaries are retained beside these notes. They
are development regressions, not an independent holdout evaluation.

The cases observe returned-function calls, multiple returns including nil holes,
closure effects, table aliases and fields, and contextual identifier syntax.
The fixture unit tests additionally inspect the nested-call AST, table identity
and placement of returns. The original Rosetta `builtins`, `roblox_names` and
`table_constructors` programs pass all 18 normal compilation profiles with the
repair. Full-tier results must be reported separately on the integrated commit.

### Speculative reconstruction follow-up

The first Quick run exposed a regression in conditional method calls: both value
walkers copied a NAMECALL expression but dropped its `methodSelf` marker. Thus
the new distinction above correctly rejected the markerless placeholder, but
the recovered call lost implicit self. Both speculative walkers now retain that
marker until CALL consumes it. `conditional-method-calls` adds six official
profiles covering if-expression and short-circuit alternatives. The middleclass
library passes all six profiles again, and calculator retains its four previously
passing profiles (its two pre-existing O0 mismatches remain separate work).
