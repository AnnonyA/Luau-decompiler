# Sharing the original body of a short-circuit guard

The CFG can contain one body with two incoming conditional edges: the first
test enters it directly, or a second test enters it after the first test fails.
Reconstructing the two arms independently duplicated that same body in the
printed source. This change recovers an `or` condition when a bounded proof
allows the original body to be emitted once.

The proof uses block identity, dominance, liveness and existing SSA data. It
does not compare output text, recognize benchmark names, or assume two
separately compiled bodies are equivalent.

## References and implementation origin

The relevant Tovek reference is
[`shared_tail_shape` and `build_shared_tail_conditional`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/restructure/src/region.rs).
Its single-entry, shared-target and edge-argument checks informed the review
questions. Tovek's [MIT license](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/LICENSE.txt)
names Jujhar Singh and Mathias Pedersen. The TypeScript implementation here was
written independently for this repository's CFG, register environment and SSA;
no Rust implementation was copied or translated.

The official compiler's `compileConditionValue` lowers `and`/`or` by preserving
the left-to-right conditional evaluation of its operands. Both pinned revisions
were inspected:

- [Rosetta Luau compiler c87565b8](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/Compiler/src/Compiler.cpp).
- [Official CI compiler 9d7748a4](https://github.com/luau-lang/luau/blob/9d7748a4f324213a18cb8283fa2a77c330225fa0/Compiler/src/Compiler.cpp).
- [VM comparison and conditional instructions at c87565b8](https://github.com/luau-lang/luau/blob/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f/VM/src/lvmexecute.cpp).

In particular, a negated ordered comparison is not replaced with the opposite
ordered comparison: `not (a < b)` and `a >= b` differ for NaN. Existing
`conditionFrom` supplies the correct edge polarity without swapping operands.

## Admission and state restoration

The first branch must have exactly two distinct successors. One is a second
conditional block, and both can enter the same body. The second conditional's
other edge and the body's only successor must be the existing follow.
The two consumed blocks must be dominated by the first branch, with no other
reachable entries, no loop header and no phi of their own.

Only a bounded expression prelude is admitted for the second test. Calls,
stores, allocation, cell changes, open packs, loop operations and unknown
opcodes are excluded there. A definition in that prelude must not remain live
after the block. Neither consumed block may write a register merged by a phi at
the follow. An unchanged iterator phi at the follow is allowed.

The common body is still emitted through the ordinary statement path, once,
at its original conditional position. Its proof excludes captures, closure
creation, closes, varargs, loop operations, unknown instructions and calls with
open input or output arity. Existing open packs or unfinished constructors also
decline the transformation. These restrictions deliberately leave more complex
shapes to the original reconstruction.

The second guard is speculated with normal instruction emission. If preserving
a debug declaration, stored read, or other evaluation requires a statement,
the transformation is rejected. Environment, consumed instructions, pending
constructor state, names, scopes, phis and emitted blocks are restored in a
`finally` block before either accepting or rejecting the expression. A review
found that the first prototype did not restore emitted blocks on rejection;
the preserved regression shows the missing branch, and the final test requires
the exact unchanged baseline source.

Two property reads in `cost[key] == nil or value < cost[key]` remain two distinct
reads. The first can short-circuit the second. There is no common-subexpression
elimination and no assumption that indexing or comparison metamethods are pure.

## Independent controls and measurements

Project-authored sources cover ordered indexing, `__lt`, NaN, a thrown second
read, short-circuit skipping, a shared update inside a generic loop, an existing
iterator phi, fixed return arity containing nil, and rejected closure/capture
and nested-loop state. Their first originals and bytecodes are retained in
[`tests/fixtures/shared-guards`](../../tests/fixtures/shared-guards/manifest.json).

The first baseline exposed an independent saved-copy defect: a `MOVE` before
the first reference capture could remain an alias of the subsequently mutable
cell. It failed four profiles before this change and the first shared-guard
candidate produced byte-identical output for that rejected source. Those
failures are preserved rather than excluded from the observation table.

The exact Rosetta diagnostic replay on all 882 Quick profiles increased mean
similarity from 77.2670081278% to 77.4395572963% on base `2b2f5b4`, a gain of
0.1725491685 percentage points. Seventy-six profiles improved, none regressed
in this metric, and all decompiled. The token ratio moved from 0.9865955905 to
0.9831333064. These diagnostic figures alone do not establish behavioral
equivalence; the strict runner and official VM observations are recorded
separately in the [evidence directory](../../benchmarks/results/shared-guards-2026-11-27/README.md).

No Rosetta corpus, score, default option, compiler pin or refusal rule changed.
Full and hard tiers were not run for this change because the active user scope
is Quick.
