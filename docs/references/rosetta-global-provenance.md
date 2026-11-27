# Preserve global assignments that resemble generated locals

References inspected: Tovek `ce2ea3325547fa3896f274b68013386338039040`,
`ast/src/local_declarations.rs` and `ast/src/copy_cleanup.rs`; MIT license,
copyright Jujhar Singh and Mathias Pedersen. Its declaration/copy passes work
with identified local bindings, rather than inferring a local from spelling.
Official Luau 0.747 `c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`,
`Compiler/src/Compiler.cpp` `compileLValue` and `VM/src/lvmexecute.cpp`
GETGLOBAL/SETGLOBAL distinguish lexical cells from environment reads/writes.
SETGLOBAL can also invoke an environment's `__newindex` handler. No reference
implementation code was copied or adapted.

The preliminary AST repair used a scratch-name pattern to turn an undeclared
assignment such as `index = position` into `local index = position`. A genuine
global with that spelling was consequently shadowed inside the branch, then
its apparently unused local could disappear in later cleanup. In the Full
mutant `mut1-569`, raw reconstruction passes all six profiles; this repair was
the stage that changed its behavior.

The independent change passes the already recorded reconstruction allocator
inventory into that repair. Module globals are reserved outside the allocator,
so unresolved names absent from that inventory retain global assignment
semantics. Similar allocated names remain eligible for the existing lexical
repair. An explicitly empty inventory means no names are known generated.
The standalone AST-only API retains its previous behavior when the optional
inventory is omitted. No runtime lookup, call, assignment or closure moves.

## Evidence

The project-authored `global-loop-choice` observes writes inside a loop through
later global reads and a retained reader closure, multiple returns with a nil
hole, a similarly named local parameter, an ordered trace and table alias
identity. Its six O0/O1/O2, g1/g2 original bytecodes and hashes are sealed under
`tests/fixtures/rosetta-global-provenance`.

Baseline source: `e9a3cc4b7bb629a3bc78ccaf722c7d80f0fd4f22`.
Rosetta: `80f3c13ce48dc3318d5d49f54958f580937ca8aa`, rosetta-3, Luau 0.747.
The own program improves **0/6 to 6/6**, and authentic Full mutant `mut1-569`
improves **0/6 to 6/6**: **12/12** official compiler/VM round trips afterward.
The mutant's expected later error ending remains part of the equivalence check.
Original first-failure traces and reports are retained unchanged under
`benchmarks/results/rosetta-global-provenance-2026-11-27`.

Unit tests cover globals named `index`, `value`, `result` and `count`, alongside
similar captured local names, a genuinely missing allocated temporary and an
empty provenance inventory. Local validation uses Node 24: **1,047/1,047 unit
tests** and TypeScript checking pass. These are development regressions, not
independent holdouts or a complete Full-tier score.
