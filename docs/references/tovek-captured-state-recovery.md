# Inlined captured state: values, cells and effects

This extends [private-table recovery](tovek-private-table-recovery.md) with ordered
numeric upvalue writes. Implementation is independent TypeScript; no Rust source
was copied. Tovek remains pinned to MIT revision
[`77edf387bf280a2f4d46d57ac85d5c4f071b763f`](https://github.com/Kiet1308/Tovek/tree/77edf387bf280a2f4d46d57ac85d5c4f071b763f),
copyright Jujhar Singh and Mathias Pedersen (2024).

In [`ast/src/deinline_safety.rs`](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/deinline_safety.rs),
`closure_written`, `may_change`, `stable_at` and the register/upvalue distinction
show why numeric type, lexical identity and value stability are separate proofs.
The prior reference studies cover statement matching, evidence, expression
recovery and closure identity. We do not copy its private-writer call graph.

Official Luau remains pinned to
[`9d7748a4f324213a18cb8283fa2a77c330225fa0`](https://github.com/luau-lang/luau/tree/9d7748a4f324213a18cb8283fa2a77c330225fa0).
`Compiler.cpp::compileExprFunction` notes that inlining migrates upvalues to local
registers and chooses REF for written captures. `compileInlinedCall` binds arguments
before the body. In `VM/src/lvmexecute.cpp`, GETUPVAL reads the cell's current value,
SETUPVAL updates that cell, and CLOSEUPVALS ends its connection to the register.

## Recovered effects

`NumericState` proves a whole-binding type invariant: an explicit numeric local
initializer and every assignment, including writes from nested closures, must
preserve the numeric type. Unknown writers, calls, parameters of unknown type,
parallel assignments and metamethod-capable operands invalidate the proof.
Dependencies are collected by lexical identity; invalidation propagates through
cycles. Bounded work fails closed.

The invariant does not make a mutable value stable. Such cells may participate
only as exact matched free reads/writes in an ordered helper region. They are
never inferred as call arguments or expanded through earlier initializers.
Arguments retain the existing immutable primitive proof. Stores may combine
captured numeric cells and a private fresh table, with conditionals and bare
helper returns. Local compound writes normalize for matching without duplicating
table receivers or dynamic keys. No arbitrary callback is moved into a new frame.

Zero-argument state helpers and once-initialized forward local functions are
eligible. Candidate availability begins at the sole initialization in its lexical
region. A later write or branch-only initialization cannot authorize a call outside
that region. Unused caller snapshots may be omitted only when all their bindings
have no reads, writes or captures and all initializers are proven primitive.

## Correct REF ownership through SSA reconstruction

The counter regression exposed an existing O2 error before recovery: loop-phi
installation dropped the open REF-cell marker. With two writes in one iteration,
only the last SSA definition feeds the phi. The first write consequently became
a new local, and an intervening closure captured that local instead of the shared
cell. The next iteration read zero again. SSA itself was correct.

`bindPhi` preserves the open-cell marker only for the same named, non-aliased
binding. Branch joins additionally require both arm environments to retain that
open cell; restoring the pre-branch environment must not undo CLOSEUPVALS. A
synthetic regression caught this latter problem: a closed reader returned 4/5
instead of 1/2 when a later register write was incorrectly attached to its cell.
Both cases have permanent tests. Existing VAL snapshots and closed-register reuse
remain separately tested.

The newly evaluated public `cell_swap_beside_copy` fixture exposed another issue:
an alias copied before a branch was snapshotted inside each arm, then forgotten
when restoring the pre-branch environment. Snapshotting aliases of captured phi
bindings before the split preserves that old value in a scope visible after the
join. An independently authored `captured-branch-snapshot` regression reproduces
the failure and now passes; the public fixture's observation changes from MISMATCH
to MATCH without modifying it.

## Bounds and evidence

Five new original programs exercise repeated captures and multiple returns,
mixed table/cell writes, unknown writers with metamethods and errors, and writes
and snapshots across branch joins. Each is compiled at O0/O1/O2 and checked with three input sets
and five naming styles. Existing sealed corpus inputs and competitor results are
unchanged; these programs are development regressions.

This completes the numeric captured-state extension. Arbitrary effectful calls,
unknown-type cells, value-returning write helpers, dynamic table reads and general
mixed open/closed cell joins are not claimed as solved. Unsupported recovery
patterns retain their reconstructed statements. No universal accuracy or new
competitive superiority follows from these regressions.
