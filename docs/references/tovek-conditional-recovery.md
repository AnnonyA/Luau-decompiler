# Conditional helper recovery: compiler model and proof boundaries

This round studies Tovek at MIT revision
[`77edf387bf280a2f4d46d57ac85d5c4f071b763f`](https://github.com/Kiet1308/Tovek/tree/77edf387bf280a2f4d46d57ac85d5c4f071b763f),
copyright Jujhar Singh and Mathias Pedersen (2024). The implementation is independent
TypeScript using this project's AST and lexical bindings; no Rust code was copied.

| Requested reference | Relevant invariant | Application here |
|---|---|---|
| [`ast/src/deinline.rs`](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/deinline.rs) | Canonicalize return/guard shapes; exact parameter unification; repeated arguments retain identity. | Proof-only return trees for terminal scalar branches and early-return tails. |
| [`ast/src/deinline/evidence.rs`](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/deinline/evidence.rs) | Line evidence admits candidates but cannot authorize a transformation; its copy census also detects ambiguous provenance. | Existing line overlap plus exact proof; now reject rival helper matches. We do not implement its full copy census or folded-constant ledger. |
| [`ast/src/deinline_safety.rs`](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/deinline_safety.rs) | Track writes through closures, argument snapshots and frame-observing calls; bound search work. | Only proven primitive arguments and immutable numeric captures. Calls/metamethod-capable unknowns are excluded. Node, depth and shared work budgets fail closed. |
| [`ast/src/expr_deinline.rs`](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/expr_deinline.rs) | Recover exact subexpressions in place, outermost first, without changing short-circuit evaluation or result arity. | Match full if/elseif expressions before children; retain one scalar return and reject ambiguous matches. Also consulted its `arithmetic.rs` return-tree restrictions. |
| [`ast/src/closure_identity.rs`](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/closure_identity.rs) | Closure identity belongs to a prototype constant slot and its cache state, not a matching body. | Do not unify function literals or admit closure-valued arguments. Preserve existing CFG/SSA identity guards; test saved per-iteration closures and mutable captures. General closure-cache emulation is not added. |

Official Luau revision:
[`9d7748a4f324213a18cb8283fa2a77c330225fa0`](https://github.com/luau-lang/luau/tree/9d7748a4f324213a18cb8283fa2a77c330225fa0).
`Compiler/src/Compiler.cpp::tryCompileInlinedCall` rejects recursive inline frames,
excessive register pressure and open multret call sites. `compileInlinedCall`
evaluates arguments before rebinding the helper's locals, preserves side effects
of extra arguments, reuses some immutable argument registers, and propagates
constant arguments. Its `compileInlineReturn` writes the fixed target registers,
closes locals and emits a jump patched to the inline region's common exit. Thus
an original return tree may become branch assignments and SSA merges in the caller.

`compileExprFunction` can turn captures into local VAL/REF captures after inlining,
or materialize a propagated constant into a temporary register. `shouldShareClosure`
uses immutable top-level captures as a heuristic. The VM's `LOP_DUPCLOSURE` in
`VM/src/lvmexecute.cpp` actually compares environments and raw captured values;
its prototype constant retains the first cached capture set. A mismatching later
load clones instead of replacing that cache. This is why structural equality,
SSA register numbers alone or a moved function literal cannot justify sharing.

## Implemented transformation

The previous pass admitted a single scalar expression. It now builds an internal
pattern from immutable primitive locals and complete `if`/`elseif`/early-return
branches. It substitutes bindings by identity, never by name, and does not alter
the emitted helper definition. It can follow immutable numeric initializers at
the call site to match SSA temporaries against the helper's expression. Stable
numeric free captures must match the exact same lexical binding at the site;
any explicit write, including a nested closure write, rejects that proof.

Extracted argument references also require a destination visibility check. Review
found that `local shifted = offset + 1` followed by a shadowing `local offset = 100`
could otherwise become `weighted(offset)` with the wrong binding (7 became 205).
The walker now tracks visible declarations, loop variables, function parameters,
parallel-local initializer scope and repeat-condition scope. Regression tests
preserve 7 and reject all shadowed substitutions. A new closure/statement is not
hoisted and the existing repeat/continue declaration guard remains in force.

Two valid helper matches are ambiguous: neither is selected. Budget exhaustion
before finishing that check also leaves the expression unchanged. Template trees
are bounded to 128 nodes with bounded nesting, independently of the module budget.

## Validation and limits

Four new project-authored fixtures cover conditional return trees, repeated local
dependencies, saved loop captures, mutable captures, metamethod call order, fixed
and multiple returns, and alias shadowing. Each has O0/O1/O2 bytes and three input
sets in `tests/fixtures/object-optimized`. They are development regressions, not
blind competitor evaluations. Existing sealed corpora and external outputs stay
unchanged. Run the official-VM matrix with `npm run bench:large:regressions --
--name-styles --luau-compile /path/luau-compile --luau /path/luau --output /tmp/results`.

This extends reconstruction after CFG/SSA and AST cleanup; it does not replace
the CFG or SSA algorithms. Arbitrary statement-region recovery, effectful helpers,
open multret reconstruction, fully folded calls, dynamic capture caches and
recovery across nested function boundaries remain separate work. Exact equivalent
calls do not establish a uniquely original source call site. O0/O1 remain supported
and are checked even when they contain no inlined copies.
