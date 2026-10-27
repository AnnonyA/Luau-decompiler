# Captures after SSA reconstruction

Reference inspected: [Kiet1308/Tovek at 77edf387](https://github.com/Kiet1308/Tovek/tree/77edf387bf280a2f4d46d57ac85d5c4f071b763f), MIT license, copyright Jujhar Singh and Mathias Pedersen (2024).

The useful invariant is that a pinned local is not necessarily immutable. Luau's
VAL capture snapshots a value, while reconstructed Luau closures capture lexical
cells. Reusing an SSA phi binding across iterations can silently change one into
the other. The independent workbook benchmark exposed precisely that problem:
all saved checkpoints returned the last iteration's score.

Tovek retains `Upvalue::Copy` separately from `Upvalue::Ref`, then restores needed
snapshots after SSA destruction:

- [capture classification in lifter.rs](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/luau-lifter/src/lifter.rs#L1750)
- [materialize_value_captures.rs](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/materialize_value_captures.rs)
- [copy_cleanup.rs safeguards](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/copy_cleanup.rs#L224)

Our implementation uses the existing decoded capture tags and phi ownership at
closure emission. It creates a local snapshot for VAL captures of merged or
mutable forward bindings, keeps it separate from the register environment, and
routes only VAL captures through it. REF captures continue using their original
cell. Deferred expressions are materialized once. No Rust source was copied;
this is an independent implementation of the invariant in our TypeScript IR.

The workbook's O1/O2 regressions failed before this change and pass afterward.
Its first independent evaluation remains stored separately; using it to develop
this fix makes subsequent evaluations development regressions.

Other promising Tovek work, not claimed as implemented here: general de-inlining
of O2 helpers, a full capture-effect graph, and structured fallback for arbitrary
irreducible CFGs. These require their own evidence and regression work.

## Shared closure constants after O2 inlining

[closure_identity.rs](https://github.com/Kiet1308/Tovek/blob/77edf387bf280a2f4d46d57ac85d5c4f071b763f/ast/src/closure_identity.rs)
tracks `(prototype, constant slot)`, rather than assuming identical function
bodies imply identical objects. Official Luau `lvmload.cpp` creates a closure
per constant, and `lvmexecute.cpp`'s DUPCLOSURE reuses it when environment and
captured values agree.

Our additional independent reduction calls a factory twice. O2 emits two loads
of one capture-free closure constant; formerly we printed two function literals,
changing `first == second` from true to false. We now share one lexical binding
for repeated capture-free constant loads in the same basic block, with only
inert loads/copies between them. Creation remains at the first original site.
Register assignment still uses the normal phi/REF path. This does not merge
NEWCLOSURE, different constant slots, captured closures, cross-block loads or
loads separated by potentially effectful instructions. General environment- and
capture-sensitive cache reconstruction remains future work.


## Constant sharing across dominated regions

The follow-up retains creation at the first original load but extends identity
recovery beyond one straight block. A load may reuse the first binding when it
is dominated by that first load, all intervening instructions are inert loads,
copies or truthiness branches, and no participating load is in a loop. A local
slot declared in the enclosing function keeps the binding visible across branches;
only its declaration moves, not closure creation or capture evaluation.

SSA now records the reaching definition at each register read. VAL capture lists
are compared by those identities, following MOVE aliases. Reusing a register with
a new definition does not count as the same capture. Captured sharing is restricted
to non-repeating top-level regions of the chunk: a nested function can execute
again with different captures while its prototype constant still caches the first
activation's values. REF/UPVAL captures, self captures and uncertain activation
lifetimes remain excluded. This is not general captured-closure cache emulation.

Project-authored `stable-capture-constant` and `branch-closure-constant` failed
identity comparisons at O2 before the change; both now match at O0/O1/O2. The
former also verifies table alias identity, mutation visibility and multiple
returns. The latter runs with both truthiness outcomes. `different-closure-captures`
and a synthetic SSA-version test protect against merging distinct captures.
The same Tovek `closure_identity.rs` and official VM DUPCLOSURE implementation
listed above informed the invariant; the implementation is independent.

Cycle exclusion uses iterative strongly connected components, not only natural
loops: irreducible regions can revisit a load despite having no dominating loop
header. The graph walk is linear in blocks and edges and does not recurse on
the host stack. Interval scans start at a binary-searched instruction index.
