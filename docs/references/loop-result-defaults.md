# Private defaults for loop results

This is an independent AST rewrite after reconstruction. It consumes a private
`syntheticLoopTail` marker placed by the reconstructor; source names, corpus
names and expected output are not inputs to the decision.

An inlined search often leaves a boolean control flag around its normal-exit
tail. If the tail only assigns a literal default to a private result, the default
can precede the loop. Successful result assignments and their immediate breaks
remain in their original locations. The flag and guarded default then disappear.

The proof resolves lexical binding identities and requires all of the following:

- The flag is introduced by reconstruction, starts true, is not captured, and
  its only read is the post-loop guard.
- Every flag write is false, immediately follows a store to this same result,
  and immediately precedes a break belonging to this loop. A nested loop's break
  never qualifies.
- The result is a local binding, is not captured, and is not read anywhere in
  the loop, including its bounds, iterators, tests or nested functions.
- Its initializer and **every** writer produce only primitive values. This
  rejects an earlier table, userdata or unknown value whose lifetime could be
  shortened by moving the overwrite, affecting weak-table observations.
- Every in-loop result writer participates in one of the proven success exits.
  The default itself is a literal. Effectful comparisons stay at their existing
  evaluation sites, and call result packs are untouched.

The implementation retains empty phi declarations before inserting the default,
applies nested changes by original AST identity, and leaves user-authored flags
without provenance alone.

## References inspected

Tovek was inspected at
[`ce2ea3325547fa3896f274b68013386338039040`](https://github.com/Kiet1308/Tovek/tree/ce2ea3325547fa3896f274b68013386338039040),
MIT, copyright Jujhar Singh and Mathias Pedersen (2024). Relevant areas were
[`cleanup_control_flow.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/cleanup_control_flow.rs),
[`deinline_safety.rs`](https://github.com/Kiet1308/Tovek/blob/ce2ea3325547fa3896f274b68013386338039040/ast/src/deinline_safety.rs)
and the `loop_return_skips_loop_tail` regression. They reinforce break ownership
and whole-binding writer checks. No Rust implementation was copied or adapted.

Official Luau was inspected at
[`c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f`](https://github.com/luau-lang/luau/tree/c87565b8b0db5d5d5bfd2b8b00ad6573e5d06d9f):
`Compiler/src/Compiler.cpp` `compileStatWhile`, `compileStatRepeat`,
`compileStatFor`, `compileStatForIn` and the `AstStatBreak` lowering. Loop exits
patch their own jumps and close the loop's captured locals; this pass leaves
both the actual break and the body declarations in place.

## Observations

The independently authored `loop-result-observations.luau` exercises equality
metamethod order, success and empty/missing searches, nil-containing return
packs, and per-iteration captured results and closure identity. Its sealed
O0/O1/O2 × g1/g2 originals and six Hard variants are in
[`tests/fixtures/loop-result-defaults`](../../tests/fixtures/loop-result-defaults/manifest.json).
Both the integrated pre-change engine `f60a031` and this candidate pass all
**12/12** exact runtime comparisons. On this development control, similarity
changes from **81.8580% to 83.6010%**, and the token-size ratio changes from
**1.3448 to 1.2884**. These are one control's results, not the global benchmark.

The original six direct official-VM traces and the independent Rosetta check
are retained in
[`loop-result-defaults-2026-11-27`](../../benchmarks/results/loop-result-defaults-2026-11-27/).
The unit tests additionally reject captured cells, reads in bounds, shadowing,
nested-loop breaks, open initializers, unpaired stores, effectful fallbacks and
potential object-lifetime changes. The final integrated benchmark is measured
separately on the unchanged Rosetta corpus and metric.
