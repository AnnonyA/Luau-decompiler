# Recovery of inlined private-table updates

This extends the [conditional helper recovery](tovek-conditional-recovery.md)
with a bounded statement region. It independently implements the proof in
TypeScript; no Tovek source was copied.

References remain pinned to Tovek's MIT revision
[`77edf387bf280a2f4d46d57ac85d5c4f071b763f`](https://github.com/Kiet1308/Tovek/tree/77edf387bf280a2f4d46d57ac85d5c4f071b763f),
copyright Jujhar Singh and Mathias Pedersen (2024). In
[`ast/src/deinline.rs`](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/deinline.rs),
`canon_top` distinguishes a helper's terminal bare return from a caller exit;
`match_void` and the region safety gates motivate matching complete ordered
regions, rather than replacing individual similar assignments. The prior study
records the evidence, frame safety and closure identity references as well.

Official Luau revision
[`9d7748a4f324213a18cb8283fa2a77c330225fa0`](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp):
`compileInlinedCall` evaluates arguments before binding the helper's locals.
`compileInlineReturn` evaluates the fixed result list, closes locals, and emits
a jump patched to the common inline exit. Consequently a helper's early return
can become a guarded continuation in the caller, without a caller `return`.

## Proof and implementation

`InlineWrites.canonicalWrites` expands continuations into branch arms solely for
matching. A bare helper return exits that expansion; any caller return refuses
the candidate. The original helper definition is preserved. Templates accept
only ordered single-value stores and branches, with static string or finite
numeric keys. Numeric expressions, tests and immutable captures use the existing
scalar proof and exact lexical identities. No algebraic rearrangement occurs.

Every store must address one table parameter. Its argument must be an immutable,
uncaptured local initialized with a table literal. A whole-AST use census rejects
any reference other than a direct property/index receiver. Thus passing it to
`setmetatable`, `table.freeze`, a callback, an alias or a return rejects recovery,
including escapes after the candidate. This deliberately conservative proof
excludes observable metamethod calls and frozen-write errors from new frames.

At least two stores, line overlap, complete parameter binding, destination scope
visibility and a unique helper/window match are required. Call arguments are
copied after their binding proof: expression nodes extracted from an earlier
initializer must not inherit rewrites scheduled in that initializer's scope.
Review reproduced such a bug with a helper name shadowed by zero; the permanent
test verifies that the initializer may call its original helper while the later
table-update call retains arithmetic instead of calling zero.

Work remains bounded by the shared 100,000-step budget, eight-statement caller
windows, nesting depth 12 and 64 expanded statements. Exhaustion refuses a match.
No declaration, effectful expression, dynamic key, loop, value return or partial
argument list is swallowed by the region matcher.

## Scope and validation

Three new original development fixtures cover O0/O1/O2 conditional table updates,
nested loops with stable captures and a non-first table parameter, and observable
metatable/frozen-table/alias behavior. Each has three deterministic input sets.
These are development regressions, not blind comparisons with other engines.
Existing sealed sources, bytecode and competitor outputs are unchanged.

This is not general effectful helper recovery. Escaped tables, table-valued reads,
unknown numeric arguments, callbacks, mutable captures, open multiple returns,
new closure synthesis and fully folded calls remain unsupported by this proof.
The pass consumes the existing CFG/SSA reconstruction; it does not replace those
algorithms or claim that an equivalent recovered call is uniquely original.
